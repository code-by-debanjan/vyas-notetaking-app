// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyasa-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import html2canvas from "html2canvas";
import { computeDiff, getDiffStats, DiffLine } from "../utils/diff";

export interface CompareTab {
  id: string;
  title: string;
  content: string;
  filePath: string | null;
}

interface CompareViewProps {
  leftTab: CompareTab;
  rightTab: CompareTab;
  onClose: () => void;
  onUpdateLeft: (content: string) => void;
  onUpdateRight: (content: string) => void;
  screenshotFolder: string;
}

function CompareView({
  leftTab,
  rightTab,
  onClose,
  onUpdateLeft,
  onUpdateRight,
  screenshotFolder,
}: CompareViewProps) {
  const [leftContent, setLeftContent] = useState(leftTab.content);
  const [rightContent, setRightContent] = useState(rightTab.content);
  const [diffLines, setDiffLines] = useState<DiffLine[]>([]);
  const [editingSide, setEditingSide] = useState<"left" | "right" | null>(null);
  const [screenshotMessage, setScreenshotMessage] = useState<{
    title: string;
    text: string;
  } | null>(null);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // Compute diff whenever content changes
  const runDiff = useCallback(() => {
    const diff = computeDiff(leftContent, rightContent);
    setDiffLines(diff);
  }, [leftContent, rightContent]);

  useEffect(() => {
    runDiff();
  }, [runDiff]);

  // Push edits back to App tabs
  useEffect(() => {
    onUpdateLeft(leftContent);
  }, [leftContent]);

  useEffect(() => {
    onUpdateRight(rightContent);
  }, [rightContent]);

  // Sync scroll between panels
  const handleScroll = useCallback((source: "left" | "right") => {
    if (syncing.current) return;
    syncing.current = true;
    const from =
      source === "left" ? leftPanelRef.current : rightPanelRef.current;
    const to =
      source === "left" ? rightPanelRef.current : leftPanelRef.current;
    if (from && to) {
      to.scrollTop = from.scrollTop;
      to.scrollLeft = from.scrollLeft;
    }
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  // Screenshot handler for compare view
  const handleCompareScreenshot = useCallback(async () => {
    if (!compareRef.current) return;
    try {
      const editBtns = compareRef.current.querySelectorAll(
        ".compare-edit-btn, .compare-save-btn"
      );
      editBtns.forEach(
        (btn) => ((btn as HTMLElement).style.visibility = "hidden")
      );

      // Get the actual computed background color so the screenshot respects the current theme
      const computedBg = getComputedStyle(compareRef.current).getPropertyValue('--bg-primary').trim()
        || getComputedStyle(compareRef.current).backgroundColor
        || '#ffffff';

      const canvas = await html2canvas(compareRef.current, {
        backgroundColor: computedBg,
        useCORS: true,
        scale: window.devicePixelRatio,
      });

      editBtns.forEach(
        (btn) => ((btn as HTMLElement).style.visibility = "")
      );

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("Failed to create image blob");
      const arrayBuffer = await blob.arrayBuffer();
      const data = Array.from(new Uint8Array(arrayBuffer));
      const savedPath = await invoke<string>("save_screenshot", {
        folder: screenshotFolder,
        data,
      });
      setScreenshotMessage({ title: "Screenshot Saved", text: savedPath });
    } catch (err) {
      console.error("Compare screenshot failed:", err);
      setScreenshotMessage({ title: "Screenshot Failed", text: String(err) });
    }
  }, [screenshotFolder]);

  const stats = getDiffStats(diffLines);
  const leftLines = leftContent.split("\n");
  const rightLines = rightContent.split("\n");

  const handleLeftLineEdit = useCallback(
    (lineIdx: number, newText: string) => {
      const lines = leftContent.split("\n");
      lines[lineIdx] = newText;
      setLeftContent(lines.join("\n"));
    },
    [leftContent]
  );

  const handleRightLineEdit = useCallback(
    (lineIdx: number, newText: string) => {
      const lines = rightContent.split("\n");
      lines[lineIdx] = newText;
      setRightContent(lines.join("\n"));
    },
    [rightContent]
  );

  return (
    <div className="compare-view" ref={compareRef}>
      {/* Header */}
      <div className="compare-header">
        <div className="compare-header-left">
          <svg
            className="compare-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3v18M3 12h18" />
          </svg>
          <span className="compare-title">Compare Files</span>
        </div>
        <div className="compare-header-actions">
          <div className="compare-stats">
            <span className="stat-added">+{stats.additions}</span>
            <span className="stat-removed">−{stats.deletions}</span>
            <span className="stat-unchanged">
              {stats.unchanged} unchanged
            </span>
          </div>

          {/* Edit toggle */}
          {editingSide === null ? (
            <button
              className="compare-edit-btn"
              onClick={() => setEditingSide("left")}
              title="Enable Editing"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          ) : (
            <button
              className="compare-save-btn"
              onClick={() => setEditingSide(null)}
              title="Done Editing"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Done
            </button>
          )}

          {/* Screenshot button */}
          <button
            className="compare-screenshot-btn"
            onClick={handleCompareScreenshot}
            title="Take Screenshot (Compare)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <button
            className="compare-close-btn"
            onClick={onClose}
            title="Close Compare"
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <line
                x1="1"
                y1="1"
                x2="11"
                y2="11"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <line
                x1="11"
                y1="1"
                x2="1"
                y2="11"
                stroke="currentColor"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* File name labels */}
      <div className="compare-selectors">
        <div className="compare-selector">
          <div className="compare-file-label">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="compare-file-name">{leftTab.title}</span>
            {leftTab.filePath && (
              <span className="compare-filepath" title={leftTab.filePath}>
                {leftTab.filePath}
              </span>
            )}
          </div>
        </div>
        <div className="compare-vs">VS</div>
        <div className="compare-selector">
          <div className="compare-file-label">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="compare-file-name">{rightTab.title}</span>
            {rightTab.filePath && (
              <span className="compare-filepath" title={rightTab.filePath}>
                {rightTab.filePath}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-side panels */}
      {diffLines.length > 0 &&
      !diffLines.every((l) => l.type === "equal") ? (
        <div className="compare-panels">
          {/* Left panel */}
          <div
            className="compare-panel"
            ref={leftPanelRef}
            onScroll={() => handleScroll("left")}
          >
            <div className="compare-panel-header">
              <span className="compare-panel-name">{leftTab.title}</span>
              <span className="compare-panel-tag tag-original">Original</span>
            </div>
            <div className="compare-lines">
              {diffLines.map((line, i) => {
                if (line.type === "added") {
                  return (
                    <div key={i} className="diff-line diff-placeholder">
                      <span className="diff-line-no"></span>
                      <span className="diff-line-marker"></span>
                      <span className="diff-line-text"></span>
                    </div>
                  );
                }
                const lineIdx = (line.leftLineNo ?? 1) - 1;
                return (
                  <div
                    key={i}
                    className={`diff-line ${
                      line.type === "removed" ? "diff-removed" : "diff-equal"
                    }`}
                  >
                    <span className="diff-line-no">
                      {line.leftLineNo ?? ""}
                    </span>
                    <span className="diff-line-marker">
                      {line.type === "removed" ? "−" : " "}
                    </span>
                    {editingSide !== null ? (
                      <input
                        className="diff-line-input"
                        value={leftLines[lineIdx] ?? ""}
                        onChange={(e) =>
                          handleLeftLineEdit(lineIdx, e.target.value)
                        }
                        spellCheck={false}
                      />
                    ) : (
                      <span className="diff-line-text">{line.text}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <div
            className="compare-panel"
            ref={rightPanelRef}
            onScroll={() => handleScroll("right")}
          >
            <div className="compare-panel-header">
              <span className="compare-panel-name">{rightTab.title}</span>
              <span className="compare-panel-tag tag-modified">Modified</span>
            </div>
            <div className="compare-lines">
              {diffLines.map((line, i) => {
                if (line.type === "removed") {
                  return (
                    <div key={i} className="diff-line diff-placeholder">
                      <span className="diff-line-no"></span>
                      <span className="diff-line-marker"></span>
                      <span className="diff-line-text"></span>
                    </div>
                  );
                }
                const lineIdx = (line.rightLineNo ?? 1) - 1;
                return (
                  <div
                    key={i}
                    className={`diff-line ${
                      line.type === "added" ? "diff-added" : "diff-equal"
                    }`}
                  >
                    <span className="diff-line-no">
                      {line.rightLineNo ?? ""}
                    </span>
                    <span className="diff-line-marker">
                      {line.type === "added" ? "+" : " "}
                    </span>
                    {editingSide !== null ? (
                      <input
                        className="diff-line-input"
                        value={rightLines[lineIdx] ?? ""}
                        onChange={(e) =>
                          handleRightLineEdit(lineIdx, e.target.value)
                        }
                        spellCheck={false}
                      />
                    ) : (
                      <span className="diff-line-text">{line.text}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : diffLines.length > 0 &&
        diffLines.every((l) => l.type === "equal") ? (
        <div className="compare-empty">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
          >
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
          <span>Files are identical</span>
        </div>
      ) : (
        <div className="compare-empty">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="9" y1="13" x2="15" y2="13" />
            <line x1="9" y1="17" x2="13" y2="17" />
          </svg>
          <span>Both files are empty</span>
        </div>
      )}

      {/* Screenshot result modal */}
      {screenshotMessage && (
        <div
          className="about-overlay"
          onClick={() => setScreenshotMessage(null)}
        >
          <div
            className="about-modal dialog-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <img src="/logo.png" alt="Vyasa" className="dialog-logo" />
            <div className="dialog-title">{screenshotMessage.title}</div>
            <div className="screenshot-result-path">
              {screenshotMessage.text}
            </div>
            <button
              className="about-close"
              onClick={() => setScreenshotMessage(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompareView;
