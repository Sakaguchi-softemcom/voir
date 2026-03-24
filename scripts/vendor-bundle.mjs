// scripts/vendor-bundle.mjs
// Bundles all third-party libraries for offline exe.
// Run: node scripts/vendor-bundle.mjs  (or: npm run vendor)

import { execSync } from 'child_process';
import { copyFileSync, writeFileSync, unlinkSync, mkdirSync, cpSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'src');
const vendor = join(src, 'vendor');
const nm = join(root, 'node_modules');

function ensureDir(dir) { mkdirSync(dir, { recursive: true }); }

console.log('=== Voir Vendor Bundle ===\n');

// ── 1. highlight.js (esbuild → browser IIFE) ─────────────
const hljsOut = join(vendor, 'highlight');
ensureDir(hljsOut);

const hljsEntry = join(root, '.build-hljs-entry.js');
writeFileSync(hljsEntry,
  `import hljs from 'highlight.js/lib/common';\nwindow.hljs = hljs;\n`
);
execSync(
  `npx esbuild .build-hljs-entry.js --bundle --minify --format=iife --outfile=src/vendor/highlight/highlight.min.js`,
  { cwd: root, stdio: 'inherit' }
);
try { unlinkSync(hljsEntry); } catch {}

copyFileSync(join(nm, 'highlight.js/styles/github.css'),      join(hljsOut, 'github.css'));
copyFileSync(join(nm, 'highlight.js/styles/github-dark.css'),  join(hljsOut, 'github-dark.css'));
console.log('[OK] highlight.js (JS + CSS)');

// ── 2. Mermaid ────────────────────────────────────────────
const mermaidOut = join(vendor, 'mermaid');
ensureDir(mermaidOut);
copyFileSync(join(nm, 'mermaid/dist/mermaid.min.js'), join(mermaidOut, 'mermaid.min.js'));
console.log('[OK] mermaid.min.js');

// ── 3. KaTeX (JS + CSS + fonts) ──────────────────────────
const katexOut = join(vendor, 'katex');
ensureDir(katexOut);
copyFileSync(join(nm, 'katex/dist/katex.min.js'),  join(katexOut, 'katex.min.js'));
copyFileSync(join(nm, 'katex/dist/katex.min.css'),  join(katexOut, 'katex.min.css'));

const fontsSrc = join(nm, 'katex/dist/fonts');
const fontsOut = join(katexOut, 'fonts');
ensureDir(fontsOut);
if (existsSync(fontsSrc)) {
  cpSync(fontsSrc, fontsOut, { recursive: true });
}
console.log('[OK] katex (JS + CSS + fonts)');

// ── 4. GitHub Markdown CSS (official) ─────────────────────
const stylesDir = join(src, 'styles');
copyFileSync(join(nm, 'github-markdown-css/github-markdown-light.css'), join(stylesDir, 'github-markdown-light.css'));
copyFileSync(join(nm, 'github-markdown-css/github-markdown-dark.css'),  join(stylesDir, 'github-markdown-dark.css'));
console.log('[OK] github-markdown-css (light + dark)');

console.log('\n=== All vendor libraries are offline-ready ===');
