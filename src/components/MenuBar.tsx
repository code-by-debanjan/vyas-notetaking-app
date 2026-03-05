// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyasa-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

import { useState, useRef, useEffect } from "react";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";

interface MenuBarProps {
  onNew: () => void;
  onOpen: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onFind: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCompare: () => void;
  wordWrap: boolean;
  onToggleWordWrap: () => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  onScreenshot: () => void;
  screenshotFolder: string;
  onScreenshotFolderChange: (folder: string) => void;
  recentFiles: string[];
  onOpenRecent: (filePath: string) => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  checked?: boolean;
  submenu?: MenuItem[];
}

function MenuBar({
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  onFind,
  onUndo,
  onRedo,
  onCompare,
  wordWrap,
  onToggleWordWrap,
  fontSize,
  onFontSizeChange,
  theme,
  onThemeChange,
  onScreenshot,
  screenshotFolder,
  onScreenshotFolderChange,
  recentFiles,
  onOpenRecent,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showScreenshotSettings, setShowScreenshotSettings] = useState(false);
  const [tempFolder, setTempFolder] = useState("");
  const [showRecentSubmenu, setShowRecentSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setShowRecentSubmenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const menus: Record<string, MenuItem[]> = {
    File: [
      { label: "New", shortcut: "Ctrl+N", action: onNew },
      { label: "Open...", shortcut: "Ctrl+O", action: onOpen },
      { label: "Recent Open", action: () => setShowRecentSubmenu((v) => !v), submenu: [] },
      { separator: true, label: "" },
      { label: "Save", shortcut: "Ctrl+S", action: onSave },
      { label: "Save As...", shortcut: "Ctrl+Shift+S", action: onSaveAs },
    ],
    Edit: [
      { label: "Undo", shortcut: "Ctrl+Z", action: onUndo },
      { label: "Redo", shortcut: "Ctrl+Y", action: onRedo },
      { separator: true, label: "" },
      { label: "Find", shortcut: "Ctrl+F", action: onFind },
      { label: "Find & Replace", shortcut: "Ctrl+H", action: onFind },
      { separator: true, label: "" },
      { label: "Compare Files...", shortcut: "Ctrl+Shift+C", action: onCompare },
      { separator: true, label: "" },
      { label: "Take Screenshot", shortcut: "Ctrl+Shift+P", action: onScreenshot },
      {
        label: "Screenshot Settings...",
        action: () => {
          setTempFolder(screenshotFolder);
          setShowScreenshotSettings(true);
        },
      },
    ],
    View: [
      { label: "Word Wrap", action: onToggleWordWrap, checked: wordWrap },
      { separator: true, label: "" },
      {
        label: "Zoom In",
        shortcut: "Ctrl++",
        action: () => onFontSizeChange(Math.min(fontSize + 2, 48)),
      },
      {
        label: "Zoom Out",
        shortcut: "Ctrl+-",
        action: () => onFontSizeChange(Math.max(fontSize - 2, 8)),
      },
      {
        label: `Font Size: ${fontSize}px`,
        action: () => {},
      },
      { separator: true, label: "" },
      {
        label: "Light Theme",
        action: () => onThemeChange("light"),
        checked: theme === "light",
      },
      {
        label: "Dark Theme",
        action: () => onThemeChange("dark"),
        checked: theme === "dark",
      },
    ],
    Help: [
      {
        label: "About Vyasa",
        action: () => setShowAbout(true),
      },
      {
        label: "Keyboard Shortcuts",
        action: () => setShowShortcuts(true),
      },
    ],
  };

  return (
    <>
    <div className="menu-bar" ref={menuRef}>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className="menu-item-wrapper">
          <button
            className={`menu-trigger ${openMenu === name ? "active" : ""}`}
            onClick={() => {
              setOpenMenu(openMenu === name ? null : name);
              setShowRecentSubmenu(false);
            }}
            onMouseEnter={() => { if (openMenu) { setOpenMenu(name); setShowRecentSubmenu(false); } }}
          >
            {name}
          </button>
          {openMenu === name && (
            <div className="menu-dropdown">
              {items.map((item, i) =>
                item.separator ? (
                  <div key={i} className="menu-separator" />
                ) : item.submenu !== undefined ? (
                  <div key={i} className="menu-submenu-wrapper"
                    onMouseEnter={() => setShowRecentSubmenu(true)}
                    onMouseLeave={() => setShowRecentSubmenu(false)}
                  >
                    <button
                      className="menu-dropdown-item"
                      onClick={() => setShowRecentSubmenu((v) => !v)}
                    >
                      <span className="menu-check"></span>
                      <span className="menu-label">{item.label}</span>
                      <span className="menu-shortcut">▶</span>
                    </button>
                    {showRecentSubmenu && (
                      <div className="menu-dropdown menu-submenu">
                        {recentFiles.length === 0 ? (
                          <div className="menu-dropdown-item menu-item-disabled">
                            <span className="menu-check"></span>
                            <span className="menu-label">No recent files</span>
                          </div>
                        ) : (
                          recentFiles.map((filePath, j) => {
                            const fileName = filePath.split("\\").pop()?.split("/").pop() ?? filePath;
                            return (
                              <button
                                key={j}
                                className="menu-dropdown-item"
                                onClick={() => {
                                  onOpenRecent(filePath);
                                  setOpenMenu(null);
                                  setShowRecentSubmenu(false);
                                }}
                                title={filePath}
                              >
                                <span className="menu-check"></span>
                                <span className="menu-label menu-recent-label">
                                  <span className="menu-recent-name">{fileName}</span>
                                  <span className="menu-recent-path">{filePath}</span>
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    key={i}
                    className="menu-dropdown-item"
                    onClick={() => {
                      item.action?.();
                      setOpenMenu(null);
                    }}
                  >
                    <span className="menu-check">
                      {item.checked ? "✓" : ""}
                    </span>
                    <span className="menu-label">{item.label}</span>
                    {item.shortcut && (
                      <span className="menu-shortcut">{item.shortcut}</span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>

    {showAbout && (
      <div className="about-overlay" onClick={() => setShowAbout(false)}>
        <div className="about-modal" onClick={(e) => e.stopPropagation()}>
          <img src="/logo.png" alt="Vyasa" className="about-logo" />
          <div className="about-header">
            <span className="about-title">VYASA</span>
            <span className="about-subtitle">: Compile Your Epic</span>
          </div>
          <div className="about-version">Version 1.2.0</div>
          <div className="about-tagline">✦ For Indians, By an Indian ✦</div>
          <div className="about-copyright">© 2026 Debanjan Bhattacharya. Licensed under the MIT License.</div>
          <button className="about-close" onClick={() => setShowAbout(false)}>OK</button>
        </div>
      </div>
    )}

    {showShortcuts && (
      <div className="about-overlay" onClick={() => setShowShortcuts(false)}>
        <div className="about-modal dialog-modal" onClick={(e) => e.stopPropagation()}>
          <img src="/logo.png" alt="Vyasa" className="dialog-logo" />
          <div className="dialog-title">Keyboard Shortcuts</div>
          <div className="shortcuts-grid">
            <div className="shortcut-row"><kbd>Ctrl+N</kbd><span>New File</span></div>
            <div className="shortcut-row"><kbd>Ctrl+O</kbd><span>Open File</span></div>
            <div className="shortcut-row"><kbd>Ctrl+S</kbd><span>Save</span></div>
            <div className="shortcut-row"><kbd>Ctrl+Shift+S</kbd><span>Save As</span></div>
            <div className="shortcut-row"><kbd>Ctrl+W</kbd><span>Close Tab</span></div>
            <div className="shortcut-row"><kbd>Ctrl+F</kbd><span>Find</span></div>
            <div className="shortcut-row"><kbd>Ctrl+H</kbd><span>Find & Replace</span></div>
            <div className="shortcut-row"><kbd>Ctrl+Shift+C</kbd><span>Compare Files</span></div>
            <div className="shortcut-row"><kbd>Ctrl+Shift+P</kbd><span>Screenshot</span></div>
            <div className="shortcut-row"><kbd>Ctrl++</kbd><span>Zoom In</span></div>
            <div className="shortcut-row"><kbd>Ctrl+-</kbd><span>Zoom Out</span></div>
          </div>
          <button className="about-close" onClick={() => setShowShortcuts(false)}>OK</button>
        </div>
      </div>
    )}

    {showScreenshotSettings && (
      <div className="about-overlay" onClick={() => setShowScreenshotSettings(false)}>
        <div className="about-modal dialog-modal" onClick={(e) => e.stopPropagation()}>
          <img src="/logo.png" alt="Vyasa" className="dialog-logo" />
          <div className="dialog-title">Screenshot Settings</div>
          <div className="screenshot-settings">
            <label className="settings-label">Save Folder</label>
            <div className="settings-folder-row">
              <input
                type="text"
                className="settings-folder-input"
                value={tempFolder}
                onChange={(e) => setTempFolder(e.target.value)}
              />
              <button
                className="settings-browse-btn"
                onClick={async () => {
                  try {
                    const selected = await dialogOpen({
                      directory: true,
                      title: "Choose Screenshot Folder",
                    });
                    if (selected) setTempFolder(selected as string);
                  } catch (err) {
                    console.error("Folder selection failed:", err);
                  }
                }}
              >
                Browse...
              </button>
            </div>
          </div>
          <div className="settings-actions">
            <button
              className="about-close"
              onClick={() => {
                onScreenshotFolderChange(tempFolder);
                setShowScreenshotSettings(false);
              }}
            >
              Save
            </button>
            <button
              className="about-close settings-cancel"
              onClick={() => setShowScreenshotSettings(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export default MenuBar;
