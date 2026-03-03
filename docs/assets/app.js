// Cibono — app.js
// 1. 현재 페이지(active nav) 자동 표시
// 2. 모달/오버레이/토글 UI
// 3. 커스텀 Select Dropdown (Body Portal)

(function () {
  'use strict';

  /* ── 1. Active Nav ────────────────────────────────────────── */
  const file = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const navMap = {
    'index.html': 'dashboard',
    'deals.html': 'deals',
    'alerts.html': 'alerts',
    'rules.html': 'rules',
    'inventory.html': 'inventory',
    'recommend.html': 'recommend',
  };
  const current = navMap[file] || 'dashboard';
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.setAttribute('aria-current', a.getAttribute('data-nav') === current ? 'page' : 'false');
  });

  /* ── 2. Modal / Toggle ────────────────────────────────────── */
  document.addEventListener('click', e => {
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) {
      const el = document.getElementById(openBtn.getAttribute('data-open'));
      if (el) { el.dataset.open = 'true'; el.setAttribute('aria-hidden', 'false'); }
    }

    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
      const el = document.getElementById(closeBtn.getAttribute('data-close'));
      if (el) { el.dataset.open = 'false'; el.setAttribute('aria-hidden', 'true'); }
    }

    if (e.target.classList.contains('modalOverlay')) {
      e.target.dataset.open = 'false';
      e.target.setAttribute('aria-hidden', 'true');
    }

    const t = e.target.closest('.toggle');
    if (t) {
      t.setAttribute('data-on', t.getAttribute('data-on') === 'true' ? 'false' : 'true');
    }

    /* ── 탭 전환: [data-tab] 클릭 시 대응 [data-panel] 표시 ── */
    const tabEl = e.target.closest('[data-tab]');
    if (tabEl) {
      const tabKey = tabEl.getAttribute('data-tab');
      const tabList = tabEl.closest('[role="tablist"]');
      if (tabList) {
        /* 모든 탭 비활성화 */
        tabList.querySelectorAll('[role="tab"]').forEach(t => {
          t.setAttribute('aria-selected', 'false');
        });
        /* 클릭한 탭 활성화 */
        tabEl.setAttribute('aria-selected', 'true');
      }

      /* 같은 section 안의 패널 전환 */
      const section = tabEl.closest('section') || tabEl.closest('.container');
      if (section) {
        section.querySelectorAll('[data-panel]').forEach(panel => {
          const isTarget = panel.getAttribute('data-panel') === tabKey;
          /* fade 효과를 위해 transition 사용 */
          if (isTarget) {
            panel.style.display = 'block';
            requestAnimationFrame(() => {
              panel.style.opacity = '1';
              panel.style.transform = 'translateY(0)';
            });
          } else {
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(4px)';
            setTimeout(() => { panel.style.display = 'none'; }, 180);
          }
        });
      }
    }
  });


  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modalOverlay[data-open="true"]').forEach(m => {
        m.dataset.open = 'false';
        m.setAttribute('aria-hidden', 'true');
      });
    }
  });

})();


/* ── 3. Custom Select Dropdown — Body Portal ─────────────────
   .field 안의 <select>를 Glassmorphism 패널로 교체.
   패널은 <body>에 fixed 포지셔닝으로 append → overflow 클리핑 없음
──────────────────────────────────────────────────────────────*/
(function initCustomSelects() {
  'use strict';

  let activePanel = null;
  let activeWrapper = null;

  /* 모든 열린 드롭다운 닫기 */
  function closeAll() {
    if (!activePanel) return;
    activePanel.classList.remove('open');
    if (activeWrapper) activeWrapper.setAttribute('aria-expanded', 'false');
    const p = activePanel;
    setTimeout(() => { if (p) p.style.display = 'none'; }, 220);
    activePanel = null;
    activeWrapper = null;
  }

  function buildCustomSelect(nativeSelect) {
    if (nativeSelect.dataset.customized) return;
    nativeSelect.dataset.customized = 'true';

    const field = nativeSelect.closest('.field');
    if (!field) return;

    const opts = Array.from(nativeSelect.options);
    let selIdx = nativeSelect.selectedIndex;

    /* trigger wrapper */
    const wrapper = document.createElement('div');
    wrapper.className = 'customSelect';
    wrapper.setAttribute('aria-haspopup', 'listbox');
    wrapper.setAttribute('aria-expanded', 'false');
    wrapper.tabIndex = 0;

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'csTriggerLabel';
    triggerLabel.textContent = opts[selIdx]?.text ?? '';

    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    arrow.setAttribute('viewBox', '0 0 24 24');
    arrow.setAttribute('class', 'cssArrow');
    arrow.innerHTML = '<path d="M6 9l6 6 6-6"/>';

    const trigger = document.createElement('div');
    trigger.className = 'cssTrigger';
    trigger.appendChild(triggerLabel);
    trigger.appendChild(arrow);
    wrapper.appendChild(trigger);

    /* panel — body에 portal */
    const panel = document.createElement('ul');
    panel.className = 'cssPanel';
    panel.setAttribute('role', 'listbox');
    panel.style.display = 'none';
    document.body.appendChild(panel);

    opts.forEach((opt, i) => {
      const li = document.createElement('li');
      li.className = 'cssOption' + (i === selIdx ? ' selected' : '');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === selIdx));
      li.dataset.idx = i;

      /* dot indicator */
      if (i === selIdx) {
        const dot = document.createElement('span');
        dot.className = 'csDot';
        li.appendChild(dot);
      }

      const txt = document.createElement('span');
      txt.textContent = opt.text;
      li.appendChild(txt);

      li.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();

        nativeSelect.selectedIndex = i;
        nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        triggerLabel.textContent = opt.text;
        selIdx = i;

        /* selected 갱신 */
        panel.querySelectorAll('.cssOption').forEach((el, idx) => {
          const hasDot = el.querySelector('.csDot');
          if (idx === i) {
            el.classList.add('selected');
            el.setAttribute('aria-selected', 'true');
            if (!hasDot) {
              const dot = document.createElement('span');
              dot.className = 'csDot';
              el.insertBefore(dot, el.firstChild);
            }
          } else {
            el.classList.remove('selected');
            el.setAttribute('aria-selected', 'false');
            if (hasDot) hasDot.remove();
          }
        });

        closePanel();
      });

      panel.appendChild(li);
    });

    /* 네이티브 select 숨기기 */
    nativeSelect.style.display = 'none';
    field.appendChild(wrapper);

    function openPanel() {
      if (activePanel && activePanel !== panel) closeAll();

      const rect = field.getBoundingClientRect();    /* field 버튼 너비 기준 */
      const spaceBelow = window.innerHeight - rect.bottom;
      const goUp = spaceBelow < 180;

      panel.style.display = 'block';
      panel.style.position = 'fixed';
      panel.style.width = 'auto';                    /* 내용 길이에 맞춤 */
      panel.style.minWidth = rect.width + 'px';      /* 최소는 버튼 너비 */
      panel.style.maxWidth = '260px';                /* 최대 너비 제한 */
      panel.style.left = rect.left + 'px';           /* 버튼 왼쪽 끝 정렬 */
      panel.style.zIndex = '9999';
      panel.classList.toggle('dropup', goUp);

      if (goUp) {
        panel.style.top = 'auto';
        panel.style.bottom = (window.innerHeight - rect.top + 8) + 'px';
      } else {
        panel.style.top = (rect.bottom + 8) + 'px';
        panel.style.bottom = 'auto';
      }

      /* double rAF → transition 발동 */
      requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('open')));

      wrapper.setAttribute('aria-expanded', 'true');
      activePanel = panel;
      activeWrapper = wrapper;
    }


    function closePanel() {
      panel.classList.remove('open');
      wrapper.setAttribute('aria-expanded', 'false');
      const p = panel;
      setTimeout(() => { p.style.display = 'none'; }, 220);
      if (activePanel === panel) { activePanel = null; activeWrapper = null; }
    }

    wrapper.addEventListener('click', e => {
      e.stopPropagation();
      wrapper.getAttribute('aria-expanded') === 'true' ? closePanel() : openPanel();
    });

    wrapper.addEventListener('keydown', e => {
      if (e.key === 'Escape') closePanel();
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPanel(); }
    });
  }

  /* 외부 클릭 / 스크롤 / 리사이즈 시 닫기 */
  document.addEventListener('click', e => {
    if (!e.target.closest('.customSelect') && !e.target.closest('.cssPanel')) closeAll();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });
  window.addEventListener('scroll', closeAll, true);
  window.addEventListener('resize', closeAll);

  function init() {
    document.querySelectorAll('.field select').forEach(buildCustomSelect);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
