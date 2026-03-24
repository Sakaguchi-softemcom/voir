# Voir — Development Guide

> **🇯🇵 [日本語](#日本語) | 🇬🇧 [English](#english)**

---

<a id="日本語"></a>

<details open>
<summary><h2>🇯🇵 日本語 — 開発ガイド</h2></summary>

### 前提条件

- **Rust** (stable 最新) — https://rustup.rs
- **Node.js** 18+ — https://nodejs.org
- **Visual Studio Build Tools** (Windows) — C++ ワークロード

### セットアップ

```powershell
git clone https://github.com/Sakaguchi-softemcom/voir.git
cd voir
npm install           # Tauri CLI + ベンダーライブラリ取得
npm run vendor        # highlight.js / Mermaid / KaTeX / GitHub CSS をローカルバンドル
```

### 開発モード

```powershell
npm run dev           # ベンダーバンドル → Tauri 開発サーバー起動
```

### リリースビルド

```powershell
npm run build         # ベンダーバンドル → Rust コンパイル → インストーラー生成
```

生成される exe は**完全に自己完結型**です。すべての JS / CSS / フォントがバイナリに埋め込まれ、実行時にネットワーク接続は不要です。

---

### プロジェクト構成

```
voir/
├── src/                            # フロントエンド (HTML/CSS/JS)
│   ├── index.html                  # メインシェル（data-i18n 属性付き）
│   ├── styles/
│   │   ├── github-markdown-light.css    # 公式 GitHub CSS (ライト)
│   │   ├── github-markdown-dark.css     # 公式 GitHub CSS (ダーク)
│   │   ├── github-markdown-overrides.css # Voir 独自スタイル
│   │   └── main.css                # アプリレイアウト＋全コンポーネント
│   ├── vendor/                     # オフラインバンドル (npm run vendor で生成)
│   │   ├── highlight/              # highlight.js (esbuild バンドル + CSS)
│   │   ├── mermaid/                # mermaid.min.js
│   │   └── katex/                  # katex.min.js + CSS + フォント 60 ファイル
│   └── scripts/
│       ├── i18n.js                 # 多言語対応 (日本語/英語)
│       ├── app.js                  # メイン制御・設定・テーマ・ナビゲーション履歴
│       ├── tabs.js                 # タブ管理 (ピン留め・右クリックメニュー)
│       ├── explorer.js             # ファイルエクスプローラ (ブックマーク・ディレクトリ履歴)
│       ├── toc.js                  # 目次パネル (スクロール位置ベース追従)
│       ├── search.js               # 検索 & ピン留め検索
│       ├── viewer.js               # 拡大ビューワー (ズーム/パン/コピー/保存)
│       └── context-menu.js         # スマートコンテキストメニュー
├── src-tauri/                      # Rust バックエンド
│   ├── Cargo.toml                  # 依存: pulldown-cmark, notify, clap, etc.
│   ├── tauri.conf.json             # Tauri 設定 (plugins: {} が正解)
│   ├── capabilities/default.json   # パーミッション定義
│   └── src/
│       ├── main.rs                 # エントリポイント (voir::run())
│       ├── lib.rs                  # Tauri コマンド定義・CLI・設定・ブックマーク
│       ├── markdown.rs             # GFM パース (ネイティブ Alerts 対応)
│       ├── watcher.rs              # ファイル変更監視 (デバウンス)
│       └── explorer.rs             # ディレクトリ一覧 (自動フィルタ)
├── scripts/
│   ├── vendor-bundle.mjs           # ベンダーバンドルスクリプト
│   ├── voir.ps1 / voir.cmd         # CLI ランチャー
│   └── generate-icons.py           # アイコン生成
├── test/sample.md                  # テスト用 Markdown（全機能テスト）
└── .github/workflows/build.yml     # CI/CD パイプライン
```

---

### アーキテクチャ

#### Rust バックエンド (src-tauri/)

| モジュール | 役割 |
|-----------|------|
| `lib.rs` | Tauri コマンド定義、CLI 引数処理 (clap)、設定・ブックマーク・最近のファイル永続化、ダイアログ、シングルインスタンス |
| `markdown.rs` | pulldown-cmark による GFM パース、TOC 抽出、Mermaid/KaTeX/コードブロック処理、GitHub Alerts (ネイティブ BlockQuoteKind)、フロントマター、インライン数式 |
| `watcher.rs` | notify クレートによるファイル監視（200ms デバウンス） |
| `explorer.rs` | ディレクトリ一覧（node_modules, .git, target 等を自動除外） |

#### フロントエンド (src/)

| モジュール | 役割 |
|-----------|------|
| `i18n.js` | 翻訳辞書 (ja/en)、`data-i18n` 属性による DOM 自動翻訳、動的切替 |
| `app.js` | 初期化、テーマ、Mermaid/KaTeX レンダリング、設定画面、ナビゲーション履歴、ファイル操作 |
| `tabs.js` | タブ開閉、ピン留め、右クリックメニュー (i18n) |
| `explorer.js` | ファイルツリー描画、ブックマーク管理、ディレクトリ履歴 (i18n) |
| `toc.js` | スクロール位置ベースの追従、最下部安定化、TOC 内自動スクロール |
| `search.js` | テキスト検索、ピン留め検索（最大 5 色） |
| `viewer.js` | モーダルビューワー、ズーム/パン、画像コピー/保存 |
| `context-menu.js` | 要素別メニュー生成（テーブル CSV コピー等）(i18n) |

#### フロントエンド ↔ バックエンド通信

| コマンド | 戻り値 |
|---------|--------|
| `render_markdown(path)` | HTML + TOC + タイトル + フロントマター |
| `watch_file(path)` | ファイル変更時に `file-changed` イベント発火 |
| `list_directory(path, depth)` | ファイルツリー (FileNode[]) |
| `get_bookmarks()` / `add_bookmark(...)` / `remove_bookmark(...)` | ブックマーク CRUD |
| `get_settings()` / `save_settings(...)` | 設定 JSON の読み書き |
| `get_recent_files()` / `add_recent_file(...)` | 最近のファイル |
| `show_open_file_dialog()` / `show_open_folder_dialog()` | ネイティブダイアログ |
| `get_source_line(path, heading_id)` | 見出しのソース行番号 |
| `open_external(path)` | 外部アプリ/ブラウザで開く |
| `get_cli_args()` | CLI 引数 (paths, open, directory) |

---

### 新機能の追加方法

#### Tauri コマンドの追加

1. `src-tauri/src/lib.rs` に `#[tauri::command]` 関数を定義
2. `invoke_handler` マクロに登録
3. JS: `await window.__TAURI__.core.invoke('command_name', { args })`

#### 翻訳キーの追加

1. `src/scripts/i18n.js` の `translations` に `{ ja: '...', en: '...' }` を追加
2. HTML: `data-i18n="key"` / `data-i18n-title="key"` / `data-i18n-placeholder="key"`
3. JS: `VoirI18n.t('key')` で動的に取得

#### CSS テーマ変数の追加

1. `main.css` の `:root` と `[data-theme="dark"]` に追加
2. `var(--your-variable)` で使用

### テスト

```powershell
cd src-tauri
cargo test
```

---

### 既知の注意点

- `tauri.conf.json` の `"plugins"` は `{}` でなければならない（中身を書くとデシリアライズエラー）
- `capabilities/default.json` に存在しないパーミッション ID を書くとビルドエラー
- `main.rs` 内のクレート名は `voir::run()` （`voir_lib` ではない）
- Mermaid のテーマ切替はソースコードを `data-source` 属性に保存して再レンダリング

</details>

---

<a id="english"></a>

<details>
<summary><h2>🇬🇧 English — Development Guide</h2></summary>

### Prerequisites

- **Rust** (latest stable) — https://rustup.rs
- **Node.js** 18+ — https://nodejs.org
- **Visual Studio Build Tools** (Windows) — C++ workload

### Setup

```powershell
git clone https://github.com/Sakaguchi-softemcom/voir.git
cd voir
npm install           # Tauri CLI + vendor libraries
npm run vendor        # Bundle highlight.js / Mermaid / KaTeX / GitHub CSS locally
```

### Development Mode

```powershell
npm run dev           # Vendor bundle → Tauri dev server
```

### Release Build

```powershell
npm run build         # Vendor bundle → Rust compile → installer
```

The resulting exe is **completely self-contained**. All JS / CSS / fonts are embedded in the binary. No network access needed at runtime.

---

### Project Structure

```
voir/
├── src/                            # Frontend (HTML/CSS/JS)
│   ├── index.html                  # Main shell (with data-i18n attributes)
│   ├── styles/
│   │   ├── github-markdown-light.css    # Official GitHub CSS (light)
│   │   ├── github-markdown-dark.css     # Official GitHub CSS (dark)
│   │   ├── github-markdown-overrides.css # Voir-specific styles
│   │   └── main.css                # App layout + all components
│   ├── vendor/                     # Offline bundles (generated by npm run vendor)
│   │   ├── highlight/              # highlight.js (esbuild bundle + CSS)
│   │   ├── mermaid/                # mermaid.min.js
│   │   └── katex/                  # katex.min.js + CSS + 60 font files
│   └── scripts/
│       ├── i18n.js                 # Internationalization (Japanese/English)
│       ├── app.js                  # Main controller, settings, theme, nav history
│       ├── tabs.js                 # Tab management (pin, context menu)
│       ├── explorer.js             # File explorer (bookmarks, dir history)
│       ├── toc.js                  # TOC panel (scroll-position based tracking)
│       ├── search.js               # Search & pinned highlights
│       ├── viewer.js               # Zoom viewer (pan/copy/save)
│       └── context-menu.js         # Smart context menu
├── src-tauri/                      # Rust backend
│   ├── Cargo.toml                  # Deps: pulldown-cmark, notify, clap, etc.
│   ├── tauri.conf.json             # Tauri config (plugins: {} is correct)
│   ├── capabilities/default.json   # Permission definitions
│   └── src/
│       ├── main.rs                 # Entry point (voir::run())
│       ├── lib.rs                  # Tauri commands, CLI, settings, bookmarks
│       ├── markdown.rs             # GFM parsing (native Alerts support)
│       ├── watcher.rs              # File change watcher (debounced)
│       └── explorer.rs             # Directory listing (auto-filtered)
├── scripts/
│   ├── vendor-bundle.mjs           # Vendor bundle script
│   ├── voir.ps1 / voir.cmd         # CLI launchers
│   └── generate-icons.py           # Icon generator
├── test/sample.md                  # Test markdown (all features)
└── .github/workflows/build.yml     # CI/CD pipeline
```

---

### Architecture

#### Rust Backend (src-tauri/)

| Module | Role |
|--------|------|
| `lib.rs` | Tauri commands, CLI (clap), settings/bookmarks/recent files persistence, dialogs, single instance |
| `markdown.rs` | pulldown-cmark GFM parsing, TOC extraction, Mermaid/KaTeX/code block handling, GitHub Alerts (native BlockQuoteKind), frontmatter, inline math |
| `watcher.rs` | File watching via notify crate (200ms debounce) |
| `explorer.rs` | Directory listing (auto-skips node_modules, .git, target, etc.) |

#### Frontend (src/)

| Module | Role |
|--------|------|
| `i18n.js` | Translation dictionary (ja/en), auto DOM translation via `data-i18n`, dynamic switching |
| `app.js` | Init, theme, Mermaid/KaTeX rendering, settings panel, nav history, file ops |
| `tabs.js` | Tab open/close, pinning, context menu (i18n) |
| `explorer.js` | File tree rendering, bookmark management, dir history (i18n) |
| `toc.js` | Scroll-position based tracking, bottom-stable, auto-scroll within TOC |
| `search.js` | Text search, pinned search (up to 5 colors) |
| `viewer.js` | Modal viewer, zoom/pan, image copy/save |
| `context-menu.js` | Element-aware menu generation (table CSV copy, etc.) (i18n) |

#### Frontend ↔ Backend Communication

| Command | Returns |
|---------|---------|
| `render_markdown(path)` | HTML + TOC + title + frontmatter |
| `watch_file(path)` | Emits `file-changed` on change |
| `list_directory(path, depth)` | File tree (FileNode[]) |
| `get_bookmarks()` / `add_bookmark(...)` / `remove_bookmark(...)` | Bookmark CRUD |
| `get_settings()` / `save_settings(...)` | Settings JSON read/write |
| `get_recent_files()` / `add_recent_file(...)` | Recent files |
| `show_open_file_dialog()` / `show_open_folder_dialog()` | Native dialogs |
| `get_source_line(path, heading_id)` | Source line number for heading |
| `open_external(path)` | Open in external app/browser |
| `get_cli_args()` | CLI args (paths, open, directory) |

---

### Adding Features

#### Adding a Tauri Command

1. Define a `#[tauri::command]` function in `src-tauri/src/lib.rs`
2. Register in `invoke_handler` macro
3. JS: `await window.__TAURI__.core.invoke('command_name', { args })`

#### Adding a Translation Key

1. Add `{ ja: '...', en: '...' }` to `translations` in `src/scripts/i18n.js`
2. HTML: `data-i18n="key"` / `data-i18n-title="key"` / `data-i18n-placeholder="key"`
3. JS: `VoirI18n.t('key')` for dynamic use

#### Adding a CSS Theme Variable

1. Add to `:root` and `[data-theme="dark"]` in `main.css`
2. Use as `var(--your-variable)` in styles

### Testing

```powershell
cd src-tauri
cargo test
```

---

### Known Gotchas

- `tauri.conf.json` `"plugins"` must be `{}` (adding content causes deserialization errors)
- Non-existent permission IDs in `capabilities/default.json` cause build errors
- Crate name in `main.rs` is `voir::run()` (not `voir_lib`)
- Mermaid theme switching preserves source code in `data-source` attribute for re-rendering

</details>
