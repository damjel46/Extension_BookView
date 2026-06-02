/**
 * background.js — Service Worker (MV3)
 */

// content.js 주입 — chrome:// 등 접근 불가 탭은 조용히 무시
function injectDualViewer(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"],
  }).catch(() => {
    // chrome://, edge://, 확장 페이지 등은 주입 불가 → 무시
  });
}

// 현재 활성 탭 ID를 안전하게 가져온 뒤 주입
function injectToActiveTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs.length > 0) injectDualViewer(tabs[0].id);
  });
}

// 아이콘 클릭 / Ctrl+Shift+S (_execute_action)
chrome.action.onClicked.addListener((tab) => {
  injectDualViewer(tab.id);
});

// 단축키 (alt-toggle 등 커스텀 커맨드)
// commands.onCommand 의 두 번째 인자 tab 은
// 일부 환경에서 undefined 일 수 있으므로 tabs.query 로 보완
chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "alt-toggle") return;

  if (tab?.id) {
    injectDualViewer(tab.id);
  } else {
    injectToActiveTab();
  }
});

// 옵션 페이지 → 단축키 설정 페이지 열기
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "openShortcutsPage") {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }
});
