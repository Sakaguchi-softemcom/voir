/* ═══════════════════════════════════════════════════════════
   Voir — Smart Context Menu (i18n)
   ═══════════════════════════════════════════════════════════ */

window.VoirContextMenu = (() => {
  let currentFilePath = '';
  const t = () => VoirI18n.t; // lazy bind

  function init(filePath) {
    currentFilePath = filePath || '';
    document.getElementById('markdown-body')?.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('click', hide);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  }

  function onContextMenu(e) {
    e.preventDefault();
    const T = VoirI18n.t;
    const items = [];
    const target = e.target;
    const selection = window.getSelection()?.toString().trim();

    if (selection) {
      items.push({ label: T('ctx.copy'), action: () => navigator.clipboard.writeText(selection) });
      items.push({ label: T('ctx.searchInDoc'), action: () => { VoirSearch.open(); document.getElementById('search-input').value = selection; VoirSearch.search(selection, false); } });
      items.push({ label: T('ctx.pinHighlight'), action: () => { document.getElementById('search-input').value = selection; VoirSearch.pinSearch(); } });
      items.push('---');
    }

    const codeBlock = target.closest('.code-block-wrapper');
    if (codeBlock) {
      const code = codeBlock.querySelector('pre')?.textContent || '';
      items.push({ label: T('ctx.copyCode'), action: () => navigator.clipboard.writeText(code) });
      items.push('---');
    }

    const table = target.closest('table');
    if (table) {
      items.push({ label: T('ctx.copyAsCsv'), action: () => copyTableAs(table, ',') });
      items.push({ label: T('ctx.copyAsTsv'), action: () => copyTableAs(table, '\t') });
      items.push({ label: T('ctx.copyAsMarkdown'), action: () => copyTableAsMarkdown(table) });
      items.push('---');
    }

    if (target.tagName === 'IMG') {
      items.push({ label: T('ctx.openInViewer'), action: () => VoirViewer.open('image', target.src, 'Image') });
      items.push({ label: T('ctx.copyImage'), action: () => copyImage(target.src) });
      items.push({ label: T('ctx.saveImageAs'), action: () => saveImage(target.src) });
      items.push('---');
    }

    const mermaidWrapper = target.closest('.mermaid-wrapper');
    if (mermaidWrapper) {
      const svg = mermaidWrapper.querySelector('svg');
      if (svg) {
        items.push({ label: T('ctx.openInViewer'), action: () => VoirViewer.open('mermaid', svg.outerHTML, 'Mermaid') });
        items.push({ label: T('ctx.copyAsImage'), action: () => copySvgAsImage(svg) });
        items.push({ label: T('ctx.saveAsSvg'), action: () => saveSvg(svg) });
        items.push('---');
      }
    }

    const katexBlock = target.closest('.katex-block, .katex-inline');
    if (katexBlock) {
      const expr = katexBlock.getAttribute('data-expr') || katexBlock.textContent;
      items.push({ label: T('ctx.openInViewer'), action: () => VoirViewer.open('katex', katexBlock.innerHTML, 'Math') });
      items.push({ label: T('ctx.copyLatex'), action: () => navigator.clipboard.writeText(expr) });
      items.push('---');
    }

    const link = target.closest('a');
    if (link) {
      items.push({ label: T('ctx.copyLinkUrl'), action: () => navigator.clipboard.writeText(link.getAttribute('href') || '') });
      items.push('---');
    }

    if (currentFilePath) {
      const heading = target.closest('[id]');
      items.push({
        label: T('ctx.copyFilePath'),
        action: async () => {
          let pathStr = currentFilePath;
          if (heading && window.__TAURI__) {
            try {
              const line = await window.__TAURI__.core.invoke('get_source_line', { path: currentFilePath, headingId: heading.id });
              pathStr = `${currentFilePath}:${line}`;
            } catch {}
          }
          navigator.clipboard.writeText(pathStr);
        }
      });
      items.push({
        label: T('ctx.bookmark'),
        action: async () => {
          const name = currentFilePath.split(/[\\/]/).pop();
          await window.__TAURI__.core.invoke('add_bookmark', { path: currentFilePath, name, isDir: false });
          if (window.VoirExplorer) VoirExplorer.loadBookmarks();
        }
      });
    }

    if (items.length === 0) return;
    show(e.clientX, e.clientY, items);
  }

  function show(x, y, items) {
    const menu = document.getElementById('context-menu');
    const container = document.getElementById('context-menu-items');
    container.innerHTML = '';
    items.forEach(item => {
      if (item === '---') {
        const sep = document.createElement('div');
        sep.className = 'context-menu-sep';
        container.appendChild(sep);
      } else {
        const el = document.createElement('button');
        el.className = 'context-menu-item';
        el.textContent = item.label;
        el.addEventListener('click', () => { hide(); item.action(); });
        container.appendChild(el);
      }
    });
    menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - container.childElementCount * 32)}px`;
    menu.classList.remove('hidden');
  }

  function hide() { document.getElementById('context-menu')?.classList.add('hidden'); }

  function copyTableAs(table, delim) {
    const text = Array.from(table.querySelectorAll('tr')).map(r =>
      Array.from(r.querySelectorAll('th, td')).map(c => c.textContent.trim().replace(/\n/g, ' ')).join(delim)
    ).join('\n');
    navigator.clipboard.writeText(text);
  }
  function copyTableAsMarkdown(table) {
    const lines = [];
    Array.from(table.querySelectorAll('tr')).forEach((row, idx) => {
      const cells = Array.from(row.querySelectorAll('th, td')).map(c => c.textContent.trim());
      lines.push('| ' + cells.join(' | ') + ' |');
      if (idx === 0) lines.push('| ' + cells.map(() => '---').join(' | ') + ' |');
    });
    navigator.clipboard.writeText(lines.join('\n'));
  }
  async function copyImage(src) {
    try { const r = await fetch(src); const b = await r.blob(); await navigator.clipboard.write([new ClipboardItem({ [b.type]: b })]); } catch (e) { console.warn(e); }
  }
  async function saveImage(src) {
    try { const r = await fetch(src); const b = await r.blob(); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `image.${b.type.split('/')[1] || 'png'}`; a.click(); URL.revokeObjectURL(u); } catch (e) { console.warn(e); }
  }
  async function copySvgAsImage(svg) {
    try {
      const d = new XMLSerializer().serializeToString(svg); const c = document.createElement('canvas'); const img = new Image();
      const blob = new Blob([d], { type: 'image/svg+xml' }); const u = URL.createObjectURL(blob);
      img.onload = async () => { c.width = img.naturalWidth * 2; c.height = img.naturalHeight * 2; const ctx = c.getContext('2d'); ctx.scale(2,2); ctx.drawImage(img,0,0); URL.revokeObjectURL(u); c.toBlob(async b => { if(b) await navigator.clipboard.write([new ClipboardItem({'image/png':b})]); }, 'image/png'); };
      img.src = u;
    } catch (e) { console.warn(e); }
  }
  function saveSvg(svg) {
    const d = new XMLSerializer().serializeToString(svg); const b = new Blob([d], { type: 'image/svg+xml' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = 'diagram.svg'; a.click(); URL.revokeObjectURL(u);
  }

  return { init, hide };
})();
