'use strict';

const http = require('http');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = process.env.OPENCODE_URL || 'http://127.0.0.1:4096';
const REQUESTED_MODEL = process.env.OPENCODE_MODEL || 'opencode/gpt-5-nano';

let client = null;
let sessionId = null;

function checkReachable(baseUrl, timeoutMs = 3000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(baseUrl);
      const url = `${u.protocol}//${u.host}/global/health`;
      const mod = u.protocol === 'https:' ? require('https') : http;
      const req = mod.get(url, { rejectUnauthorized: false }, (res) => {
        if (res.statusCode < 200 || res.statusCode >= 400) {
          resolve(false);
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            const j = JSON.parse(Buffer.concat(chunks).toString());
            resolve(!!(j && (j.version != null || j.ok === true)));
          } catch (_) {
            resolve(false);
          }
        });
      });
      req.on('error', () => resolve(false));
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        resolve(false);
      });
    } catch (_) {
      resolve(false);
    }
  });
}

const SYSTEM_PROMPT = `你是一个工作区助手，可以在指定目录下执行文件操作。
你可以使用 read、write、edit、bash、glob、grep 等工具。
根据用户指令：创建/删除/重命名文件、创建目录、读取或修改文件内容，并简要回复执行结果。
工作目录由调用方传入，请在工具中使用绝对路径。`;

function parseModelSpec(spec) {
  const s = String(spec || '').trim();
  if (!s) return null;
  const idx = s.indexOf('/');
  if (idx === -1) return { providerID: 'opencode', modelID: s };
  const providerID = s.slice(0, idx).trim();
  const modelID = s.slice(idx + 1).trim();
  if (!providerID || !modelID) return null;
  return { providerID, modelID };
}

function uniqMessageID() {
  if (typeof crypto.randomUUID === 'function') return `msg_${crypto.randomUUID()}`;
  return `msg_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

async function getProvidersForDirectory(dir) {
  const res = await client.config.providers({ directory: dir });
  const data = res?.data ?? res;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.providers)) return data.providers;
  return [];
}

function getAvailableModelIDs(providers, providerID) {
  const p = providers.find((x) => x && x.id === providerID);
  const models = p && p.models ? p.models : {};
  return Object.keys(models || {});
}

async function resolveModelForDirectory(dir) {
  const providers = await getProvidersForDirectory(dir);
  const requested = parseModelSpec(REQUESTED_MODEL) || { providerID: 'opencode', modelID: 'gpt-5-nano' };

  const available = getAvailableModelIDs(providers, requested.providerID);
  const hasRequested = available.includes(requested.modelID);
  if (hasRequested) {
    return { model: requested, warning: null, availableModels: available, requestedModel: requested };
  }

  // Prefer gpt-5-nano, then trinity if present for this directory, otherwise pick the first available.
  const fallbackOrder = ['gpt-5-nano', 'trinity-large-preview-free'];
  const pickedModelID = fallbackOrder.find((m) => available.includes(m)) || available[0] || null;
  if (!pickedModelID) {
    return {
      model: null,
      warning: null,
      availableModels: available,
      requestedModel: requested,
    };
  }

  return {
    model: { providerID: requested.providerID, modelID: pickedModelID },
    warning: `请求的模型 ${requested.providerID}/${requested.modelID} 在该目录不可用，已改用 ${requested.providerID}/${pickedModelID}。`,
    availableModels: available,
    requestedModel: requested,
  };
}

function extractTextFromParts(parts) {
  const arr = Array.isArray(parts) ? parts : [];
  return arr
    .filter((p) => p && p.type === 'text' && p.text)
    .map((p) => p.text)
    .join('\n')
    .trim();
}

async function waitForAssistantReply({ dir, userText, startedAt, timeoutMs = 90_000, pollIntervalMs = 1000 }) {
  const deadline = Date.now() + timeoutMs;
  let userMessageID = null;
  while (Date.now() < deadline) {
    const msgRes = await client.session.messages({ sessionID: sessionId, directory: dir, limit: 50 });
    const msgs = (msgRes?.data ?? msgRes) || [];

    if (!userMessageID) {
      const candidates = [...msgs].reverse().filter((m) => m?.info?.role === 'user' && (m?.info?.time?.created ?? 0) >= (startedAt - 2000));
      const matched = candidates.find((m) => extractTextFromParts(m?.parts) === userText) || candidates[0];
      if (matched?.info?.id) userMessageID = matched.info.id;
    }

    if (userMessageID) {
      const assistant = [...msgs].reverse().find((m) => m?.info?.role === 'assistant' && m?.info?.parentID === userMessageID);
      if (assistant) {
        const text = extractTextFromParts(assistant.parts);
        return text || '(无文本回复)';
      }
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
  return null;
}

async function initAgent() {
  const ok = await checkReachable(BASE_URL);
  if (!ok) {
    console.warn('[agent-editor-demo] OpenCode 未就绪，请先运行: opencode serve');
    return;
  }
  try {
    const { createOpencodeClient } = await import('@opencode-ai/sdk/v2/client');
    client = createOpencodeClient({ baseUrl: BASE_URL });
    const createRes = await client.session.create({ title: 'Agent Editor Demo' });
    const session = createRes?.data ?? createRes;
    sessionId = session?.id;
    if (!sessionId) throw new Error('未返回 session id');
    console.log('[agent-editor-demo] OpenCode 已连接，session:', sessionId);
  } catch (e) {
    console.error('[agent-editor-demo] initAgent error:', e);
    client = null;
    sessionId = null;
  }
}

async function sendToAgent(text, workspaceDir) {
  if (!client || !sessionId) {
    return {
      ok: false,
      text: '',
      error: 'OpenCode 未连接。请先运行: opencode serve',
    };
  }
  const dir = (workspaceDir && path.isAbsolute(workspaceDir))
    ? workspaceDir
    : path.resolve(process.cwd(), workspaceDir || 'workspace');
  const userMessage = (text || '').trim();
  if (!userMessage) {
    return { ok: false, text: '', error: '请输入内容' };
  }
  try {
    const { model, warning, availableModels, requestedModel } = await resolveModelForDirectory(dir);
    if (!model) {
      const provider = requestedModel?.providerID || 'opencode';
      return {
        ok: false,
        text: '',
        error: `该目录下未找到可用模型（provider: ${provider}）。可用模型: ${availableModels.length ? availableModels.join(', ') : '(空)'}`,
      };
    }

    const startedAt = Date.now();
    await client.session.prompt({
      sessionID: sessionId,
      directory: dir,
      model,
      system: SYSTEM_PROMPT,
      parts: [{ type: 'text', text: userMessage }],
    });

    const reply = await waitForAssistantReply({ dir, userText: userMessage, startedAt });
    if (!reply) {
      return {
        ok: false,
        text: '',
        error: `等待回复超时。当前模型: ${model.providerID}/${model.modelID}。可用模型: ${availableModels.join(', ') || '(空)'}`,
      };
    }
    return {
      ok: true,
      text: warning ? `${warning}\n\n${reply}` : reply,
      error: null,
    };
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return { ok: false, text: '', error: msg };
  }
}

module.exports = { initAgent, sendToAgent, checkReachable, BASE_URL };
