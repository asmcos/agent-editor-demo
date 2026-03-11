/**
 * LangChain ReAct Agent 封装（Ollama + 工作区文件工具）
 * 供 agent.js 通过 dynamic import 调用，不依赖 OpenCode。
 */
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { HumanMessage } from "@langchain/core/messages";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";
const model = process.env.OLLAMA_MODEL || "kimi-k2.5:cloud";

function createTools(cwd, editorContext) {
  const workDir = cwd || process.cwd();
  const editor = editorContext || { content: '', updatedContent: null };

  const createFileTool = new DynamicStructuredTool({
    name: "create_file",
    description: "在工作目录下创建或覆盖一个文件。",
    schema: z.object({
      filename: z.string().describe("文件名（如 'test.txt'）"),
      content: z.string().describe("文件内容"),
    }),
    func: async ({ filename, content }) => {
      try {
        const filePath = path.join(workDir, filename);
        await fs.mkdir(path.dirname(filePath), { recursive: true }).catch(() => {});
        await fs.writeFile(filePath, content, "utf-8");
        return `文件已创建：${filePath}`;
      } catch (error) {
        return `创建失败：${error.message}`;
      }
    },
  });

  const readFileTool = new DynamicStructuredTool({
    name: "read_file",
    description: "读取工作目录下的文件内容。",
    schema: z.object({
      filename: z.string().describe("文件名或相对路径"),
    }),
    func: async ({ filename }) => {
      try {
        const filePath = path.resolve(workDir, filename);
        if (!filePath.startsWith(workDir)) return "不允许读取工作目录外的文件。";
        const content = await fs.readFile(filePath, "utf-8");
        return content;
      } catch (error) {
        return `读取失败：${error.message}`;
      }
    },
  });

  const listDirTool = new DynamicStructuredTool({
    name: "list_dir",
    description: "列出工作目录下的文件和子目录。",
    schema: z.object({
      subdir: z.string().nullable().optional().describe("子目录名，不填则列当前工作目录"),
    }),
    func: async ({ subdir }) => {
      try {
        const dir = (subdir != null && String(subdir).trim() !== "") ? path.join(workDir, subdir) : workDir;
        if (!path.resolve(dir).startsWith(path.resolve(workDir))) return "不允许列出工作目录外。";
        const entries = await fs.readdir(dir, { withFileTypes: true });
        return entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).join("\n");
      } catch (error) {
        return `列出失败：${error.message}`;
      }
    },
  });

  const deleteFileTool = new DynamicStructuredTool({
    name: "delete_file",
    description: "删除工作目录下的文件。",
    schema: z.object({
      filename: z.string().describe("要删除的文件名或相对路径"),
    }),
    func: async ({ filename }) => {
      try {
        const filePath = path.resolve(workDir, filename);
        if (!filePath.startsWith(workDir)) return "不允许删除工作目录外的文件。";
        await fs.unlink(filePath);
        return `已删除：${filePath}`;
      } catch (error) {
        return `删除失败：${error.message}`;
      }
    },
  });

  const getEditorTool = new DynamicStructuredTool({
    name: "get_editor_content",
    description: "读取用户界面中「编辑框」的当前全文内容。用户说「编辑框」「当前文档」「上面的内容」时使用。",
    schema: z.object({}),
    func: async () => {
      return editor.content || "(编辑框为空)";
    },
  });

  const setEditorTool = new DynamicStructuredTool({
    name: "set_editor_content",
    description: "将用户界面中「编辑框」的内容替换为指定全文。用户要求「把编辑框改成」「写入编辑框」「更新上面的内容」时使用。",
    schema: z.object({
      content: z.string().describe("要写入编辑框的完整新内容"),
    }),
    func: async ({ content }) => {
      editor.updatedContent = typeof content === "string" ? content : String(content ?? "");
      return "已更新编辑框内容。";
    },
  });

  return [createFileTool, readFileTool, listDirTool, deleteFileTool, getEditorTool, setEditorTool];
}

let agentCache = null;
let lastCwd = null;

function getAgent(cwd, editorContext) {
  const resolved = path.resolve(cwd || process.cwd());
  const useCache = !editorContext || (editorContext.content === "" && editorContext.updatedContent == null);
  if (agentCache && lastCwd === resolved && useCache) return agentCache;
  if (!useCache) {
    lastCwd = null;
    agentCache = null;
  } else {
    lastCwd = resolved;
  }
  const llm = new ChatOpenAI({
    openAIApiKey: "ollama",
    configuration: { baseURL },
    model,
    temperature: 0.7,
  });
  agentCache = createReactAgent({
    llm,
    tools: createTools(resolved, editorContext),
  });
  return agentCache;
}

/**
 * 单轮对话，返回 AI 文本或错误；可选返回更新后的编辑框内容。
 * @param {string} userMessage - 用户输入
 * @param {string} cwd - 工作目录（工具在此目录下操作）
 * @param {{ editorContent?: string }} [options] - 当前编辑框内容，供 get_editor_content 读取；set_editor_content 会写入 updatedContent
 * @returns {Promise<{ text?: string, error?: string, updatedEditorContent?: string | null }>}
 */
export async function runLangchainAgent(userMessage, cwd, options = {}) {
  const message = (userMessage || "").trim();
  if (!message) return { error: "请输入内容" };

  const editorContext = { content: options.editorContent ?? "", updatedContent: null };

  try {
    const agent = getAgent(cwd, editorContext);
    const result = await agent.invoke({
      messages: [new HumanMessage(message)],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    const content = lastMessage && typeof lastMessage.content === "string" ? lastMessage.content : String(lastMessage?.content ?? "");
    return {
      text: content || "(无回复)",
      updatedEditorContent: editorContext.updatedContent ?? null,
    };
  } catch (error) {
    const msg = error && error.message ? error.message : String(error);
    return { error: msg };
  }
}
