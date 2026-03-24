/* ═══════════════════════════════════════════════════════════
   Voir — Table of Contents (scroll-position based)
   ═══════════════════════════════════════════════════════════ */

window.VoirToc = (() => {
  let entries = [];
  let scrollContainer = null;
  let ticking = false;
  let isUserClick = false;

  function render(tocEntries) {
    entries = tocEntries;
    const container = document.getElementById('toc-list');
    if (!container) return;

    container.innerHTML = '';

    entries.forEach((entry) => {
      const btn = document.createElement('button');
      btn.className = 'toc-item';
      btn.dataset.level = entry.level;
      btn.dataset.id = entry.id;
      btn.textContent = entry.text;
      btn.title = entry.text;

      btn.addEventListener('click', () => {
        const target = document.getElementById(entry.id);
        if (!target) return;

        // Flag to prevent scroll-spy from fighting the click
        isUserClick = true;
        setActive(entry.id);

        // Scroll the content area, not the whole page
        const container = document.getElementById('content-area');
        const targetTop = target.getBoundingClientRect().top
          - container.getBoundingClientRect().top
          + container.scrollTop
          - 20; // small offset from top

        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });

        // Release click lock after scroll settles
        setTimeout(() => { isUserClick = false; }, 800);
      });

      container.appendChild(btn);
    });

    setupScrollSpy();
  }

  function setupScrollSpy() {
    // Remove old listener if any
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', onScroll);
    }

    scrollContainer = document.getElementById('content-area');
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', onScroll, { passive: true });

    // Initial highlight
    requestAnimationFrame(updateActiveFromScroll);
  }

  function onScroll() {
    if (isUserClick) return; // Don't fight user click
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        updateActiveFromScroll();
        ticking = false;
      });
    }
  }

  function updateActiveFromScroll() {
    if (entries.length === 0) return;
    const container = document.getElementById('content-area');
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const offset = containerRect.top + 60; // threshold line (60px from container top)

    let activeId = entries[0].id; // default to first

    for (let i = entries.length - 1; i >= 0; i--) {
      const el = document.getElementById(entries[i].id);
      if (!el) continue;

      const rect = el.getBoundingClientRect();
      if (rect.top <= offset) {
        activeId = entries[i].id;
        break;
      }
    }

    // If scrolled to very bottom, activate the last entry
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 10) {
      activeId = entries[entries.length - 1].id;
    }

    setActive(activeId);
  }

  function setActive(id) {
    const tocItems = document.querySelectorAll('.toc-item');
    tocItems.forEach(el => {
      el.classList.toggle('active', el.dataset.id === id);
    });

    // Scroll the TOC panel to keep the active item visible
    const activeItem = document.querySelector('.toc-item.active');
    if (activeItem) {
      const tocList = document.getElementById('toc-list');
      if (tocList) {
        const itemRect = activeItem.getBoundingClientRect();
        const listRect = tocList.getBoundingClientRect();
        if (itemRect.bottom > listRect.bottom || itemRect.top < listRect.top) {
          activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    }
  }

  function clear() {
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', onScroll);
      scrollContainer = null;
    }
    const container = document.getElementById('toc-list');
    if (container) container.innerHTML = '';
    entries = [];
  }

  return { render, clear };
})();
