// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyas-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface FontBarProps {
  fontFamily: string;
  onFontFamilyChange: (font: string) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  onScreenshot?: () => void;
}

const FONT_SIZES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48, 56, 64, 72];

function FontBar({
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  onScreenshot,
}: FontBarProps) {
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontSearch, setFontSearch] = useState("");
  const [fontDropdownOpen, setFontDropdownOpen] = useState(false);
  const [sizeDropdownOpen, setSizeDropdownOpen] = useState(false);
  const [customSize, setCustomSize] = useState(String(fontSize));
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const fontRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef<HTMLDivElement>(null);
  const fontListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<string[]>("get_system_fonts")
      .then((fonts) => setSystemFonts(fonts))
      .catch((err) => {
        console.error("Failed to load system fonts:", err);
        // Fallback fonts
        setSystemFonts([
          "Arial",
          "Calibri",
          "Cascadia Code",
          "Comic Sans MS",
          "Consolas",
          "Courier New",
          "Georgia",
          "Impact",
          "Lucida Console",
          "Segoe UI",
          "Tahoma",
          "Times New Roman",
          "Trebuchet MS",
          "Verdana",
        ]);
      });
  }, []);

  useEffect(() => {
    setCustomSize(String(fontSize));
  }, [fontSize]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (fontRef.current && !fontRef.current.contains(e.target as Node)) {
        setFontDropdownOpen(false);
      }
      if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) {
        setSizeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredFonts = systemFonts.filter((f) =>
    f.toLowerCase().includes(fontSearch.toLowerCase())
  );

  // Reset highlight when search changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [fontSearch]);

  const handleFontSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredFonts.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredFonts.length) {
        onFontFamilyChange(filteredFonts[highlightedIndex]);
        setFontDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      setFontDropdownOpen(false);
    }
  };

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && fontListRef.current) {
      const items = fontListRef.current.querySelectorAll(".font-option");
      if (items[highlightedIndex]) {
        items[highlightedIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex]);

  const handleSizeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = parseInt(customSize, 10);
      if (!isNaN(val) && val >= 6 && val <= 120) {
        onFontSizeChange(val);
        setSizeDropdownOpen(false);
      }
    }
  };

  return (
    <div className="font-bar">
      {/* Font Family Selector */}
      <div className="font-selector" ref={fontRef}>
        <div
          className="font-selector-display"
          onClick={() => {
            setFontDropdownOpen(!fontDropdownOpen);
            setSizeDropdownOpen(false);
            setFontSearch("");
          }}
          style={{ fontFamily }}
        >
          <span className="font-selector-value">{fontFamily}</span>
          <span className="font-selector-arrow">▾</span>
        </div>
        {fontDropdownOpen && (
          <div className="font-dropdown">
            <input
              type="text"
              className="font-search"
              placeholder="Search fonts..."
              value={fontSearch}
              onChange={(e) => setFontSearch(e.target.value)}
              onKeyDown={handleFontSearchKeyDown}
              autoFocus
            />
            <div className="font-list" ref={fontListRef}>
              {filteredFonts.map((font, index) => (
                <div
                  key={font}
                  className={`font-option ${font === fontFamily ? "selected" : ""} ${index === highlightedIndex ? "highlighted" : ""}`}
                  style={{ fontFamily: font }}
                  onClick={() => {
                    onFontFamilyChange(font);
                    setFontDropdownOpen(false);
                  }}
                >
                  {font}
                </div>
              ))}
              {filteredFonts.length === 0 && (
                <div className="font-option disabled">No fonts found</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Font Size Selector */}
      <div className="size-selector" ref={sizeRef}>
        <div
          className="size-selector-display"
          onClick={() => {
            setSizeDropdownOpen(!sizeDropdownOpen);
            setFontDropdownOpen(false);
          }}
        >
          <input
            type="text"
            className="size-input"
            value={customSize}
            onChange={(e) => setCustomSize(e.target.value)}
            onKeyDown={handleSizeInputKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="size-selector-arrow">▾</span>
        </div>
        {sizeDropdownOpen && (
          <div className="size-dropdown">
            {FONT_SIZES.map((size) => (
              <div
                key={size}
                className={`size-option ${size === fontSize ? "selected" : ""}`}
                onClick={() => {
                  onFontSizeChange(size);
                  setSizeDropdownOpen(false);
                }}
              >
                {size}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Screenshot Button */}
      {onScreenshot && (
        <button
          className="screenshot-btn"
          onClick={onScreenshot}
          title="Take Screenshot (Ctrl+Shift+P)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M5 4L6 2h4l1 2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default FontBar;
