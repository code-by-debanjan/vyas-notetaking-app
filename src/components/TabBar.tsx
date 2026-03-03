// © 2026 Debanjan Bhattacharya. All rights reserved.

import type { TabData } from "../App";

interface TabBarProps {
  tabs: TabData[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: TabBarProps) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? "active" : ""}`}
          onClick={() => onSelectTab(tab.id)}
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
}

export default TabBar;
