# Agent Editor Demo

Electron + LangChain ReAct Agent，用于测试「对话驱动」的 Agent：聊天、创建/读取/删除文件等。**不再依赖 OpenCode**，直接使用 Ollama。

## 运行前

1. 先启动 Ollama 服务（本机需已安装 [Ollama](https://ollama.com)）：
   ```bash
   ollama serve
   ```
   并确保已拉取示例中用到的模型（如 `kimi-k2.5:cloud` 或你在 `langchain-agent.js` 里配置的模型）。

2. 再启动本应用：
   ```bash
   cd agent-editor-demo
   npm install
   npm start
   ```

## 使用

- 在输入框输入指令，例如：
  - 「在 workspace 下创建一个 hello.txt，内容写 Hello World」
  - 「列出当前目录的文件」
  - 「读取 hello.txt 的内容」
  - 「删除 hello.txt」
- Agent 会通过 LangChain ReAct 的 `create_file` / `read_file` / `list_dir` / `delete_file` 等工具在工作目录 `workspace/` 下执行操作，并在界面显示回复。

## 说明

- 工作目录默认为项目下的 `workspace/`。
- 模型与地址：在 `langchain-agent.js` 中固定为 Ollama（默认 `http://localhost:11434/v1`，模型 `kimi-k2.5:cloud`）。可通过环境变量 `OLLAMA_BASE_URL`、`OLLAMA_MODEL` 覆盖。
