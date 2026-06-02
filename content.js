/**
 * content.js — Smart Dual Viewer 핵심 로직
 *
 * 아이콘 / 단축키로 ON / OFF 토글.
 *
 * ─ 렌더링 전략 ───────────────────────────────────
 *   document.body 전체 자식을 DocumentFragment로 복제.
 *   <head> CSS는 같은 document를 공유하므로 별도 복사 불필요.
 *
 * ─ fixed/sticky 처리 ─────────────────────────────
 *   sticky  → 그대로 유지 (overflow:scroll 패널 안에서 정상 동작)
 *   fixed (상단 헤더, top<100px) → sticky로 변환, 각 패널 상단에 고정
 *   fixed (하단 광고·채팅·앱셸) → display:none
 *
 * ─ 레이아웃 모드 ─────────────────────────────────
 *   ↔ 스크롤 : 원본 너비 유지, 가로 스크롤 허용
 *   ⬜ 맞춤  : 미디어·테이블·코드만 제한 (flex/grid 레이아웃 보존)
 *
 * ─ 뷰 모드 ───────────────────────────────────────
 *   🖥 데스크톱 : 패널 전체 너비 (기본)
 *   📱 모바일   : 390px 컬럼 + 회색 여백
 *
 * 사용자 설정은 chrome.storage.local 에 영구 저장.
 */
(function () {
  "use strict";

  const OVERLAY_ID = "__sdv_overlay__";
  const TOOLBAR_ID = "__sdv_toolbar__";
  const STYLE_ID   = "__sdv_style__";

  /* ─── 1. 토글 OFF ─────────────────────────────── */
  if (document.getElementById(OVERLAY_ID)) {
    document.getElementById(OVERLAY_ID).remove();
    document.getElementById(TOOLBAR_ID)?.remove();
    document.getElementById(STYLE_ID)?.remove();
    document.documentElement.style.overflow = "";
    return;
  }

  /* ─── 2. 반응형(모바일) 지원 여부 감지 ──────────
   *  두 가지를 모두 확인:
   *  ① viewport meta 에 width=device-width 포함
   *  ② stylesheet 에 width 기반 미디어쿼리 존재
   * ─────────────────────────────────────────────── */
  function detectMobileSupport() {
    // ① viewport meta 확인
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return false;
    const metaContent = (meta.getAttribute("content") || "").toLowerCase();
    if (!metaContent.includes("width=device-width")) return false;

    // ② CSS 미디어쿼리(max-width / min-width) 확인
    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules || []) {
            if (rule.type === CSSRule.MEDIA_RULE) {
              const media = rule.conditionText || rule.media?.mediaText || "";
              if (/max-width|min-width/i.test(media)) return true;
            }
          }
        } catch (_) {
          // cross-origin stylesheet 접근 불가 → 건너뜀
          // viewport meta 가 있으면 일단 반응형으로 간주
          return true;
        }
      }
    } catch (_) {}

    return false;
  }

  const mobileSupported = detectMobileSupport();

  /* ─── 3. 공유 스타일시트 ──────────────────────── */
  const styleEl = document.createElement("style");
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    /* ── 공통 패널 ── */
    #__sdv_left__, #__sdv_right__ {
      flex: 0 0 50%;
      width: 50%;
      height: 100vh;
      overflow-y: scroll;
      box-sizing: border-box;
      background: #fff;
      transition: background 0.2s;
      overflow-anchor: none;
    }
    #__sdv_left__ { border-right: 2px solid #d0d0d0; }

    /* ── 스크롤 모드 : 원본 너비 유지 ── */
    #__sdv_overlay__.sdv-scroll #__sdv_left__,
    #__sdv_overlay__.sdv-scroll #__sdv_right__ {
      overflow-x: auto;
    }

    /* ── 맞춤 모드 : 미디어·테이블·코드만 제한 ── */
    #__sdv_overlay__.sdv-fit #__sdv_left__,
    #__sdv_overlay__.sdv-fit #__sdv_right__ {
      overflow-x: hidden;
    }
    #__sdv_overlay__.sdv-fit img,
    #__sdv_overlay__.sdv-fit video,
    #__sdv_overlay__.sdv-fit iframe,
    #__sdv_overlay__.sdv-fit embed,
    #__sdv_overlay__.sdv-fit svg,
    #__sdv_overlay__.sdv-fit canvas,
    #__sdv_overlay__.sdv-fit figure,
    #__sdv_overlay__.sdv-fit picture {
      max-width: 100% !important;
      height: auto !important;
    }
    #__sdv_overlay__.sdv-fit pre,
    #__sdv_overlay__.sdv-fit code {
      white-space: pre-wrap !important;
      word-break: break-all !important;
    }
    #__sdv_overlay__.sdv-fit table {
      table-layout: fixed !important;
      width: 100% !important;
    }

    /* ── 모바일 뷰 : 390px 컬럼 + 회색 여백 ── */
    #__sdv_overlay__.sdv-mobile #__sdv_left__,
    #__sdv_overlay__.sdv-mobile #__sdv_right__ {
      background: #c9c9c9;
      overflow-x: hidden;
    }
    #__sdv_overlay__.sdv-mobile .sdv-content-wrap {
      max-width: 390px;
      width: 390px;
      margin: 0 auto;
      background: #fff;
      min-height: 100%;
      box-shadow: 0 0 24px rgba(0,0,0,0.18);
      overflow: hidden;
    }
    #__sdv_overlay__.sdv-mobile img,
    #__sdv_overlay__.sdv-mobile video,
    #__sdv_overlay__.sdv-mobile iframe,
    #__sdv_overlay__.sdv-mobile embed,
    #__sdv_overlay__.sdv-mobile svg,
    #__sdv_overlay__.sdv-mobile canvas,
    #__sdv_overlay__.sdv-mobile figure,
    #__sdv_overlay__.sdv-mobile picture {
      max-width: 100% !important;
      height: auto !important;
    }
    #__sdv_overlay__.sdv-mobile pre,
    #__sdv_overlay__.sdv-mobile code {
      white-space: pre-wrap !important;
      word-break: break-all !important;
    }
    #__sdv_overlay__.sdv-mobile table {
      table-layout: fixed !important;
      width: 100% !important;
    }
  `;
  document.head.appendChild(styleEl);

  /* ─── 3. body 전체 복제 ────────────────────────
   *  document.body의 직접 자식들을 DocumentFragment로 복제.
   *  sdv 자체 요소(overlay/toolbar/style)는 제외.
   *  <head> CSS는 같은 document 공유이므로 별도 복사 불필요.
   * ─────────────────────────────────────────────── */
  function cloneBody() {
    const frag = document.createDocumentFragment();
    Array.from(document.body.childNodes).forEach((node) => {
      if (
        node.id === OVERLAY_ID ||
        node.id === TOOLBAR_ID ||
        node.id === STYLE_ID
      ) return;
      frag.appendChild(node.cloneNode(true));
    });
    return frag;
  }

  const leftWrap  = document.createElement("div");
  leftWrap.className  = "sdv-content-wrap";
  leftWrap.appendChild(cloneBody());

  const rightWrap = document.createElement("div");
  rightWrap.className = "sdv-content-wrap";
  rightWrap.appendChild(cloneBody());

  /* ─── 4. fixed / sticky 3-분류 처리 ─────────────
   *  sticky  → 건드리지 않음
   *            (overflow:scroll 패널 안에서 정상 동작)
   *  fixed (top<100px, bottom 없음, 작은 요소)
   *          → sticky + 원래 top 유지
   *            각 패널 상단에 자연스럽게 고정됨
   *  fixed (나머지: 광고·채팅·쿠키·앱셸)
   *          → display:none (패널 양쪽 중복 방지)
   * ─────────────────────────────────────────────── */
  function neutralizeFixed(root) {
    root.querySelectorAll("*").forEach((el) => {
      try {
        const cs  = window.getComputedStyle(el);
        const pos = cs.position;

        if (pos === "sticky") return; // 건드리지 않음

        if (pos === "fixed") {
          const topRaw    = cs.top;
          const topVal    = parseFloat(topRaw);
          const hasBottom = cs.bottom !== "auto" && cs.bottom !== "";
          const isPercent = topRaw.includes("%");
          // 뷰포트 전체를 덮는 앱 셸은 숨김 (높이 > 뷰포트 60%)
          const isBigShell = el.offsetHeight > window.innerHeight * 0.6;

          const isTopHeader =
            !hasBottom &&
            !isPercent &&
            !isNaN(topVal) &&
            topVal < 100 &&
            !isBigShell;

          if (isTopHeader) {
            // 패널 상단에 sticky로 재고정
            el.style.position = "sticky";
            el.style.top      = topRaw;
            el.style.left     = "";   // 패널 흐름 기준으로 복귀
            el.style.right    = "";
            el.style.width    = "";   // 강제 vw 폭 해제
            el.style.zIndex   = "10"; // 패널 내부 z-index
          } else {
            // 광고·채팅·쿠키 배너·사이드 고정 → 숨김
            el.style.display = "none";
          }
        }
      } catch (_) {
        // cross-origin iframe 등 접근 불가 요소 무시
      }
    });
  }

  /* ─── 5. 패널 생성 ────────────────────────────── */
  const leftPanel  = document.createElement("div");
  leftPanel.id     = "__sdv_left__";

  const rightPanel = document.createElement("div");
  rightPanel.id    = "__sdv_right__";

  /* ─── 6. 페이지 뱃지 (sticky) ────────────────── */
  function makeBadge(label, alignRight) {
    const b = document.createElement("div");
    b.textContent = label;
    b.style.cssText = `
      position: sticky; top: 8px;
      ${alignRight
        ? "float: right; margin: 8px 14px 0 0;"
        : "float: left;  margin: 8px 0 0 14px;"}
      padding: 3px 10px;
      background: rgba(0,0,0,0.52); color: #fff;
      border-radius: 12px;
      font: 700 11px/1.6 system-ui, sans-serif;
      letter-spacing: 0.4px; pointer-events: none; z-index: 999;
    `;
    return b;
  }

  leftPanel.appendChild(makeBadge("◀ Left", true));
  leftPanel.appendChild(leftWrap);

  rightPanel.appendChild(makeBadge("Right ▶", false));
  rightPanel.appendChild(rightWrap);

  /* ─── 7. 오버레이 ─────────────────────────────── */
  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.style.cssText = `
    position: fixed; inset: 0;
    display: flex; flex-direction: row;
    z-index: 2147483646; overflow: hidden;
  `;
  overlay.appendChild(leftPanel);
  overlay.appendChild(rightPanel);

  /* ─── 8. 툴바 ─────────────────────────────────── */
  const toolbar = document.createElement("div");
  toolbar.id = TOOLBAR_ID;
  toolbar.style.cssText = `
    position: fixed; top: 0; left: 50%;
    transform: translateX(-50%) translateY(-110%);
    z-index: 2147483647;
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px;
    background: rgba(18,18,18,0.88);
    border-radius: 0 0 18px 18px;
    transition: transform 0.22s cubic-bezier(0.4,0,0.2,1);
    pointer-events: none;
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
  `;

  function makeBtn(label, title) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.title = title;
    btn.style.cssText = `
      padding: 4px 13px;
      background: transparent; color: rgba(255,255,255,0.75);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 12px; cursor: pointer;
      font: 600 12px system-ui, sans-serif; letter-spacing: 0.3px;
      transition: background 0.13s, color 0.13s, border-color 0.13s;
      white-space: nowrap;
    `;
    return btn;
  }

  function makeSep() {
    const d = document.createElement("div");
    d.style.cssText = `
      width: 1px; height: 18px;
      background: rgba(255,255,255,0.18); margin: 0 2px; flex-shrink: 0;
    `;
    return d;
  }

  function setActive(btn, on) {
    btn.style.background  = on ? "rgba(255,255,255,0.18)" : "transparent";
    btn.style.color       = on ? "#fff"                   : "rgba(255,255,255,0.6)";
    btn.style.borderColor = on ? "rgba(255,255,255,0.5)"  : "rgba(255,255,255,0.18)";
  }

  /* ── 닫기 ── */
  const closeBtn = makeBtn("✕  Close", "Close BookView");
  closeBtn.style.borderColor = "rgba(255,100,100,0.35)";
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.background  = "rgba(210,50,50,0.85)";
    closeBtn.style.borderColor = "transparent";
    closeBtn.style.color       = "#fff";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.background  = "transparent";
    closeBtn.style.borderColor = "rgba(255,100,100,0.35)";
    closeBtn.style.color       = "rgba(255,255,255,0.75)";
  });
  closeBtn.addEventListener("click", () => {
    overlay.remove(); toolbar.remove(); styleEl.remove();
    document.documentElement.style.overflow = "";
  });

  /* ── 레이아웃 모드 (스크롤 / 맞춤) ── */
  const scrollBtn = makeBtn("↔  Scroll", "Keep original width + horizontal scroll");
  const fitBtn    = makeBtn("⬜  Fit",    "Shrink media & tables to fit panel width");
  let currentMode = "scroll";

  function applyMode(mode, save = true) {
    currentMode = mode;
    overlay.classList.remove("sdv-scroll", "sdv-fit");
    overlay.classList.add(mode === "scroll" ? "sdv-scroll" : "sdv-fit");
    setActive(scrollBtn, mode === "scroll");
    setActive(fitBtn,    mode === "fit");
    if (save) chrome.storage.local.set({ sdv_mode: mode });
  }

  function addHover(btn, isActiveCheck) {
    btn.addEventListener("mouseenter", () => {
      if (!isActiveCheck()) btn.style.background = "rgba(255,255,255,0.10)";
    });
    btn.addEventListener("mouseleave", () => {
      if (!isActiveCheck()) btn.style.background = "transparent";
    });
  }
  addHover(scrollBtn, () => currentMode === "scroll");
  addHover(fitBtn,    () => currentMode === "fit");
  scrollBtn.addEventListener("click", () => applyMode("scroll"));
  fitBtn.addEventListener("click",    () => applyMode("fit"));

  /* ── 뷰 모드 (데스크톱 / 모바일) ── */
  const deskBtn   = makeBtn("🖥  Desktop", "Use full panel width");
  const mobileBtn = makeBtn(
    "📱  Mobile",
    mobileSupported
      ? "Simulate 390px phone width"
      : "This site does not support responsive layout"
  );
  let isMobile = false;

  // 미지원 사이트 → 모바일 버튼 비활성화 스타일
  if (!mobileSupported) {
    mobileBtn.disabled = true;
    mobileBtn.style.opacity      = "0.3";
    mobileBtn.style.cursor       = "not-allowed";
    mobileBtn.style.borderStyle  = "dashed";
    mobileBtn.style.pointerEvents = "none";
  }

  function applyMobileView(on, save = true) {
    // 미지원 사이트에서 on 요청이 오면 무시
    if (on && !mobileSupported) return;

    isMobile = on;
    if (on) overlay.classList.add("sdv-mobile");
    else    overlay.classList.remove("sdv-mobile");
    setActive(deskBtn,   !on);
    if (mobileSupported) setActive(mobileBtn, on);
    if (save) chrome.storage.local.set({ sdv_mobile: on });
  }

  addHover(deskBtn, () => !isMobile);
  // 모바일 버튼은 지원되는 사이트에서만 hover 적용
  if (mobileSupported) addHover(mobileBtn, () => isMobile);

  deskBtn.addEventListener("click",   () => applyMobileView(false));
  mobileBtn.addEventListener("click", () => applyMobileView(true));

  /* ── 툴바 조립 ── */
  toolbar.appendChild(closeBtn);
  toolbar.appendChild(makeSep());
  toolbar.appendChild(scrollBtn);
  toolbar.appendChild(fitBtn);
  toolbar.appendChild(makeSep());
  toolbar.appendChild(deskBtn);
  toolbar.appendChild(mobileBtn);

  /* ─── 9. 마우스 상단 접근 시 툴바 슬라이드 다운 ── */
  const TRIGGER_Y = 50;
  document.addEventListener("mousemove", (e) => {
    const show = e.clientY <= TRIGGER_Y;
    toolbar.style.transform     = show
      ? "translateX(-50%) translateY(0)"
      : "translateX(-50%) translateY(-110%)";
    toolbar.style.pointerEvents = show ? "auto" : "none";
  });

  /* ─── 10. DOM 삽입 & 원본 스크롤 잠금 ────────── */
  document.body.appendChild(overlay);
  document.body.appendChild(toolbar);
  document.documentElement.style.overflow = "hidden";

  /* ─── 11. fixed/sticky 3-분류 처리 (삽입 후 실행) ─
   *  getComputedStyle이 정확하려면 DOM에 삽입된 뒤 호출해야 함
   * ─────────────────────────────────────────────── */
  neutralizeFixed(leftPanel);
  neutralizeFixed(rightPanel);

  /* ─── 12. 초기 스크롤 위치 — 리스너 등록 전에 설정 ─
   *  리스너가 없는 상태에서 scrollTop을 건드려야
   *  초기화 시점의 의도치 않은 이벤트 체인을 막을 수 있음.
   * ─────────────────────────────────────────────── */
  rightPanel.scrollTop = rightPanel.clientHeight;

  /* ─── 13. 스크롤 동기화 ─────────────────────────
   *
   *  [기존 2-flag 방식의 문제]
   *  Chrome에서 scrollTop 설정 시 scroll 이벤트가 비동기
   *  (렌더링 파이프라인)로 발화됨. 플래그를 동기로 false로
   *  되돌리면 유도된 이벤트가 발화될 때 이미 풀려있어
   *  무한루프가 발생함.
   *
   *  [해결: requestAnimationFrame으로 플래그 해제]
   *  rAF는 렌더링 파이프라인의 scroll 단계 이후에 실행됨.
   *  유도된 scroll 이벤트가 완전히 처리된 뒤에 잠금 해제.
   *
   *  좌 → 우: rightPanel.scrollTop = left + 뷰포트높이
   *  우 → 좌: leftPanel.scrollTop  = right - 뷰포트높이
   * ─────────────────────────────────────────────── */
  let isScrollSyncing = false;

  leftPanel.addEventListener("scroll", () => {
    if (isScrollSyncing) return;
    isScrollSyncing = true;
    rightPanel.scrollTop = leftPanel.scrollTop + rightPanel.clientHeight;
    requestAnimationFrame(() => { isScrollSyncing = false; });
  });

  rightPanel.addEventListener("scroll", () => {
    if (isScrollSyncing) return;
    isScrollSyncing = true;
    leftPanel.scrollTop = rightPanel.scrollTop - leftPanel.clientHeight;
    requestAnimationFrame(() => { isScrollSyncing = false; });
  });

  /* ─── 14. 리사이즈 대응 ──────────────────────── */
  window.addEventListener("resize", () => {
    isScrollSyncing = true;
    rightPanel.scrollTop = leftPanel.scrollTop + rightPanel.clientHeight;
    requestAnimationFrame(() => { isScrollSyncing = false; });
  });

  /* ─── 15. 저장된 설정 불러오기 ───────────────────
   *  스크롤 리스너 등록 뒤 마지막에 실행.
   *  CSS 클래스 변경(applyMode/applyMobileView)이 레이아웃
   *  리플로우를 유발할 수 있으므로, 변경 후 scrollTop을
   *  재설정해서 scroll anchoring 보정값을 덮어씀.
   *
   *  마지막 설정이 모바일이었으나 현재 사이트가 미지원이면
   *  임시로 데스크톱으로 전환 (저장하지 않음 → save=false).
   * ─────────────────────────────────────────────── */
  chrome.storage.local.get(
    { sdv_mode: "scroll", sdv_mobile: false },
    ({ sdv_mode, sdv_mobile }) => {
      applyMode(sdv_mode, false);

      if (sdv_mobile && !mobileSupported) {
        applyMobileView(false, false);
      } else {
        applyMobileView(sdv_mobile, false);
      }

      // CSS 클래스 변경 후 scrollTop 재확정
      // (scroll anchoring이 보정한 값을 덮어씀)
      isScrollSyncing = true;
      rightPanel.scrollTop = leftPanel.scrollTop + rightPanel.clientHeight;
      requestAnimationFrame(() => { isScrollSyncing = false; });
    }
  );
})();
