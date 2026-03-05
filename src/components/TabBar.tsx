// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyas-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import type { TabData } from "../App";

interface TabBarProps {
  tabs: TabData[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

interface ContextMenu {
  x: number;
  y: number;
  tabId: string;
  filePath: string | null;
}

function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab, onNewTab }: TabBarProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, tab: TabData) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id, filePath: tab.filePath });
  }, []);

  const handleOpenInExplorer = useCallback(async () => {
    if (!contextMenu?.filePath) return;
    try {
      await invoke("show_in_explorer", { path: contextMenu.filePath });
    } catch (err) {
      console.error("Failed to open in explorer:", err);
    }
    setContextMenu(null);
  }, [contextMenu]);

  const tabBarContent = (
    <div
      className="tab-bar"
      onDoubleClick={(e) => {
        // Only trigger if double-clicking the empty area, not on a tab
        if ((e.target as HTMLElement).closest(".tab")) return;
        onNewTab();
      }}
    >
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => onSelectTab(tab.id)}
          onContextMenu={(e) => handleContextMenu(e, tab)}
        >
          <span className="tab-title">
            {tab.isModified && <span className="tab-modified">●</span>}
            {tab.title}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab.id);
            }}
            title="Close tab"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );

  // Render context menu via portal so it's not clipped by tab-bar overflow
  return (
    <>
      {tabBarContent}
      {contextMenu && createPortal(
        <div
          ref={menuRef}
          className="tab-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="tab-context-item"
            onClick={() => { onCloseTab(contextMenu.tabId); setContextMenu(null); }}
          >
            Close Tab
          </button>
          {contextMenu.filePath && (
            <button
              className="tab-context-item"
              onClick={handleOpenInExplorer}
            >
              Open in File Explorer
            </button>
          )}
        </div>,
        document.querySelector('.app') || document.body
      )}
    </>
  );
}

export default TabBar;
