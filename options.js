// 단축키 설정 페이지 열기 버튼
document.getElementById("openShortcuts").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "openShortcutsPage" });
});

// 실제 등록된 단축키를 읽어서 뱃지 업데이트
chrome.commands.getAll((commands) => {
  commands.forEach((cmd) => {
    const shortcut = cmd.shortcut; // 빈 문자열이면 미설정
    if (!shortcut) return;

    const keys = shortcut.split("+");

    function renderBadge(targetId) {
      const container = document.getElementById(targetId);
      if (!container) return;
      container.innerHTML = keys
        .map((k, i) =>
          i < keys.length - 1
            ? `<kbd>${k}</kbd><span>+</span>`
            : `<kbd>${k}</kbd>`
        )
        .join("");
    }

    if (cmd.name === "_execute_action") renderBadge("badge-main");
    if (cmd.name === "alt-toggle")      renderBadge("badge-alt");
  });
});
