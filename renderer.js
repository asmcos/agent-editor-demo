(function () {
  const logEl = document.getElementById('log');
  const inputEl = document.getElementById('input');
  const sendBtn = document.getElementById('send');
  const workspaceEl = document.getElementById('workspace');

  function append(className, text) {
    const div = document.createElement('div');
    div.className = className;
    div.textContent = text;
    logEl.appendChild(div);
    logEl.scrollTop = logEl.scrollHeight;
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
    setBusy(true);
    try {
      const workspaceDir = await window.agentDemo.getWorkspaceDir();
      setWorkspace(workspaceDir);
      const result = await window.agentDemo.sendMessage(text, workspaceDir);
      if (result && result.error) {
        append('error', 'Error: ' + result.error);
      } else if (result && result.text) {
        append('assistant', 'Agent: ' + result.text);
      } else {
        append('system', '(无回复)');
      }
    } catch (e) {
      append('error', 'Error: ' + (e && e.message ? e.message : String(e)));
    } finally {
      setBusy(false);
      if (logEl) logEl.scrollTop = logEl.scrollHeight;
    }
  }

  if (workspaceEl) {
    window.agentDemo.getWorkspaceDir().then(setWorkspace).catch(() => {});
    append('system', '请在下方输入指令。例如：在此目录创建 hello.txt、列出文件、删除某文件等。需先运行 opencode serve。');
  }
})();
