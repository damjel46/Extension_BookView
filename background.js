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

// 아이콘 클릭 / Ctrl+Shift+S (_execute_action)
chrome.action.onClicked.addListener((tab) => {
  injectDualViewer(tab.id);
});

// 옵션 페이지 → 단축키 설정 페이지 열기
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "openShortcutsPage") {
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  }
});
