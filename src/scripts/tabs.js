/* ═══════════════════════════════════════════════════════════
   Voir — Tab Management (i18n)
   ═══════════════════════════════════════════════════════════ */

window.VoirTabs = (() => {
  const tabs = [];
  let activeTabId = null;
  let tabIdCounter = 0;

  function generateId() { return `tab-${++tabIdCounter}`; }

  function openTab(path, title) {
    const existing = tabs.find(t => t.path === path);
    if (existing) { activateTab(existing.id); return existing.id; }
    const id = generateId();
    tabs.push({ id, path, title, scrollPos: 0, pinned: false });
    renderTabs();
    activateTab(id);
    return id;
  }

  function activateTab(id) {
    if (activeTabId) {
      const prev = tabs.find(t => t.id === activeTabId);
      if (prev) { const c = document.getElementById('content-area'); prev.scrollPos = c ? c.scrollTop : 0; }
    }
    activeTabId = id;
    renderTabs();
    const tab = tabs.find(t => t.id === id);
    if (tab && window.VoirApp) {
      window.VoirApp.loadFile(tab.path, false);
      requestAnimationFrame(() => { const c = document.getElementById('content-area'); if (c) c.scrollTop = tab.scrollPos; });
    }
  }

  function closeTab(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab && tab.pinned) return;
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;
    tabs.splice(idx, 1);
    if (activeTabId === id) {
      if (tabs.length > 0) { activateTab(tabs[Math.min(idx, tabs.length - 1)].id); }
      else { activeTabId = null; renderTabs(); if (window.VoirApp) window.VoirApp.showWelcome(); }
    } else { renderTabs(); }
  }

  function closeOtherTabs(keepId) { tabs.filter(t => t.id !== keepId && !t.pinned).map(t => t.id).forEach(id => closeTab(id)); }
  function closeAllTabs() { tabs.filter(t => !t.pinned).map(t => t.id).forEach(id => closeTab(id)); }

  function togglePin(id) {
    const tab = tabs.find(t => t.id === id);
    if (tab) { tab.pinned = !tab.pinned; tabs.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)); renderTabs(); }
  }

  function updateActiveTitle(title) {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) { tab.title = title; renderTabs(); }
  }

  function renderTabs() {
    const bar = document.getElementById('tab-bar');
    if (!bar) return;
    bar.innerHTML = '';
    tabs.forEach(tab => {
      const el = document.createElement('button');
      el.className = `tab-item${tab.id === activeTabId ? ' active' : ''}${tab.pinned ? ' pinned' : ''}`;
      const pinIcon = tab.pinned ? '<span class="tab-pin">📌</span>' : '';
      const closeBtn = tab.pinned ? '' : `<span class="tab-close" data-id="${tab.id}">&times;</span>`;
      el.innerHTML = `${pinIcon}<span class="tab-label" title="${esc(tab.path)}">${esc(tab.title)}</span>${closeBtn}`;
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) { e.stopPropagation(); closeTab(e.target.dataset.id); }
        else activateTab(tab.id);
      });
      el.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showTabContextMenu(e.clientX, e.clientY, tab.id); });
      bar.appendChild(el);
    });
  }

  function showTabContextMenu(x, y, tabId) {
    const T = VoirI18n.t;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const items = [
      { label: tab.pinned ? T('tab.unpin') : T('tab.pin'), action: () => togglePin(tabId) },
      '---',
      { label: T('tab.close'), action: () => closeTab(tabId) },
      { label: T('tab.closeOthers'), action: () => closeOtherTabs(tabId) },
      { label: T('tab.closeAll'), action: () => closeAllTabs() },
    ];
    const menu = document.getElementById('context-menu');
    const container = document.getElementById('context-menu-items');
    container.innerHTML = '';
    items.forEach(item => {
      if (item === '---') { const s = document.createElement('div'); s.className = 'context-menu-sep'; container.appendChild(s); }
      else { const el = document.createElement('button'); el.className = 'context-menu-item'; el.textContent = item.label; el.addEventListener('click', () => { menu.classList.add('hidden'); item.action(); }); container.appendChild(el); }
    });
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.remove('hidden');
  }

  function getActiveTab() { return tabs.find(t => t.id === activeTabId) || null; }
  function getTabCount() { return tabs.length; }
  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  return { openTab, activateTab, closeTab, closeOtherTabs, closeAllTabs, togglePin, updateActiveTitle, getActiveTab, getTabCount, renderTabs };
})();
