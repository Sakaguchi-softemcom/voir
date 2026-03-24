# Voir — Build Setup

> **🇯🇵 [日本語](#日本語) | 🇬🇧 [English](#english)**

---

<a id="日本語"></a>

<details open>
<summary><h2>🇯🇵 日本語 — Windows ビルド環境セットアップガイド</h2></summary>

ゼロから Voir をビルドできるようになるまでの完全な手順です。所要時間は約15〜20分です。

---

### 前提条件一覧

| ツール | バージョン | 用途 |
|--------|-----------|------|
| Visual Studio Build Tools | 2022 以降 | C++ コンパイラ（Rust が必要とする） |
| WebView2 Runtime | 最新 | Tauri のレンダリングエンジン（Win10/11 は標準搭載） |
| Rust | stable 最新 | バックエンド全体 |
| Node.js | 18 以降（LTS 推奨） | Tauri CLI + ベンダーバンドル |

---

### Step 1: Visual Studio C++ Build Tools

Rust のコンパイルに **Microsoft C++ Build Tools** が必須です。

1. https://visualstudio.microsoft.com/visual-cpp-build-tools/ からインストーラーをダウンロード
2. 「**C++ によるデスクトップ開発**」にチェック
3. **MSVC v143 ビルドツール** と **Windows 10/11 SDK** が含まれていることを確認
4. 「インストール」をクリック（約 5GB）

```powershell
# winget を使う場合
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### Step 2: WebView2 Runtime（確認のみ）

Windows 10 (1803以降) / Windows 11 には**標準搭載**です。通常はスキップ可能です。

未インストールの場合: https://developer.microsoft.com/en-us/microsoft-edge/webview2/ から「Evergreen Bootstrapper」をインストール。

### Step 3: Rust のインストール

```powershell
winget install Rustlang.Rustup
```

または https://www.rust-lang.org/tools/install から `rustup-init.exe` をダウンロードして実行。

> ⚠ インストール後、**ターミナルを再起動**してください。

### Step 4: Node.js のインストール

```powershell
winget install OpenJS.NodeJS.LTS
```

または https://nodejs.org/ から LTS 版をダウンロード。

> ⚠ PowerShell で `npm` 実行時にスクリプト実行エラーが出る場合:
> ```powershell
> Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### Step 5: ビルド

```powershell
cd voir
npm install
npm run build
```

- `npm run build` は内部で `npm run vendor`（ライブラリバンドル）→ `tauri build`（Rust コンパイル + インストーラー生成）を自動実行します
- 初回は Rust クレートのコンパイルに **5〜10分** かかります。2回目以降は **1〜2分** です

### 成果物

```
src-tauri\target\release\Voir.exe                              ← ポータブル exe
src-tauri\target\release\bundle\nsis\Voir_0.1.0_x64-setup.exe  ← NSIS インストーラー
src-tauri\target\release\bundle\msi\Voir_0.1.0_x64_en-US.msi   ← MSI インストーラー
```

---

### 開発モード

```powershell
npm run dev
```

フロントエンド（HTML/CSS/JS）を編集すると即座に反映されます。Rust 側を変更した場合は自動リビルドされます。

---

### まとめ：最小手順

```powershell
# 1. ツール類（初回のみ）
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS
# ターミナル再起動

# 2. ビルド
cd voir
npm install
npm run build
```

---

### トラブルシューティング

| 症状 | 対処 |
|------|------|
| `npm` でスクリプト実行エラー | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `error: linker 'link.exe' not found` | Build Tools を再インストールし、ターミナルを再起動 |
| `failed to run light.exe`（MSI エラー） | VBSCRIPT を有効化、または `tauri.conf.json` で `"targets": ["nsis"]` に変更 |
| `error[E0463]: can't find crate` | `rustup update stable` で Rust を更新 |
| `0x8a15005e` 証明書エラー（winget） | `winget settings --enable BypassCertificatePinningForMicrosoftStore` |
| `Permission xxx not found` | `capabilities/default.json` から該当パーミッションを削除 |
| `plugins.xxx` デシリアライズエラー | `tauri.conf.json` の `"plugins"` を `{}` に変更 |
| 起動しても何も表示されない | `npx tauri dev` でコンソールエラーを確認 |
| ビルドが遅い | SSD 上でビルド、ウイルス対策の除外リストに `target\` を追加 |

</details>

---

<a id="english"></a>

<details>
<summary><h2>🇬🇧 English — Windows Build Environment Setup Guide</h2></summary>

Complete instructions to build Voir from scratch. Estimated time: 15–20 minutes.

---

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Visual Studio Build Tools | 2022+ | C++ compiler (required by Rust) |
| WebView2 Runtime | Latest | Tauri rendering engine (pre-installed on Win10/11) |
| Rust | Latest stable | Entire backend |
| Node.js | 18+ (LTS recommended) | Tauri CLI + vendor bundling |

---

### Step 1: Visual Studio C++ Build Tools

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

Or download from https://visualstudio.microsoft.com/visual-cpp-build-tools/ and check "Desktop development with C++".

### Step 2: WebView2 Runtime (Check Only)

**Pre-installed** on Windows 10 (1803+) / Windows 11. Usually skippable.

### Step 3: Install Rust

```powershell
winget install Rustlang.Rustup
```

Or download from https://www.rust-lang.org/tools/install.

> ⚠ Restart your terminal after installation.

### Step 4: Install Node.js

```powershell
winget install OpenJS.NodeJS.LTS
```

> ⚠ If PowerShell blocks `npm` with a script execution error:
> ```powershell
> Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

### Step 5: Build

```powershell
cd voir
npm install
npm run build
```

- `npm run build` automatically runs `npm run vendor` (library bundling) → `tauri build` (Rust compile + installer)
- First build takes **5–10 minutes**. Subsequent builds take **1–2 minutes**

### Output

```
src-tauri\target\release\Voir.exe                              ← Portable exe
src-tauri\target\release\bundle\nsis\Voir_0.1.0_x64-setup.exe  ← NSIS installer
src-tauri\target\release\bundle\msi\Voir_0.1.0_x64_en-US.msi   ← MSI installer
```

---

### Development Mode

```powershell
npm run dev
```

---

### Quick Start Summary

```powershell
# 1. Tools (one-time)
winget install Microsoft.VisualStudio.2022.BuildTools --override "--add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS
# Restart terminal

# 2. Build
cd voir
npm install
npm run build
```

---

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| `npm` script execution error | `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `error: linker 'link.exe' not found` | Reinstall Build Tools and restart terminal |
| `failed to run light.exe` (MSI) | Enable VBSCRIPT, or change to `"targets": ["nsis"]` |
| `error[E0463]: can't find crate` | `rustup update stable` |
| `0x8a15005e` certificate error (winget) | `winget settings --enable BypassCertificatePinningForMicrosoftStore` |
| `Permission xxx not found` | Remove the permission from `capabilities/default.json` |
| `plugins.xxx` deserialization error | Change `"plugins"` to `{}` in `tauri.conf.json` |
| Window opens but blank | Run `npx tauri dev` to see console errors |
| Slow build | Build on SSD, exclude `target\` from antivirus |

</details>
