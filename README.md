# VYASA: Compile Your Epic

A feature-rich desktop note-taking application built with **Tauri 2 + React + TypeScript**. Vyasa combines the simplicity of a text editor with modern UI design — glass-effect styling, system font selection, side-by-side file comparison, and screenshot capture.

_For Indians, by an Indian._

> **Current Version:** 1.0.3

## Features

- **Multi-tab editing** — Open and work on multiple files simultaneously
- **File operations** — New, Open, Save, Save As with native OS dialogs
- **Recent Open** — Quick access to recently opened files from the File menu
- **Find & Replace** — Full-text search with replace support
- **Compare Files** — Side-by-side diff view of consecutive open tabs with inline editing
- **System font selector** — Searchable dropdown with keyboard navigation for all installed fonts
- **Screenshot capture** — Save the editor or compare view as PNG to your Pictures folder
- **Glass UI** — Backdrop-filter blur effects with purple accent theming
- **Custom title bar** — Branded title bar with Vyasa logo
- **Dark/Light themes** — Switch from the View menu; theme persists across restarts
- **Line numbers** — Gutter with line number display
- **Word wrap** — Toggle via View menu
- **Zoom** — Ctrl+/Ctrl- to adjust font size
- **Status bar** — Line, column, word count, character count, file name, encoding
- **Keyboard shortcuts** — Full set of standard shortcuts
- **Unsaved changes detection** — Custom save prompt with format warning before closing modified files
- **Session persistence** — Tabs and content are restored when you reopen the app
- **File associations** — Open `.txt`, `.md`, `.json`, `.log`, `.csv`, `.xml`, `.html`, `.css`, `.js`, `.ts` files directly with Vyasa from Windows Explorer
- **Single instance** — Opening a file when Vyasa is already running opens it as a new tab instead of launching a second window

## Keyboard Shortcuts

| Shortcut     | Action          |
| ------------ | --------------- |
| Ctrl+N       | New File        |
| Ctrl+O       | Open File       |
| Ctrl+S       | Save            |
| Ctrl+Shift+S | Save As         |
| Ctrl+W       | Close Tab       |
| Ctrl+F       | Find            |
| Ctrl+H       | Find & Replace  |
| Ctrl+Shift+C | Compare Files   |
| Ctrl+Shift+P | Take Screenshot |
| Ctrl++       | Zoom In         |
| Ctrl+-       | Zoom Out        |

## Prerequisites

1. **Node.js** (v18+) — [nodejs.org](https://nodejs.org)
2. **Rust** — Install via [rustup.rs](https://rustup.rs)
3. **Visual Studio Build Tools** — Required on Windows for Rust:
   ```powershell
   # Run as Administrator:
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```

## Getting Started

```bash
# Install dependencies
npm install

# Start development (hot-reload frontend + Rust backend)
npm run tauri dev

# Build for production
npm run tauri build
```

The production build outputs to `src-tauri/target/release/` (executable) and `src-tauri/target/release/bundle/` (installer).

## Project Structure

```
vyasa-notetaking-app/
├── index.html              # Entry HTML
├── package.json            # npm config & dependencies
├── tsconfig.json           # TypeScript config
├── vite.config.ts          # Vite bundler config
├── public/
│   └── logo.png            # Vyasa brand logo
├── src/                    # React frontend
│   ├── main.tsx            # React entry point
│   ├── App.tsx             # Main app component (tabs, state, shortcuts)
│   ├── styles.css          # All styles (dark/light themes, glass effects)
│   ├── utils/
│   │   └── diff.ts         # LCS-based line diff algorithm
│   └── components/
│       ├── MenuBar.tsx     # File/Edit/View/Help menus + About dialog
│       ├── TabBar.tsx      # Multi-tab support with close buttons
│       ├── FontBar.tsx     # System font selector + size picker + screenshot button
│       ├── StatusBar.tsx   # Bottom status bar (line/col/counts/encoding)
│       └── CompareView.tsx # Side-by-side diff with inline editing & screenshot
└── src-tauri/              # Tauri/Rust backend
    ├── Cargo.toml          # Rust dependencies
    ├── tauri.conf.json     # Tauri configuration
    ├── capabilities/       # Permission configuration
    └── src/
        ├── main.rs         # Rust entry point
        └── lib.rs          # Commands: file I/O, fonts, screenshots, session, recent files
```

## Tech Stack

- **[Tauri 2](https://v2.tauri.app/)** — Lightweight native app framework (~5MB bundle)
- **[React 18](https://react.dev/)** — UI component library
- **[TypeScript](https://typescriptlang.org/)** — Type-safe JavaScript
- **[Vite](https://vitejs.dev/)** — Fast dev server & bundler
- **[html2canvas](https://html2canvas.hertzen.com/)** — DOM-to-image screenshot capture
- **[font-enumeration](https://crates.io/crates/font-enumeration)** — System font discovery (Rust)
- **[tauri-plugin-single-instance](https://crates.io/crates/tauri-plugin-single-instance)** — Single window enforcement

## License

© 2026 Debanjan Bhattacharya. All rights reserved.
