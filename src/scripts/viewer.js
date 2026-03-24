/* ═══════════════════════════════════════════════════════════
   Voir — Viewer Modal (Mermaid / KaTeX / Image)
   ═══════════════════════════════════════════════════════════ */

window.VoirViewer = (() => {
  let zoom = 1;
  let panX = 0, panY = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0;
  let currentType = ''; // 'mermaid' | 'katex' | 'image'

  function open(type, content, title) {
    currentType = type;
    zoom = 1; panX = 0; panY = 0;

    const modal = document.getElementById('viewer-modal');
    const container = document.getElementById('viewer-content');
    const titleEl = document.getElementById('viewer-title');

    titleEl.textContent = title || type.charAt(0).toUpperCase() + type.slice(1);

    if (type === 'image') {
      container.innerHTML = `<img src="${content}" style="max-width:100%;max-height:100%;object-fit:contain" />`;
    } else {
      container.innerHTML = content;
    }

    applyTransform();
    modal.classList.remove('hidden');
    document.addEventListener('keydown', onKeyDown);
  }

  function close() {
    document.getElementById('viewer-modal').classList.add('hidden');
    document.getElementById('viewer-content').innerHTML = '';
    document.removeEventListener('keydown', onKeyDown);
  }

  function zoomIn() { zoom = Math.min(5, zoom * 1.25); applyTransform(); }
  function zoomOut() { zoom = Math.max(0.2, zoom / 1.25); applyTransform(); }
  function zoomReset() { zoom = 1; panX = 0; panY = 0; applyTransform(); }

  function applyTransform() {
    const container = document.getElementById('viewer-content');
    const child = container.firstElementChild;
    if (child) {
      child.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
      child.style.transformOrigin = 'center center';
      child.style.transition = isDragging ? 'none' : 'transform 150ms ease';
    }
  }

  async function copyAsImage() {
    const container = document.getElementById('viewer-content');
    const svg = container.querySelector('svg');
    if (svg) {
      try {
        const svgData = new XMLSerializer().serializeToString(svg);
        const canvas = document.createElement('canvas');
        const img = new Image();
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);

        img.onload = async () => {
          canvas.width = img.naturalWidth * 2;
          canvas.height = img.naturalHeight * 2;
          const ctx = canvas.getContext('2d');
          ctx.scale(2, 2);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          canvas.toBlob(async (b) => {
            if (b) {
              await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]);
            }
          }, 'image/png');
        };
        img.src = url;
      } catch (e) {
        console.warn('Copy failed:', e);
      }
    }
    // For images
    const imgEl = container.querySelector('img');
    if (imgEl) {
      try {
        const resp = await fetch(imgEl.src);
        const blob = await resp.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } catch (e) {
        console.warn('Image copy failed:', e);
      }
    }
  }

  async function saveAsImage() {
    const container = document.getElementById('viewer-content');
    const svg = container.querySelector('svg');
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      downloadBlob(blob, 'diagram.svg');
    }
    const imgEl = container.querySelector('img');
    if (imgEl) {
      try {
        const resp = await fetch(imgEl.src);
        const blob = await resp.blob();
        const ext = blob.type.split('/')[1] || 'png';
        downloadBlob(blob, `image.${ext}`);
      } catch (e) {
        console.warn('Save failed:', e);
      }
    }
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') close();
    if (e.key === '+' || e.key === '=') zoomIn();
    if (e.key === '-') zoomOut();
    if (e.key === '0') zoomReset();
  }

  // Mouse pan
  function initEvents() {
    const container = document.getElementById('viewer-content');
    container.addEventListener('mousedown', (e) => {
      isDragging = true;
      dragStartX = e.clientX - panX;
      dragStartY = e.clientY - panY;
      container.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      panX = e.clientX - dragStartX;
      panY = e.clientY - dragStartY;
      applyTransform();
    });
    document.addEventListener('mouseup', () => {
      isDragging = false;
      const container = document.getElementById('viewer-content');
      if (container) container.style.cursor = 'grab';
    });

    // Mouse wheel zoom
    container.addEventListener('wheel', (e) => {
      if (!document.getElementById('viewer-modal').classList.contains('hidden')) {
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
      }
    }, { passive: false });

    // Buttons
    document.getElementById('viewer-close').addEventListener('click', close);
    document.getElementById('viewer-zoom-in').addEventListener('click', zoomIn);
    document.getElementById('viewer-zoom-out').addEventListener('click', zoomOut);
    document.getElementById('viewer-zoom-reset').addEventListener('click', zoomReset);
    document.getElementById('viewer-copy').addEventListener('click', copyAsImage);
    document.getElementById('viewer-save').addEventListener('click', saveAsImage);
    document.querySelector('.viewer-backdrop').addEventListener('click', close);
  }

  document.addEventListener('DOMContentLoaded', initEvents);

  return { open, close };
})();
