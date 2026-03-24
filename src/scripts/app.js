/* ═══════════════════════════════════════════════════════════
   Voir — Main Application (Full Feature)
   ═══════════════════════════════════════════════════════════ */

window.VoirApp = (() => {
  let invoke, listen;
  function ensureTauri() {
    if (!invoke && window.__TAURI__) {
      invoke = window.__TAURI__.core.invoke;
      listen = window.__TAURI__.event.listen;
    }
  }

  let sidebarVisible = false;
  let tocVisible = false;

  // ─── Navigation History ──────────────────────────────────
  let navHistory = [];
  let navIndex = -1;

  function navPush(path) {
    navHistory = navHistory.slice(0, navIndex + 1);
    navHistory.push(path);
    navIndex = navHistory.length - 1;
    updateNavButtons();
  }

  function navBack() {
    if (navIndex > 0) {
      navIndex--;
      loadFile(navHistory[navIndex], false, true);
      updateNavButtons();
    }
  }

  function navForward() {
    if (navIndex < navHistory.length - 1) {
      navIndex++;
      loadFile(navHistory[navIndex], false, true);
      updateNavButtons();
    }
  }

  function updateNavButtons() {
    const backBtn = document.getElementById('btn-back');
    const fwdBtn = document.getElementById('btn-forward');
    if (backBtn) backBtn.disabled = navIndex <= 0;
    if (fwdBtn) fwdBtn.disabled = navIndex >= navHistory.length - 1;
  }

  // ─── Initialization ──────────────────────────────────────

  async function init() {
    ensureTauri();
    if (!invoke) { console.error('Tauri API not available'); return; }

    await loadSettings();
    initTheme();
    initMermaid();
    bindUI();
    bindKeyboard();
    await loadRecentFiles();
    await VoirExplorer.loadBookmarks();

    listen('open-file', (event) => openFile(event.payload));
    listen('open-directory', (event) => {
      toggleSidebar(true);
      VoirExplorer.setProjectRoot(event.payload);
    });
    listen('file-changed', async () => {
      const tab = VoirTabs.getActiveTab();
      if (tab) await loadFile(tab.path, true);
    });
    listen('tauri://drag-drop', (event) => {
      const paths = event.payload?.paths || [];
      for (const path of paths) {
        const ext = path.split('.').pop()?.toLowerCase();
        if (['md', 'markdown', 'mdown', 'mkdn', 'mkd', 'mdwn'].includes(ext)) {
          openFile(path); break;
        }
      }
    });
    listen('single-instance-args', (event) => {
      const argv = event.payload || [];
      argv.slice(1).forEach(arg => {
        if (!arg.startsWith('-')) openFile(arg);
      });
    });

    // Process CLI args
    try {
      const args = await invoke('get_cli_args');
      if (args.directory) {
        toggleSidebar(true);
        VoirExplorer.loadDirectory(args.directory);
      }
    } catch {}
  }

  // ─── Settings ────────────────────────────────────────────

  let settings = {};

  async function loadSettings() {
    try { settings = await invoke('get_settings'); } catch { settings = {}; }
    applySettings();
  }

  function applySettings() {
    if (settings.language) {
      VoirI18n.setLang(settings.language);
    }
    if (settings.fontSize) {
      document.documentElement.style.setProperty('--md-font-size', settings.fontSize + 'px');
    }
    if (settings.sidebarVisible) toggleSidebar(true);
    if (settings.tocVisible) toggleToc(true);
    VoirI18n.applyToDOM();
  }

  async function saveSettings() {
    try { await invoke('save_settings', { settings }); } catch (e) { console.error(e); }
  }

  function openSettings() {
    document.getElementById('settings-panel').classList.remove('hidden');
    document.getElementById('setting-language').value = settings.language || 'ja';
    document.getElementById('setting-theme').value = settings.theme || 'auto';
    document.getElementById('setting-fontsize').value = settings.fontSize || 16;
    document.getElementById('setting-fontsize-label').textContent = (settings.fontSize || 16) + 'px';
    document.getElementById('setting-sidebar').checked = !!settings.sidebarVisible;
    document.getElementById('setting-toc').checked = !!settings.tocVisible;
  }

  function closeSettings() {
    document.getElementById('settings-panel').classList.add('hidden');
  }

  // ─── Theme ───────────────────────────────────────────────

  const LIGHT_THEMES = new Set(['light', 'solarized-light', 'one-light', 'catppuccin-latte', 'gruvbox-light', 'tokyo-night-light']);
  function isLightTheme(theme) { return LIGHT_THEMES.has(theme); }

  function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = settings.theme || 'auto';
    let theme;
    if (mode === 'auto') theme = prefersDark ? 'dark' : 'light';
    else theme = mode;
    setTheme(theme);

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if ((settings.theme || 'auto') === 'auto') { setTheme(e.matches ? 'dark' : 'light'); renderMermaid(); }
    });
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const light = isLightTheme(theme);

    const gfmLight = document.getElementById('gfm-light');
    const gfmDark = document.getElementById('gfm-dark');
    if (gfmLight && gfmDark) { gfmLight.disabled = !light; gfmDark.disabled = light; }

    const hljsLight = document.getElementById('hljs-light');
    const hljsDark = document.getElementById('hljs-dark');
    if (hljsLight && hljsDark) { hljsLight.disabled = !light; hljsDark.disabled = light; }

    const sunIcon = document.querySelector('.icon-sun');
    const moonIcon = document.querySelector('.icon-moon');
    if (sunIcon && moonIcon) { sunIcon.style.display = light ? '' : 'none'; moonIcon.style.display = light ? 'none' : ''; }

    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: light ? 'default' : 'dark', securityLevel: 'loose' });
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = isLightTheme(current) ? 'dark' : 'light';
    settings.theme = next;
    setTheme(next);
    saveSettings();
    renderMermaid();
    const sel = document.getElementById('setting-theme');
    if (sel) sel.value = next;
  }

  // ─── Mermaid ─────────────────────────────────────────────

  function initMermaid() {
    const theme = document.documentElement.getAttribute('data-theme');
    if (typeof mermaid !== 'undefined') {
      mermaid.initialize({ startOnLoad: false, theme: isLightTheme(theme) ? 'default' : 'dark', securityLevel: 'loose' });
    }
  }

  async function renderMermaid() {
    const wrappers = document.querySelectorAll('.mermaid-wrapper');
    if (wrappers.length === 0) return;
    const theme = document.documentElement.getAttribute('data-theme');
    mermaid.initialize({ startOnLoad: false, theme: isLightTheme(theme) ? 'default' : 'dark', securityLevel: 'loose' });

    for (let i = 0; i < wrappers.length; i++) {
      const wrapper = wrappers[i];
      if (!wrapper.dataset.source) {
        const pre = wrapper.querySelector('.mermaid');
        if (pre) wrapper.dataset.source = pre.textContent.trim();
      }
      const code = wrapper.dataset.source;
      if (!code) continue;
      try {
        const id = `mermaid-${i}-${Date.now()}`;
        const { svg } = await mermaid.render(id, code);
        wrapper.innerHTML = svg;
        // Click to open in viewer
        wrapper.style.cursor = 'pointer';
        wrapper.addEventListener('click', () => {
          VoirViewer.open('mermaid', wrapper.innerHTML, 'Mermaid Diagram');
        });
      } catch (err) {
        console.warn('Mermaid render error:', err);
        wrapper.innerHTML = `<pre style="color:#666;font-size:12px;text-align:left">${escapeHtml(code)}</pre>`;
      }
    }
  }

  // ─── KaTeX ───────────────────────────────────────────────

  function renderKaTeX() {
    document.querySelectorAll('.katex-block[data-expr]').forEach(el => {
      const expr = el.getAttribute('data-expr');
      try {
        katex.render(expr, el, { displayMode: true, throwOnError: false });
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => VoirViewer.open('katex', el.innerHTML, 'Math Expression'));
      } catch (err) { el.textContent = expr; }
    });
    document.querySelectorAll('.katex-inline[data-expr]').forEach(el => {
      const expr = el.getAttribute('data-expr');
      try { katex.render(expr, el, { displayMode: false, throwOnError: false }); }
      catch (err) { el.textContent = `$${expr}$`; }
    });
  }

  // ─── Frontmatter as Table ────────────────────────────────

  function renderFrontmatterTable(yaml) {
    const lines = yaml.split('\n').filter(l => l.trim());
    let html = '<table class="frontmatter-table"><tbody>';
    lines.forEach(line => {
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        const val = line.substring(colonIdx + 1).trim();
        html += `<tr><td class="fm-key">${escapeHtml(key)}</td><td>${escapeHtml(val)}</td></tr>`;
      }
    });
    html += '</tbody></table>';
    return html;
  }

  // ─── File Operations ─────────────────────────────────────

  async function openFile(path) {
    // Validate file exists before creating a tab (graceful — open anyway if check unavailable)
    try {
      const exists = await invoke('check_file_exists', { path });
      if (exists === false) {
        console.warn('File not found, skipping:', path);
        return;
      }
    } catch {
      // Command not available or other error — proceed anyway
    }
    const name = path.split(/[\\/]/).pop() || path;
    VoirTabs.openTab(path, name);
  }

  async function loadFile(path, isReload = false, isNavigation = false) {
    // Save scroll position of previous file
    const prevTab = VoirTabs.getActiveTab();
    if (prevTab && prevTab.path !== path) {
      const content = document.getElementById('content-area');
      if (content) {
        try { await invoke('save_scroll_position', { path: prevTab.path, position: content.scrollTop }); } catch {}
      }
    }
    try {
      const result = await invoke('render_markdown', { path });
      document.getElementById('welcome-screen').classList.add('hidden');
      document.getElementById('markdown-view').classList.remove('hidden');

      const body = document.getElementById('markdown-body');

      // Frontmatter as collapsible table
      let fmHtml = '';
      if (result.frontmatter) {
        const tableHtml = renderFrontmatterTable(result.frontmatter);
        const fmLabel = VoirI18n.t('frontmatter.label');
        fmHtml = `
          <div class="frontmatter-block">
            <button class="frontmatter-toggle" onclick="this.nextElementSibling.classList.toggle('open');this.querySelector('.fm-arrow').textContent=this.nextElementSibling.classList.contains('open')?'▼':'▶'">
              <span class="fm-arrow">▶</span> ${fmLabel}
            </button>
            <div class="frontmatter-content">${tableHtml}</div>
          </div>`;
      }

      body.innerHTML = fmHtml + result.html;
      hljs.highlightAll();
      // Update code block copy button labels
      body.querySelectorAll('.copy-btn').forEach(btn => { btn.textContent = VoirI18n.t('code.copy'); });
      await renderMermaid();
      renderKaTeX();

      // Image click → viewer
      body.querySelectorAll('img').forEach(img => {
        img.style.cursor = 'pointer';
        img.addEventListener('click', (e) => {
          e.preventDefault();
          VoirViewer.open('image', img.src, img.alt || 'Image');
        });
      });

      // Links
      body.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        if (href.startsWith('http://') || href.startsWith('https://')) {
          a.addEventListener('click', (e) => { e.preventDefault(); invoke('open_external', { path: href }); });
        } else if (!href.startsWith('#')) {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            const dir = path.replace(/[\\/][^\\/]+$/, '');
            openFile(dir + '/' + href);
          });
        }
      });

      // Relative images
      body.querySelectorAll('img[src]').forEach(img => {
        const src = img.getAttribute('src');
        if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
          const dir = path.replace(/[\\/][^\\/]+$/, '');
          img.src = 'https://asset.localhost/' + dir + '/' + src;
        }
      });

      VoirToc.render(result.toc);
      VoirTabs.updateActiveTitle(result.title || path.split(/[\\/]/).pop());
      document.title = `${result.title || path.split(/[\\/]/).pop()} — Voir`;
      VoirContextMenu.init(path);

      if (!isNavigation) navPush(path);

      await invoke('watch_file', { path });
      await invoke('add_recent_file', { path });

      // Mark active in explorer (does NOT change root)
      VoirExplorer.setActive(path);

      // Restore scroll position (after DOM is rendered)
      if (!isReload) {
        requestAnimationFrame(async () => {
          try {
            const pos = await invoke('get_scroll_position', { path });
            if (pos > 0) {
              const content = document.getElementById('content-area');
              if (content) content.scrollTop = pos;
            }
          } catch {}
        });
      }

    } catch (err) {
      console.error('Failed to load file:', err);
      document.getElementById('markdown-body').innerHTML =
        `<div style="padding:40px;color:var(--text-secondary)"><h2>${VoirI18n.t('error.openFailed')}</h2><p>${escapeHtml(String(err))}</p></div>`;
    }
  }

  async function openFileDialog() {
    try {
      const files = await invoke('show_open_file_dialog');
      if (files && files.length > 0) files.forEach(f => openFile(f));
    } catch (err) { console.error('Open dialog error:', err); }
  }

  async function openFolderDialog() {
    try {
      const dir = await invoke('show_open_folder_dialog');
      if (dir) { toggleSidebar(true); VoirExplorer.setProjectRoot(dir); }
    } catch (err) { console.error('Open folder dialog error:', err); }
  }

  // ─── Project Search ──────────────────────────────────────

  function openProjectSearch() {
    const root = VoirExplorer.getProjectRoot();
    const panel = document.getElementById('project-search-panel');
    if (!panel) return;
    const noRoot = document.getElementById('psearch-no-root');
    const results = document.getElementById('psearch-results');
    if (!root) {
      if (noRoot) { noRoot.classList.remove('hidden'); noRoot.textContent = VoirI18n.t('psearch.noRoot'); }
      if (results) results.classList.add('hidden');
    } else {
      if (noRoot) noRoot.classList.add('hidden');
    }
    panel.classList.remove('hidden');
    document.getElementById('psearch-input')?.focus();
  }

  function closeProjectSearch() {
    document.getElementById('project-search-panel')?.classList.add('hidden');
  }

  async function executeProjectSearch(query) {
    const root = VoirExplorer.getProjectRoot();
    if (!root || !query.trim()) return;
    const T = VoirI18n.t;
    const statusEl = document.getElementById('psearch-status');
    const resultsEl = document.getElementById('psearch-results');
    document.getElementById('psearch-no-root')?.classList.add('hidden');
    if (statusEl) statusEl.textContent = T('psearch.searching');
    if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.classList.remove('hidden'); }

    try {
      const cs = document.getElementById('psearch-case')?.checked || false;
      const results = await invoke('search_project', { root, query: query.trim(), caseSensitive: cs, maxResults: 100 });
      const total = results.reduce((s, r) => s + r.match_count, 0);
      if (total === 0) { if (statusEl) statusEl.textContent = T('psearch.noResults'); return; }
      if (statusEl) statusEl.textContent = `${total}${T('psearch.results')} (${results.length} files)`;

      results.forEach(file => {
        const div = document.createElement('div'); div.className = 'psearch-file';
        const hdr = document.createElement('button'); hdr.className = 'psearch-file-header';
        hdr.innerHTML = `<span class="psearch-filename">📄 ${escapeHtml(file.file_name)}</span><span class="psearch-count">${file.match_count}${T('psearch.matchIn')}</span>`;
        hdr.addEventListener('click', () => openFile(file.file_path));
        const fp = document.createElement('div'); fp.className = 'psearch-filepath'; fp.textContent = file.file_path;
        div.appendChild(hdr); div.appendChild(fp);

        file.matches.slice(0, 5).forEach(m => {
          const el = document.createElement('button'); el.className = 'psearch-match';
          // Highlight query in context using text search (avoids byte/char offset issues)
          const ctx = escapeHtml(m.context);
          const escapedQ = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`(${escapedQ})`, cs ? 'g' : 'gi');
          const highlighted = ctx.replace(re, '<mark>$1</mark>');
          el.innerHTML = `<span class="psearch-line-num">${m.line}</span><span class="psearch-context">${highlighted}</span>`;
          el.addEventListener('click', () => openFile(file.file_path));
          div.appendChild(el);
        });
        if (file.match_count > 5) { const more = document.createElement('div'); more.className = 'psearch-more'; more.textContent = `... +${file.match_count - 5}`; div.appendChild(more); }
        resultsEl.appendChild(div);
      });
    } catch (err) { console.error('Project search error:', err); if (statusEl) statusEl.textContent = String(err); }
  }

  function showWelcome() {
    document.getElementById('welcome-screen').classList.remove('hidden');
    document.getElementById('markdown-view').classList.add('hidden');
    document.title = 'Voir';
    VoirToc.clear();
    loadRecentFiles();
  }

  async function loadRecentFiles() {
    try {
      const files = await invoke('get_recent_files');
      const container = document.getElementById('recent-files');
      if (!container || files.length === 0) return;
      container.innerHTML = `<h4>${VoirI18n.t('welcome.recent')}</h4>`;
      files.slice(0, 8).forEach(path => {
        const name = path.split(/[\\/]/).pop();
        const btn = document.createElement('button');
        btn.className = 'recent-item';
        btn.innerHTML = `${escapeHtml(name)}<span class="recent-path">${escapeHtml(path)}</span>`;
        btn.addEventListener('click', () => openFile(path));
        container.appendChild(btn);
      });
    } catch (err) { console.error('Failed to load recent files:', err); }
  }

  // ─── Sidebar / TOC Toggle ────────────────────────────────

  function toggleSidebar(show) {
    const sidebar = document.getElementById('sidebar');
    const btn = document.getElementById('btn-sidebar-toggle');
    sidebarVisible = show !== undefined ? show : !sidebarVisible;
    sidebar.classList.toggle('hidden', !sidebarVisible);
    btn.classList.toggle('active', sidebarVisible);
  }

  function toggleToc(show) {
    const panel = document.getElementById('toc-panel');
    const btn = document.getElementById('btn-toc-toggle');
    tocVisible = show !== undefined ? show : !tocVisible;
    panel.classList.toggle('hidden', !tocVisible);
    btn.classList.toggle('active', tocVisible);
  }

  // ─── UI Bindings ─────────────────────────────────────────

  function bindUI() {
    document.getElementById('btn-sidebar-toggle').addEventListener('click', () => toggleSidebar());
    document.getElementById('btn-open').addEventListener('click', openFileDialog);
    document.getElementById('btn-back').addEventListener('click', navBack);
    document.getElementById('btn-forward').addEventListener('click', navForward);
    document.getElementById('btn-search').addEventListener('click', () => VoirSearch.toggle());
    document.getElementById('btn-toc-toggle').addEventListener('click', () => toggleToc());
    document.getElementById('btn-theme').addEventListener('click', toggleTheme);
    document.getElementById('btn-print').addEventListener('click', printDocument);
    document.getElementById('btn-settings').addEventListener('click', openSettings);
    document.getElementById('btn-sidebar-close').addEventListener('click', () => toggleSidebar(false));
    document.getElementById('btn-toc-close').addEventListener('click', () => toggleToc(false));
    document.getElementById('btn-welcome-open').addEventListener('click', openFileDialog);
    document.getElementById('btn-welcome-folder').addEventListener('click', openFolderDialog);

    // Explorer nav
    document.getElementById('btn-explorer-back')?.addEventListener('click', () => VoirExplorer.goBack());
    document.getElementById('btn-explorer-forward')?.addEventListener('click', () => VoirExplorer.goForward());
    document.getElementById('btn-change-root')?.addEventListener('click', openFolderDialog);

    // Project Search UI
    const psearchInput = document.getElementById('psearch-input');
    if (psearchInput) {
      let psearchTimer = null;
      psearchInput.addEventListener('input', () => {
        clearTimeout(psearchTimer);
        psearchTimer = setTimeout(() => executeProjectSearch(psearchInput.value), 400);
      });
      psearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { clearTimeout(psearchTimer); executeProjectSearch(psearchInput.value); }
        if (e.key === 'Escape') closeProjectSearch();
      });
    }
    document.getElementById('psearch-close')?.addEventListener('click', closeProjectSearch);
    document.querySelector('.psearch-backdrop')?.addEventListener('click', closeProjectSearch);
    document.getElementById('psearch-case')?.addEventListener('change', () => {
      const q = document.getElementById('psearch-input')?.value;
      if (q) executeProjectSearch(q);
    });

    // Search UI
    const searchInput = document.getElementById('search-input');
    const searchCase = document.getElementById('search-case');
    searchInput.addEventListener('input', () => VoirSearch.search(searchInput.value, searchCase.checked));
    searchCase.addEventListener('change', () => VoirSearch.search(searchInput.value, searchCase.checked));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.shiftKey ? VoirSearch.prev() : VoirSearch.next(); }
      if (e.key === 'Escape') VoirSearch.close();
    });
    document.getElementById('search-next').addEventListener('click', () => VoirSearch.next());
    document.getElementById('search-prev').addEventListener('click', () => VoirSearch.prev());
    document.getElementById('search-pin').addEventListener('click', () => VoirSearch.pinSearch());
    document.getElementById('search-close').addEventListener('click', () => VoirSearch.close());

    // Settings
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.querySelector('.settings-backdrop')?.addEventListener('click', closeSettings);
    // Language
    document.getElementById('setting-language').addEventListener('change', (e) => {
      settings.language = e.target.value;
      VoirI18n.setLang(settings.language);
      saveSettings();
    });
    document.getElementById('setting-theme').addEventListener('change', (e) => {
      settings.theme = e.target.value;
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (settings.theme === 'auto') setTheme(prefersDark ? 'dark' : 'light');
      else setTheme(settings.theme);
      saveSettings(); renderMermaid();
    });
    document.getElementById('setting-fontsize').addEventListener('input', (e) => {
      settings.fontSize = parseInt(e.target.value);
      document.getElementById('setting-fontsize-label').textContent = settings.fontSize + 'px';
      document.documentElement.style.setProperty('--md-font-size', settings.fontSize + 'px');
      saveSettings();
    });
    document.getElementById('setting-sidebar').addEventListener('change', (e) => {
      settings.sidebarVisible = e.target.checked; saveSettings();
    });
    document.getElementById('setting-toc').addEventListener('change', (e) => {
      settings.tocVisible = e.target.checked; saveSettings();
    });
  }

  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'o') { e.preventDefault(); openFileDialog(); }
      if (ctrl && e.key === 'p') { e.preventDefault(); printDocument(); }
      if (ctrl && e.shiftKey && e.key === 'F') { e.preventDefault(); openProjectSearch(); return; }
      if (ctrl && e.key === 'f') { e.preventDefault(); VoirSearch.open(); }
      if (ctrl && e.key === 'b') { e.preventDefault(); toggleSidebar(); }
      if (ctrl && e.key === 'w') { e.preventDefault(); const t = VoirTabs.getActiveTab(); if (t) VoirTabs.closeTab(t.id); }
      if (ctrl && e.key === 'r') { e.preventDefault(); const t = VoirTabs.getActiveTab(); if (t) loadFile(t.path, true); }
      if (ctrl && e.key === ',') { e.preventDefault(); openSettings(); }
      if (ctrl && (e.key === '=' || e.key === '+')) { e.preventDefault(); adjustZoom(1); }
      if (ctrl && e.key === '-') { e.preventDefault(); adjustZoom(-1); }
      if (ctrl && e.key === '0') { e.preventDefault(); adjustZoom(0); }
      if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); navBack(); }
      if (e.altKey && e.key === 'ArrowRight') { e.preventDefault(); navForward(); }
      if (e.key === 'Escape') { VoirSearch.close(); closeSettings(); closeProjectSearch(); VoirViewer.close(); VoirContextMenu.hide(); }
    });
  }

  // ─── Print ──────────────────────────────────────────────

  function printDocument() {
    const tab = VoirTabs.getActiveTab();
    if (!tab) return;

    // Set document title for print header
    const originalTitle = document.title;
    document.title = tab.title || tab.path.split(/[\\/]/).pop() || 'Voir';

    // Temporarily reset zoom for consistent print output
    const mdView = document.getElementById('markdown-view');
    const savedFontSize = mdView?.style.fontSize;
    if (mdView) mdView.style.fontSize = '';

    window.print();

    // Restore after print dialog closes
    if (mdView && savedFontSize) mdView.style.fontSize = savedFontSize;
    document.title = originalTitle;
  }

  let zoomLevel = 100;
  function adjustZoom(direction) {
    if (direction === 0) zoomLevel = 100;
    else zoomLevel = Math.max(60, Math.min(200, zoomLevel + direction * 10));
    document.getElementById('markdown-view').style.fontSize = `${zoomLevel}%`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, openFile, loadFile, showWelcome };
})();

function copyCodeBlock(btn) {
  const pre = btn.closest('.code-block-wrapper').querySelector('pre');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    btn.textContent = VoirI18n.t('code.copied');
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = VoirI18n.t('code.copy'); btn.classList.remove('copied'); }, 2000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (window.__TAURI__) { VoirApp.init(); }
  else {
    const check = setInterval(() => {
      if (window.__TAURI__) { clearInterval(check); VoirApp.init(); }
    }, 50);
    setTimeout(() => { clearInterval(check); }, 5000);
  }
});
