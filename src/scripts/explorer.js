/* ═══════════════════════════════════════════════════════════
   Voir — File Explorer (Project Root + Bookmarks + History)
   ═══════════════════════════════════════════════════════════ */

window.VoirExplorer = (() => {
  let currentDir = null;
  let projectRoot = null;  // Fixed root — doesn't change when opening files
  let activePath = null;
  let history = [];
  let historyIndex = -1;

  /** Set project root (via Open Folder or CLI --directory) */
  async function setProjectRoot(dirPath) {
    projectRoot = dirPath;
    try { await window.__TAURI__.core.invoke('set_project_root', { path: dirPath }); } catch {}
    loadDirectory(dirPath);

    // Update root label
    const label = document.getElementById('project-root-label');
    if (label) {
      const name = dirPath.split(/[\\/]/).pop() || dirPath;
      label.textContent = name;
      label.title = dirPath;
    }
    document.getElementById('project-root-section')?.classList.remove('hidden');
  }

  /** Get project root path */
  function getProjectRoot() { return projectRoot; }

  async function loadDirectory(dirPath, addToHistory = true) {
    currentDir = dirPath;
    if (addToHistory) {
      history = history.slice(0, historyIndex + 1);
      history.push(dirPath);
      historyIndex = history.length - 1;
    }
    updateNavButtons();

    try {
      const nodes = await window.__TAURI__.core.invoke('list_directory', { path: dirPath, depth: 4 });
      renderTree(nodes, document.getElementById('file-tree'), 0);
    } catch (err) {
      console.error('Failed to load directory:', err);
      document.getElementById('file-tree').innerHTML =
        `<div style="padding:16px;color:var(--text-tertiary);font-size:13px;">Failed to load directory</div>`;
    }
  }

  function goBack() {
    if (historyIndex > 0) { historyIndex--; loadDirectory(history[historyIndex], false); }
  }
  function goForward() {
    if (historyIndex < history.length - 1) { historyIndex++; loadDirectory(history[historyIndex], false); }
  }
  function updateNavButtons() {
    const b = document.getElementById('btn-explorer-back');
    const f = document.getElementById('btn-explorer-forward');
    if (b) b.disabled = historyIndex <= 0;
    if (f) f.disabled = historyIndex >= history.length - 1;
  }

  function renderTree(nodes, container, depth) {
    container.innerHTML = '';
    nodes.forEach(node => {
      if (node.is_dir) {
        const dirEl = document.createElement('div');
        dirEl.className = 'tree-dir';
        const itemEl = document.createElement('div');
        itemEl.className = 'tree-item';
        itemEl.style.setProperty('--depth', depth);
        itemEl.innerHTML = `<span class="tree-icon dir">▶</span><span>${esc(node.name)}</span>`;
        const childrenEl = document.createElement('div');
        childrenEl.className = 'tree-children';
        if (node.children && node.children.length > 0) renderTree(node.children, childrenEl, depth + 1);

        itemEl.addEventListener('click', () => {
          childrenEl.classList.toggle('expanded');
          itemEl.querySelector('.tree-icon').textContent = childrenEl.classList.contains('expanded') ? '▼' : '▶';
        });
        itemEl.addEventListener('contextmenu', (e) => { e.preventDefault(); showExplorerContextMenu(e.clientX, e.clientY, node); });
        dirEl.appendChild(itemEl);
        dirEl.appendChild(childrenEl);
        container.appendChild(dirEl);
      } else {
        const itemEl = document.createElement('div');
        itemEl.className = 'tree-item';
        itemEl.style.setProperty('--depth', depth);
        itemEl.dataset.path = node.path;
        itemEl.innerHTML = `<span class="tree-icon">📄</span><span>${esc(node.name)}</span>`;
        itemEl.addEventListener('click', () => { setActive(node.path); if (window.VoirApp) window.VoirApp.openFile(node.path); });
        itemEl.addEventListener('contextmenu', (e) => { e.preventDefault(); showExplorerContextMenu(e.clientX, e.clientY, node); });
        if (node.path === activePath) itemEl.classList.add('active');
        container.appendChild(itemEl);
      }
    });
  }

  function showExplorerContextMenu(x, y, node) {
    const T = VoirI18n.t;
    const items = [
      { label: T('ctx.bookmarkDir'), action: async () => {
        await window.__TAURI__.core.invoke('add_bookmark', { path: node.path, name: node.name, isDir: node.is_dir });
        loadBookmarks();
      }},
    ];
    if (!node.is_dir) {
      items.push({ label: T('ctx.copyPath'), action: () => navigator.clipboard.writeText(node.path) });
    }
    if (node.is_dir) {
      items.push({ label: T('sidebar.setRoot'), action: () => setProjectRoot(node.path) });
    }
    const menu = document.getElementById('context-menu');
    const container = document.getElementById('context-menu-items');
    container.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('button'); el.className = 'context-menu-item'; el.textContent = item.label;
      el.addEventListener('click', () => { menu.classList.add('hidden'); item.action(); });
      container.appendChild(el);
    });
    menu.style.left = `${x}px`; menu.style.top = `${y}px`; menu.classList.remove('hidden');
  }

  async function loadBookmarks() {
    try {
      const bookmarks = await window.__TAURI__.core.invoke('get_bookmarks');
      const section = document.getElementById('bookmarks-section');
      const list = document.getElementById('bookmarks-list');
      if (bookmarks.length === 0) { section.classList.add('hidden'); return; }
      section.classList.remove('hidden');
      list.innerHTML = '';
      bookmarks.forEach(bm => {
        const el = document.createElement('div');
        el.className = 'tree-item bookmark-item';
        el.innerHTML = `<span class="tree-icon">${bm.is_dir ? '📁' : '📄'}</span><span>${esc(bm.name)}</span><button class="bookmark-remove" title="Remove">&times;</button>`;
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('bookmark-remove')) {
            e.stopPropagation();
            window.__TAURI__.core.invoke('remove_bookmark', { path: bm.path }).then(() => loadBookmarks());
            return;
          }
          if (bm.is_dir) setProjectRoot(bm.path);
          else { setActive(bm.path); if (window.VoirApp) window.VoirApp.openFile(bm.path); }
        });
        list.appendChild(el);
      });
    } catch (err) { console.error('Failed to load bookmarks:', err); }
  }

  /** Called when a file is opened — highlights in tree but does NOT change explorer root */
  function setActive(path) {
    activePath = path;
    document.querySelectorAll('#file-tree .tree-item').forEach(el => {
      el.classList.toggle('active', el.dataset.path === path);
    });
    // If no project root yet, auto-set parent dir as root
    if (!projectRoot && path) {
      const dir = path.replace(/[\\/][^\\/]+$/, '');
      setProjectRoot(dir);
    }
  }

  function getCurrentDir() { return currentDir; }
  function esc(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  return { setProjectRoot, getProjectRoot, loadDirectory, goBack, goForward, loadBookmarks, setActive, getCurrentDir };
})();
