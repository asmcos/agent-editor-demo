(function () {
  const logEl = document.getElementById('log');
  const inputEl = document.getElementById('input');
  const editorEl = document.getElementById('editor');
  const sendBtn = document.getElementById('send');
  const workspaceEl = document.getElementById('workspace');

  function append(className, text, id) {
    const div = document.createElement('div');
    div.className = className;
    if (id) div.id = id;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
    return div;
  }

  function setWorkspace(dir) {
    if (workspaceEl && dir) workspaceEl.textContent = '工作目录: ' + dir;
  }

  let busy = false;
  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    sendBtn.textContent = b ? '…' : '发送';
  }

  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  async function send() {
    if (busy || !window.agentDemo) return;
    const text = (inputEl && inputEl.value || '').trim();
    if (!text) return;
    inputEl.value = '';
    append('user', 'You: ' + text);
    const loadingId = 'loading-' + Date.now();
    const loadingEl = append('loading', '思考中…', loadingId);
    setBusy(true);
    try {
      const workspaceDir = await window.agentDemo.getWorkspaceDir();
      setWorkspace(workspaceDir);
      const editorContent = (editorEl && editorEl.value) || '';
      const result = await window.agentDemo.sendMessage(text, workspaceDir, editorContent);
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();
      if (result && result.error) {
        append('error', 'Error: ' + result.error);
      } else if (result && result.text) {
        append('assistant', 'Agent: ' + result.text);
      } else {
        append('system', '(无回复)');
      }
      if (result && result.updatedEditorContent != null && editorEl) {
        editorEl.value = result.updatedEditorContent;
      }
    } catch (e) {
      if (loadingEl && loadingEl.parentNode) loadingEl.remove();
      append('error', 'Error: ' + (e && e.message ? e.message : String(e)));
    } finally {
      setBusy(false);
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }
  }

  if (workspaceEl) {
    window.agentDemo.getWorkspaceDir().then(setWorkspace).catch(() => {});
    append('system', '请在下方输入指令。例如：在此目录创建 hello.txt、列出文件、读取/删除某文件等。编辑框内容可被 Agent 读取或更新。需先运行 ollama serve。');
  }
})();
