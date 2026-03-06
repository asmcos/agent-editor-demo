# Agent Editor Demo

Electron + OpenCode 小项目，用于测试「对话驱动」的 Agent：聊天、创建/删除文件、创建目录等。

## 运行前

1. 先启动 OpenCode 服务（与本机已安装的 opencode 一致）：
   ```bash
   opencode serve
   ```
2. 再启动本应用：
   ```bash
   cd /home/jsh/work/agent-editor-demo
   npm install
   npm start
   ```

## 使用

- 在输入框输入指令，例如：
  - 「在 workspace 下创建一个 hello.txt，内容写 Hello World」
  - 「列出当前目录的文件」
  - 「把 hello.txt 改名为 hi.txt」
  - 「删除 hi.txt」
- Agent 会通过 OpenCode 的 read/write/edit 等工具在工作目录 `workspace/` 下执行操作，并在界面显示回复。

## 说明

- 工作目录默认为项目下的 `workspace/`。
- 未启动 OpenCode 时发送会提示「OpenCode 未连接」，请先运行 `opencode serve`。
