/* ═══════════════════════════════════════════════════════════
   Voir — Search (with Pinned Highlights)
   ═══════════════════════════════════════════════════════════ */

window.VoirSearch = (() => {
  let matches = [];
  let currentIndex = -1;
  let pinnedSearches = []; // [{ query, className, caseSensitive }]
  const MAX_PINNED = 5;
  const HIGHLIGHT_CLASS = 'search-highlight';

  function open() {
    const overlay = document.getElementById('search-overlay');
    overlay.classList.remove('hidden');
    const input = document.getElementById('search-input');
    input.focus();
    input.select();
  }

  function close() {
    document.getElementById('search-overlay').classList.add('hidden');
    clearSearchHighlights();
    matches = [];
    currentIndex = -1;
    updateCount();
  }

  function toggle() {
    const overlay = document.getElementById('search-overlay');
    if (overlay.classList.contains('hidden')) {
      open();
    } else {
      close();
    }
  }

  /** Perform search within rendered markdown */
  function search(query, caseSensitive = false) {
    clearSearchHighlights();
    matches = [];
    currentIndex = -1;

    if (!query) {
      updateCount();
      return;
    }

    const body = document.getElementById('markdown-body');
    if (!body) return;

    highlightText(body, query, caseSensitive, HIGHLIGHT_CLASS);

    matches = Array.from(body.querySelectorAll(`.${HIGHLIGHT_CLASS}`));
    if (matches.length > 0) {
      currentIndex = 0;
      scrollToCurrent();
    }
    updateCount();
  }

  function next() {
    if (matches.length === 0) return;
    matches[currentIndex]?.classList.remove('current');
    currentIndex = (currentIndex + 1) % matches.length;
    scrollToCurrent();
    updateCount();
  }

  function prev() {
    if (matches.length === 0) return;
    matches[currentIndex]?.classList.remove('current');
    currentIndex = (currentIndex - 1 + matches.length) % matches.length;
    scrollToCurrent();
    updateCount();
  }

  function scrollToCurrent() {
    if (currentIndex >= 0 && currentIndex < matches.length) {
      const el = matches[currentIndex];
      el.classList.add('current');

      // Scroll content-area only (not the whole page)
      const container = document.getElementById('content-area');
      if (container) {
        const containerRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const targetTop = elRect.top - containerRect.top + container.scrollTop - container.clientHeight / 2;
        container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
      }
    }
  }

  function updateCount() {
    const el = document.getElementById('search-count');
    if (!el) return;
    if (matches.length === 0) {
      el.textContent = '';
    } else {
      el.textContent = `${currentIndex + 1}/${matches.length}`;
    }
  }

  /** Pin current search as a permanent highlight */
  function pinSearch() {
    const input = document.getElementById('search-input');
    const query = input.value.trim();
    if (!query) return;

    // Check if already pinned
    if (pinnedSearches.some(p => p.query === query)) return;

    // Remove oldest if at limit
    if (pinnedSearches.length >= MAX_PINNED) {
      removePinnedHighlights(pinnedSearches[0].className);
      pinnedSearches.shift();
    }

    const caseSensitive = document.getElementById('search-case')?.checked || false;

    // ★ KEY FIX: Clear search highlights FIRST so text nodes are plain again
    clearSearchHighlights();
    matches = [];
    currentIndex = -1;
    updateCount();

    // ★ Then apply pinned highlight on clean DOM
    const className = `pinned-highlight-${pinnedSearches.length}`;
    pinnedSearches.push({ query, className, caseSensitive });

    const body = document.getElementById('markdown-body');
    if (body) {
      highlightText(body, query, caseSensitive, className);
    }

    input.value = '';
  }

  /** Highlight matching text in a DOM subtree */
  function highlightText(root, query, caseSensitive, className) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const nodesToProcess = [];

    while (walker.nextNode()) {
      const node = walker.currentNode;
      // Skip nodes inside code blocks
      // For pinned highlights: skip nodes already inside OTHER pinned highlights
      // But allow highlighting inside search-highlight (won't happen after fix)
      const parent = node.parentElement;
      if (!parent) continue;
      if (parent.closest('pre, code')) continue;

      // Skip if inside a DIFFERENT highlight class (not the same one we're adding)
      const existingHighlight = parent.closest('[class*="pinned-highlight"]');
      if (existingHighlight && !existingHighlight.classList.contains(className)) continue;

      // Skip if inside search-highlight
      if (parent.closest(`.${HIGHLIGHT_CLASS}`)) continue;

      nodesToProcess.push(node);
    }

    const flags = caseSensitive ? 'g' : 'gi';
    const regex = new RegExp(escapeRegex(query), flags);

    nodesToProcess.forEach(node => {
      const text = node.textContent;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.className = className;
        span.textContent = match[0];
        frag.appendChild(span);
        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      node.parentNode.replaceChild(frag, node);
    });
  }

  /** Clear only the temporary search highlights (not pinned) */
  function clearSearchHighlights() {
    const body = document.getElementById('markdown-body');
    if (!body) return;

    body.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  /** Remove a specific pinned highlight by class name */
  function removePinnedHighlights(className) {
    const body = document.getElementById('markdown-body');
    if (!body) return;

    body.querySelectorAll(`.${className}`).forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  /** Re-apply all pinned highlights (call after DOM changes like file reload) */
  function reapplyPinned() {
    const body = document.getElementById('markdown-body');
    if (!body || pinnedSearches.length === 0) return;

    pinnedSearches.forEach(({ query, className, caseSensitive }) => {
      highlightText(body, query, caseSensitive, className);
    });
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return { open, close, toggle, search, next, prev, pinSearch, reapplyPinned };
})();
