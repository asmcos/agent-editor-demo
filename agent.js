import path from 'path';
import http from 'http';
import https from 'https';

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export function checkOllamaReachable(url, timeoutMs = 3000) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const base = `${u.protocol}//${u.host}`;
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.get(base, { timeout: timeoutMs }, (res) => {
        resolve(res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    } catch (_) {
      resolve(false);
    }
  });
}

export async function initAgent() {
  const ok = await checkOllamaReachable(OLLAMA_URL);
  if (!ok) {
    console.warn('[agent-editor-demo] Ollama 未检测到，请确保已运行 ollama serve（默认 http://localhost:11434）');
  } else {
    console.log('[agent-editor-demo] Ollama 已就绪');
  }
}

export async function sendToAgent(text, workspaceDir, editorContent) {
  const dir = (workspaceDir && path.isAbsolute(workspaceDir))
    ? workspaceDir
    : path.resolve(process.cwd(), workspaceDir || 'workspace');
  const userMessage = (text || '').trim();
  if (!userMessage) {
    return { ok: false, text: '', error: '请输入内容', updatedEditorContent: null };
  }

  try {
    const { runLangchainAgent } = await import('./langchain-agent.js');
    const result = await runLangchainAgent(userMessage, dir, { editorContent: editorContent ?? '' });
    if (result.error) {
      return { ok: false, text: '', error: result.error, updatedEditorContent: null };
    }
    return {
      ok: true,
      text: result.text || '(无回复)',
      error: null,
      updatedEditorContent: result.updatedEditorContent ?? null,
    };
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return { ok: false, text: '', error: msg, updatedEditorContent: null };
  }
}
