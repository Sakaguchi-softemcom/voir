/* ═══════════════════════════════════════════════════════════
   Voir — Internationalization (i18n)
   ═══════════════════════════════════════════════════════════ */

window.VoirI18n = (() => {
  let currentLang = 'ja';

  const translations = {
    // Toolbar
    'toolbar.explorer':       { ja: 'エクスプローラ (Ctrl+B)',  en: 'Explorer (Ctrl+B)' },
    'toolbar.open':           { ja: 'ファイルを開く (Ctrl+O)',   en: 'Open File (Ctrl+O)' },
    'toolbar.back':           { ja: '戻る (Alt+←)',             en: 'Back (Alt+Left)' },
    'toolbar.forward':        { ja: '進む (Alt+→)',             en: 'Forward (Alt+Right)' },
    'toolbar.search':         { ja: '検索 (Ctrl+F)',            en: 'Search (Ctrl+F)' },
    'toolbar.projectSearch':  { ja: 'プロジェクト検索 (Ctrl+Shift+F)', en: 'Project Search (Ctrl+Shift+F)' },
    'toolbar.toc':            { ja: '目次',                     en: 'Table of Contents' },
    'toolbar.theme':          { ja: 'テーマ切替',                en: 'Toggle Dark Mode' },
    'toolbar.settings':       { ja: '設定 (Ctrl+,)',            en: 'Settings (Ctrl+,)' },
    'toolbar.print':          { ja: '印刷 / PDF出力 (Ctrl+P)',  en: 'Print / Export PDF (Ctrl+P)' },
    // Welcome
    'welcome.tagline':        { ja: 'Markdown Viewer For Windows', en: 'Markdown Viewer For Windows' },
    'welcome.openFile':       { ja: 'ファイルを開く',            en: 'Open File' },
    'welcome.openFolder':     { ja: 'フォルダを開く',            en: 'Open Folder' },
    'welcome.recent':         { ja: '最近のファイル',            en: 'Recent Files' },
    // Sidebar
    'sidebar.explorer':       { ja: 'エクスプローラ',            en: 'Explorer' },
    'sidebar.bookmarks':      { ja: 'ブックマーク',              en: 'Bookmarks' },
    'sidebar.contents':       { ja: '目次',                     en: 'Contents' },
    'sidebar.projectRoot':    { ja: 'プロジェクトルート',         en: 'Project Root' },
    'sidebar.setRoot':        { ja: 'ルートフォルダを設定',       en: 'Set Root Folder' },
    'sidebar.changeRoot':     { ja: '変更',                     en: 'Change' },
    // Search
    'search.placeholder':     { ja: 'ドキュメント内を検索...',     en: 'Search in document...' },
    'search.pinTooltip':      { ja: '検索ハイライトを固定',       en: 'Pin search highlight' },
    // Project Search
    'psearch.placeholder':    { ja: 'プロジェクト内を検索...',     en: 'Search in project...' },
    'psearch.title':          { ja: 'プロジェクト検索',           en: 'Project Search' },
    'psearch.noRoot':         { ja: 'プロジェクトルートが設定されていません。サイドバーからフォルダを開いてください。', en: 'No project root set. Open a folder from the sidebar.' },
    'psearch.searching':      { ja: '検索中...',                 en: 'Searching...' },
    'psearch.results':        { ja: '件の結果',                  en: ' results' },
    'psearch.noResults':      { ja: '結果が見つかりませんでした',  en: 'No results found' },
    'psearch.matchIn':        { ja: '件一致',                    en: ' matches' },
    // Tabs
    'tab.pin':                { ja: 'タブをピン留め',             en: 'Pin tab' },
    'tab.unpin':              { ja: 'ピン留めを解除',             en: 'Unpin tab' },
    'tab.close':              { ja: '閉じる',                    en: 'Close' },
    'tab.closeOthers':        { ja: '他を閉じる',                en: 'Close others' },
    'tab.closeAll':           { ja: 'すべて閉じる',              en: 'Close all' },
    // Context Menu
    'ctx.copy':               { ja: 'コピー',                    en: 'Copy' },
    'ctx.searchInDoc':        { ja: 'ドキュメント内で検索',       en: 'Search in document' },
    'ctx.pinHighlight':       { ja: '検索ハイライトを固定',       en: 'Pin search highlight' },
    'ctx.copyCode':           { ja: 'コードをコピー',             en: 'Copy code block' },
    'ctx.copyAsCsv':          { ja: 'CSVとしてコピー',            en: 'Copy as CSV' },
    'ctx.copyAsTsv':          { ja: 'TSVとしてコピー',            en: 'Copy as TSV' },
    'ctx.copyAsMarkdown':     { ja: 'Markdownとしてコピー',       en: 'Copy as Markdown' },
    'ctx.openInViewer':       { ja: 'ビューワーで開く',           en: 'Open in viewer' },
    'ctx.copyImage':          { ja: '画像をコピー',               en: 'Copy image' },
    'ctx.saveImageAs':        { ja: '画像を保存...',              en: 'Save image as...' },
    'ctx.copyAsImage':        { ja: '画像としてコピー',            en: 'Copy as image' },
    'ctx.saveAsSvg':          { ja: 'SVGとして保存',              en: 'Save as SVG' },
    'ctx.copyLatex':          { ja: 'LaTeXをコピー',              en: 'Copy LaTeX' },
    'ctx.copyLinkUrl':        { ja: 'URLをコピー',                en: 'Copy link URL' },
    'ctx.copyFilePath':       { ja: 'ファイルパスをコピー',        en: 'Copy file path' },
    'ctx.bookmark':           { ja: 'ブックマークに追加',          en: 'Bookmark this file' },
    'ctx.bookmarkDir':        { ja: 'ブックマーク',               en: 'Bookmark' },
    'ctx.copyPath':           { ja: 'パスをコピー',               en: 'Copy path' },
    // Viewer
    'viewer.copy':            { ja: 'コピー',                    en: 'Copy' },
    'viewer.save':            { ja: '保存',                      en: 'Save' },
    'viewer.reset':           { ja: 'リセット',                   en: 'Reset' },
    // Settings
    'settings.title':         { ja: '設定',                      en: 'Settings' },
    'settings.language':      { ja: '言語 / Language',            en: 'Language / 言語' },
    'settings.theme':         { ja: 'テーマ',                    en: 'Theme' },
    'settings.themeAuto':     { ja: '自動（OS連動）',             en: 'Auto (follow system)' },
    'settings.themeLight':    { ja: 'GitHub Light',               en: 'GitHub Light' },
    'settings.themeDark':     { ja: 'GitHub Dark',                en: 'GitHub Dark' },
    'settings.themeDimmed':   { ja: 'GitHub Dark Dimmed',         en: 'GitHub Dark Dimmed' },
    'settings.themeOneLight': { ja: 'One Light',                  en: 'One Light' },
    'settings.themeSolLight': { ja: 'Solarized Light',            en: 'Solarized Light' },
    'settings.themeSolDark':  { ja: 'Solarized Dark',             en: 'Solarized Dark' },
    'settings.themeGruvLight':{ ja: 'Gruvbox Light',              en: 'Gruvbox Light' },
    'settings.themeDracula':  { ja: 'Dracula',                    en: 'Dracula' },
    'settings.themeNord':     { ja: 'Nord',                       en: 'Nord' },
    'settings.themeTokyo':    { ja: 'Tokyo Night',                en: 'Tokyo Night' },
    'settings.themeTokyoLight':{ ja: 'Tokyo Night Light',         en: 'Tokyo Night Light' },
    'settings.themeCatppuccin':{ ja: 'Catppuccin Mocha',          en: 'Catppuccin Mocha' },
    'settings.themeCatLatte': { ja: 'Catppuccin Latte',           en: 'Catppuccin Latte' },
    'settings.fontSize':      { ja: 'フォントサイズ',             en: 'Font Size' },
    'settings.sidebarOnStart':{ ja: '起動時にサイドバー表示',      en: 'Sidebar on startup' },
    'settings.tocOnStart':    { ja: '起動時に目次表示',           en: 'TOC on startup' },
    // Misc
    'frontmatter.label':      { ja: 'フロントマター',             en: 'Frontmatter' },
    'code.copy':              { ja: 'コピー',                    en: 'Copy' },
    'code.copied':            { ja: 'コピー済み！',               en: 'Copied!' },
    'error.openFailed':       { ja: 'ファイルを開けませんでした',   en: 'Failed to open file' },
  };

  function t(key) {
    const entry = translations[key];
    if (!entry) return key;
    return entry[currentLang] || entry['en'] || key;
  }

  function setLang(lang) { currentLang = lang; applyToDOM(); }
  function getLang() { return currentLang; }

  function applyToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
    document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.getAttribute('data-i18n-title')); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.getAttribute('data-i18n-placeholder')); });
    const ts = document.getElementById('setting-theme');
    if (ts) {
      const keys = ['settings.themeAuto','settings.themeLight','settings.themeDark','settings.themeDimmed','settings.themeOneLight','settings.themeSolLight','settings.themeSolDark','settings.themeGruvLight','settings.themeDracula','settings.themeNord','settings.themeTokyo','settings.themeTokyoLight','settings.themeCatppuccin','settings.themeCatLatte'];
      for (let i = 0; i < keys.length && i < ts.options.length; i++) { ts.options[i].text = t(keys[i]); }
    }
  }

  return { t, setLang, getLang, applyToDOM };
})();
