// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyas-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

import { useState, useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import html2canvas from "html2canvas";
import { detectFormat, convertContent } from "./utils/formatConverter";
import MenuBar from "./components/MenuBar";
import StatusBar from "./components/StatusBar";
import TabBar from "./components/TabBar";
import FontBar from "./components/FontBar";
import CompareView from "./components/CompareView";

export interface TabData {
  id: string;
  title: string;
  content: string;
  filePath: string | null;
  isModified: boolean;
  fontSize: number;
  fontFamily: string;
}

let tabCounter = 1;

function createNewTab(): TabData {
  const id = `tab-${Date.now()}-${tabCounter++}`;
  return {
    id,
    title: "Untitled",
    content: "",
    filePath: null,
    isModified: false,
    fontSize: 14,
    fontFamily: "Cascadia Code",
  };
}

function App() {
  const [tabs, setTabs] = useState<TabData[]>([createNewTab()]);
  const [activeTabId, setActiveTabId] = useState(tabs[0].id);
  const [wordWrap, setWordWrap] = useState(true);
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("vyas-theme");
    return saved === "light" || saved === "dark" ? saved : "dark";
  });
  const setTheme = useCallback((t: "light" | "dark") => {
    setThemeState(t);
    localStorage.setItem("vyas-theme", t);
  }, []);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [screenshotFolder, setScreenshotFolder] = useState("");
  const [screenshotMessage, setScreenshotMessage] = useState<{ title: string; text: string } | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [savePrompt, setSavePrompt] = useState<{ tabId: string; tabTitle: string } | null>(null);
  const [formatWarning, setFormatWarning] = useState<{ tabId: string } | null>(null);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const appRef = useRef<HTMLDivElement>(null);

  // Undo/Redo history per tab
  const undoHistoryRef = useRef<Map<string, { stack: string[]; index: number; lastTime: number }>>(new Map());
  const UNDO_DEBOUNCE_MS = 400;
  const UNDO_MAX_STACK = 500;

  const activeTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0];

  // Cursor position tracking
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  const updateCursorPosition = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const text = el.value.substring(0, el.selectionStart);
    const lines = text.split("\n");
    setCursorLine(lines.length);
    setCursorCol(lines[lines.length - 1].length + 1);
  }, []);

  // Initialize screenshot folder
  useEffect(() => {
    invoke<string>("get_pictures_dir").then(setScreenshotFolder).catch(console.error);
  }, []);

  // Load recent files on startup
  useEffect(() => {
    invoke<string[]>("load_recent_files").then(setRecentFiles).catch(console.error);
  }, []);

  // Helper to add a file path to the recent files list
  const addToRecentFiles = useCallback((filePath: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.toLowerCase() !== filePath.toLowerCase());
      const updated = [filePath, ...filtered].slice(0, 10);
      invoke("save_recent_files", { files: updated }).catch(console.error);
      return updated;
    });
  }, []);

  // Restore session from previous app launch
  // Restore session and open CLI file arg in a single coordinated flow
  // to prevent the race condition where session restore overwrites CLI-opened file
  const sessionRestoredRef = useRef(false);
  useEffect(() => {
    if (sessionRestoredRef.current) return;
    sessionRestoredRef.current = true;

    (async () => {
      // Step 1: Restore session
      let restoredTabs: TabData[] = [];
      let restoredActiveIndex = 0;
      try {
        const result = await invoke<[Array<{ title: string; content: string; file_path: string | null }>, number] | null>("load_session");
        if (result) {
          const [savedTabs, activeIndex] = result;
          if (savedTabs && savedTabs.length > 0) {
            for (const st of savedTabs) {
              const tab = createNewTab();
              tab.title = st.title;
              tab.filePath = st.file_path;
              if (st.file_path) {
                try {
                  tab.content = await invoke<string>("read_file", { path: st.file_path });
                } catch {
                  tab.content = st.content;
                }
              } else {
                tab.content = st.content;
              }
              tab.isModified = false;
              restoredTabs.push(tab);
            }
            restoredActiveIndex = Math.min(activeIndex, restoredTabs.length - 1);
          }
        }
      } catch (err) {
        console.error("Failed to restore session:", err);
      }

      // Step 2: Check for CLI file arg (e.g., right-click "Open with" in Windows Explorer)
      try {
        const filePath = await invoke<string | null>("get_cli_file_arg");
        if (filePath) {
          const content: string = await invoke("read_file", { path: filePath });
          const fileName = filePath.split("\\").pop()?.split("/").pop() ?? "Untitled";
          const newTab = createNewTab();
          newTab.title = fileName;
          newTab.content = content;
          newTab.filePath = filePath;
          newTab.isModified = false;

          // Don't duplicate if the file is already in restored tabs
          const existing = restoredTabs.find((t) => t.filePath?.toLowerCase() === filePath.toLowerCase());
          if (existing) {
            // File already in session — just activate it
            if (restoredTabs.length > 0) {
              setTabs(restoredTabs);
              setActiveTabId(existing.id);
            }
          } else if (restoredTabs.length > 0) {
            // Append file tab to restored session
            setTabs([...restoredTabs, newTab]);
            setActiveTabId(newTab.id);
          } else {
            // No session — just open the file
            setTabs([newTab]);
            setActiveTabId(newTab.id);
          }
          addToRecentFiles(filePath);
          return;
        }
      } catch (err) {
        console.error("Failed to open file from CLI arg:", err);
      }

      // Step 3: No CLI file — apply restored session if any
      if (restoredTabs.length > 0) {
        setTabs(restoredTabs);
        setActiveTabId(restoredTabs[restoredActiveIndex].id);
      }
    })();
  }, [addToRecentFiles]);

  // Listen for files opened from second instances (single-instance plugin)
  useEffect(() => {
    const unlisten = listen<string>("open-file", async (event) => {
      const filePath = event.payload;
      if (!filePath) return;
      try {
        const content: string = await invoke("read_file", { path: filePath });
        const fileName = filePath.split("\\").pop()?.split("/").pop() ?? "Untitled";
        const newTab = createNewTab();
        newTab.title = fileName;
        newTab.content = content;
        newTab.filePath = filePath;
        newTab.isModified = false;
        setTabs((prev) => {
          // Replace the default empty tab if it's the only one and untouched
          if (prev.length === 1 && !prev[0].isModified && !prev[0].filePath && prev[0].content === "") {
            setActiveTabId(newTab.id);
            return [newTab];
          }
          // Don't open duplicate if already open
          const existing = prev.find((t) => t.filePath === filePath);
          if (existing) {
            setActiveTabId(existing.id);
            return prev;
          }
          return [...prev, newTab];
        });
        setActiveTabId(newTab.id);
        addToRecentFiles(filePath);
      } catch (err) {
        console.error("Failed to open file from event:", err);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [addToRecentFiles]);

  // Track window maximized state
  useEffect(() => {
    const appWindow = getCurrentWindow();
    // Check initial state
    appWindow.isMaximized().then(setIsMaximized).catch(console.error);
    // Listen for resize events and update state
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  // Keep refs for session save on close
  const tabsRef = useRef(tabs);
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => { tabsRef.current = tabs; }, [tabs]);
  useEffect(() => { activeTabIdRef.current = activeTabId; }, [activeTabId]);

  // Save session when the window is about to close
  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      try {
        const currentTabs = tabsRef.current;
        const currentActiveId = activeTabIdRef.current;
        const activeIndex = Math.max(0, currentTabs.findIndex((t) => t.id === currentActiveId));
        const sessionTabs = currentTabs.map((t) => ({
          title: t.title,
          content: t.content,
          file_path: t.filePath,
        }));
        await invoke("save_session", { tabs: sessionTabs, activeIndex });
      } catch (err) {
        console.error("Failed to save session:", err);
      }
      await appWindow.destroy();
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  const handleScreenshot = useCallback(async () => {
    if (!appRef.current) return;
    try {
      // html2canvas can't render <textarea> properly (flattens to one line,
      // ignores selection). Temporarily overlay each textarea with a styled
      // <div> that mirrors its content so the capture looks correct.
      const textareas = appRef.current.querySelectorAll("textarea");
      const overlays: HTMLDivElement[] = [];

      textareas.forEach((ta) => {
        const overlay = document.createElement("div");
        const style = window.getComputedStyle(ta);

        // Copy all relevant styles
        overlay.style.position = "absolute";
        overlay.style.top = ta.offsetTop + "px";
        overlay.style.left = ta.offsetLeft + "px";
        overlay.style.width = style.width;
        overlay.style.height = style.height;
        overlay.style.padding = style.padding;
        overlay.style.fontFamily = style.fontFamily;
        overlay.style.fontSize = style.fontSize;
        overlay.style.fontWeight = style.fontWeight;
        overlay.style.lineHeight = style.lineHeight;
        overlay.style.letterSpacing = style.letterSpacing;
        overlay.style.tabSize = style.tabSize;
        overlay.style.whiteSpace = style.whiteSpace === "normal" ? "pre-wrap" : style.whiteSpace;
        overlay.style.wordWrap = style.wordWrap;
        overlay.style.overflowWrap = style.overflowWrap;
        overlay.style.color = style.color;
        overlay.style.background = style.backgroundColor;
        overlay.style.overflow = "hidden";
        overlay.style.zIndex = "9999";
        overlay.style.boxSizing = "border-box";
        overlay.style.caretColor = "transparent";

        // Preserve the scroll position
        overlay.scrollTop = ta.scrollTop;
        overlay.scrollLeft = ta.scrollLeft;

        // Build content with selection highlighting
        const text = ta.value;
        const selStart = ta.selectionStart;
        const selEnd = ta.selectionEnd;

        if (selStart !== selEnd) {
          // There's a selection — render with highlight
          const before = text.substring(0, selStart);
          const selected = text.substring(selStart, selEnd);
          const after = text.substring(selEnd);

          const escapeHtml = (s: string) =>
            s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

          overlay.innerHTML =
            escapeHtml(before) +
            '<span style="background:rgba(124,58,237,0.35);border-radius:2px">' +
            escapeHtml(selected) +
            "</span>" +
            escapeHtml(after);
        } else {
          overlay.textContent = text;
        }

        // Insert the overlay right on top of the textarea
        ta.parentElement!.style.position = "relative";
        ta.parentElement!.appendChild(overlay);
        overlays.push(overlay);
      });

      // Get actual background color so screenshot respects current theme
      const computedBg = getComputedStyle(appRef.current).getPropertyValue('--bg-primary').trim()
        || getComputedStyle(appRef.current).backgroundColor
        || '#ffffff';

      const canvas = await html2canvas(appRef.current, {
        backgroundColor: computedBg,
        useCORS: true,
        scale: window.devicePixelRatio,
      });

      // Remove overlays
      overlays.forEach((o) => o.remove());

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
      console.error("Screenshot failed:", err);
      setScreenshotMessage({ title: "Screenshot Failed", text: String(err) });
    }
  }, [screenshotFolder]);

  const updateTab = useCallback(
    (id: string, changes: Partial<TabData>) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...changes } : t))
      );
    },
    []
  );

  const getUndoEntry = useCallback((tabId: string, initialContent?: string) => {
    let entry = undoHistoryRef.current.get(tabId);
    if (!entry) {
      entry = { stack: [initialContent ?? ""], index: 0, lastTime: 0 };
      undoHistoryRef.current.set(tabId, entry);
    }
    return entry;
  }, []);

  const handleContentChange = useCallback(
    (value: string) => {
      updateTab(activeTabId, { content: value, isModified: true });

      const entry = getUndoEntry(activeTabId);
      const now = Date.now();
      // Trim any redo history beyond current index
      entry.stack = entry.stack.slice(0, entry.index + 1);
      if (now - entry.lastTime < UNDO_DEBOUNCE_MS) {
        // Coalesce: replace last entry
        entry.stack[entry.index] = value;
      } else {
        // New snapshot
        entry.stack.push(value);
        entry.index = entry.stack.length - 1;
      }
      // Limit stack size
      if (entry.stack.length > UNDO_MAX_STACK) {
        const excess = entry.stack.length - UNDO_MAX_STACK;
        entry.stack = entry.stack.slice(excess);
        entry.index = Math.max(0, entry.index - excess);
      }
      entry.lastTime = now;
    },
    [activeTabId, updateTab, getUndoEntry]
  );

  const handleUndo = useCallback(() => {
    const entry = getUndoEntry(activeTabId, activeTab.content);
    if (entry.index > 0) {
      entry.index--;
      const value = entry.stack[entry.index];
      updateTab(activeTabId, { content: value, isModified: true });
      entry.lastTime = 0; // Reset debounce so next edit creates new snapshot
    }
  }, [activeTabId, activeTab.content, updateTab, getUndoEntry]);

  const handleRedo = useCallback(() => {
    const entry = getUndoEntry(activeTabId, activeTab.content);
    if (entry.index < entry.stack.length - 1) {
      entry.index++;
      const value = entry.stack[entry.index];
      updateTab(activeTabId, { content: value, isModified: true });
      entry.lastTime = 0;
    }
  }, [activeTabId, activeTab.content, updateTab, getUndoEntry]);

  // === File Operations ===

  const handleNew = useCallback(() => {
    const newTab = createNewTab();
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleOpen = useCallback(async () => {
    try {
      const filePath = await open({
        multiple: false,
        filters: [
          { name: "Text Files", extensions: ["txt", "md", "json", "js", "ts", "html", "css", "xml", "csv", "log"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (filePath) {
        const content: string = await invoke("read_file", { path: filePath });
        const fileName = filePath.split("\\").pop()?.split("/").pop() ?? "Untitled";
        const newTab = createNewTab();
        newTab.title = fileName;
        newTab.content = content;
        newTab.filePath = filePath as string;
        newTab.isModified = false;
        setTabs((prev) => [...prev, newTab]);
        setActiveTabId(newTab.id);
        addToRecentFiles(filePath as string);
      }
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, [addToRecentFiles]);

  const handleOpenRecent = useCallback(async (filePath: string) => {
    try {
      // Check if already open in a tab
      const existing = tabs.find((t) => t.filePath?.toLowerCase() === filePath.toLowerCase());
      if (existing) {
        setActiveTabId(existing.id);
        return;
      }
      const content: string = await invoke("read_file", { path: filePath });
      const fileName = filePath.split("\\").pop()?.split("/").pop() ?? "Untitled";
      const newTab = createNewTab();
      newTab.title = fileName;
      newTab.content = content;
      newTab.filePath = filePath;
      newTab.isModified = false;
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      addToRecentFiles(filePath);
    } catch (err) {
      console.error("Failed to open recent file:", err);
    }
  }, [tabs, addToRecentFiles]);

  const handleSave = useCallback(async () => {
    if (activeTab.filePath) {
      try {
        const format = detectFormat(activeTab.filePath);
        const result = convertContent(activeTab.content, format, {
          fontSize: activeTab.fontSize,
          fontFamily: activeTab.fontFamily,
          title: activeTab.title,
        });

        if (result.type === "binary") {
          await invoke("write_binary_file", {
            path: activeTab.filePath,
            data: Array.from(new Uint8Array(result.data)),
          });
        } else {
          await invoke("write_file", {
            path: activeTab.filePath,
            content: result.data,
          });
        }
        updateTab(activeTabId, { isModified: false });
      } catch (err) {
        console.error("Failed to save file:", err);
      }
    } else {
      handleSaveAs();
    }
  }, [activeTab, activeTabId, updateTab]);

  const handleSaveAs = useCallback(async () => {
    try {
      // Determine a default file name from the current tab title
      const defaultName = activeTab.title !== "Untitled" ? activeTab.title : undefined;

      const filePath = await save({
        defaultPath: defaultName,
        filters: [
          { name: "Text Files", extensions: ["txt"] },
          { name: "CSV Files", extensions: ["csv"] },
          { name: "JSON Files", extensions: ["json"] },
          { name: "XML Files", extensions: ["xml"] },
          { name: "PDF Files", extensions: ["pdf"] },
          { name: "HTML Files", extensions: ["html", "htm"] },
          { name: "CSS Files", extensions: ["css"] },
          { name: "JavaScript Files", extensions: ["js"] },
          { name: "TypeScript Files", extensions: ["ts"] },
          { name: "Config Files", extensions: ["config", "cfg", "ini", "toml", "yaml", "yml"] },
          { name: "Log Files", extensions: ["log"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (filePath) {
        const format = detectFormat(filePath);
        const result = convertContent(activeTab.content, format, {
          fontSize: activeTab.fontSize,
          fontFamily: activeTab.fontFamily,
          title: activeTab.title,
        });

        if (result.type === "binary") {
          await invoke("write_binary_file", {
            path: filePath,
            data: Array.from(new Uint8Array(result.data)),
          });
        } else {
          await invoke("write_file", {
            path: filePath,
            content: result.data,
          });
        }

        const fileName = filePath.split("\\").pop()?.split("/").pop() ?? "Untitled";
        updateTab(activeTabId, {
          filePath,
          title: fileName,
          isModified: false,
        });
        addToRecentFiles(filePath);
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }, [activeTab, activeTabId, updateTab, addToRecentFiles]);

  const doCloseTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const remaining = prev.filter((t) => t.id !== tabId);
        if (remaining.length === 0) {
          const newTab = createNewTab();
          setActiveTabId(newTab.id);
          return [newTab];
        }
        if (activeTabId === tabId) {
          setActiveTabId(remaining[remaining.length - 1].id);
        }
        return remaining;
      });
    },
    [activeTabId]
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (tab?.isModified) {
        // Show custom save prompt dialog
        setSavePrompt({ tabId, tabTitle: tab.title });
      } else {
        doCloseTab(tabId);
      }
    },
    [tabs, doCloseTab]
  );

  // Save prompt: user clicked "Yes" → show format warning
  const handleSavePromptYes = useCallback(() => {
    if (!savePrompt) return;
    const tabId = savePrompt.tabId;
    setSavePrompt(null);
    setFormatWarning({ tabId });
  }, [savePrompt]);

  // Save prompt: user clicked "No" → close without saving
  const handleSavePromptNo = useCallback(() => {
    if (!savePrompt) return;
    const tabId = savePrompt.tabId;
    setSavePrompt(null);
    doCloseTab(tabId);
  }, [savePrompt, doCloseTab]);

  // Format warning: user clicked "Proceed" → show Save As dialog
  const handleFormatWarningProceed = useCallback(async () => {
    if (!formatWarning) return;
    const tabId = formatWarning.tabId;
    const tab = tabs.find((t) => t.id === tabId);
    setFormatWarning(null);
    if (!tab) return;

    try {
      if (tab.filePath) {
        const format = detectFormat(tab.filePath);
        const result = convertContent(tab.content, format, {
          fontSize: tab.fontSize,
          fontFamily: tab.fontFamily,
          title: tab.title,
        });

        if (result.type === "binary") {
          await invoke("write_binary_file", {
            path: tab.filePath,
            data: Array.from(new Uint8Array(result.data)),
          });
        } else {
          await invoke("write_file", { path: tab.filePath, content: result.data });
        }
        doCloseTab(tabId);
      } else {
        const filePath = await save({
          filters: [
            { name: "Text Files", extensions: ["txt"] },
            { name: "CSV Files", extensions: ["csv"] },
            { name: "JSON Files", extensions: ["json"] },
            { name: "XML Files", extensions: ["xml"] },
            { name: "PDF Files", extensions: ["pdf"] },
            { name: "All Files", extensions: ["*"] },
          ],
        });
        if (filePath) {
          const format = detectFormat(filePath);
          const result = convertContent(tab.content, format, {
            fontSize: tab.fontSize,
            fontFamily: tab.fontFamily,
            title: tab.title,
          });

          if (result.type === "binary") {
            await invoke("write_binary_file", {
              path: filePath,
              data: Array.from(new Uint8Array(result.data)),
            });
          } else {
            await invoke("write_file", { path: filePath, content: result.data });
          }
          doCloseTab(tabId);
        }
        // If user cancelled the save dialog, don't close the tab
      }
    } catch (err) {
      console.error("Failed to save file:", err);
    }
  }, [formatWarning, tabs, doCloseTab]);

  // Format warning: user clicked "Cancel" → go back, don't close
  const handleFormatWarningCancel = useCallback(() => {
    setFormatWarning(null);
  }, []);

  // === Edit Operations ===

  const handleFind = useCallback(() => {
    setFindOpen((prev) => !prev);
  }, []);

  const handleFindNext = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !findText) return;

    const text = el.value;
    const startPos = el.selectionEnd;
    const idx = text.indexOf(findText, startPos);

    if (idx !== -1) {
      el.setSelectionRange(idx, idx + findText.length);
      el.focus();
    } else {
      // Wrap around
      const wrapIdx = text.indexOf(findText);
      if (wrapIdx !== -1) {
        el.setSelectionRange(wrapIdx, wrapIdx + findText.length);
        el.focus();
      }
    }
  }, [findText]);

  const handleReplace = useCallback(() => {
    const el = textareaRef.current;
    if (!el || !findText) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selectedText = el.value.substring(start, end);

    if (selectedText === findText) {
      const newContent =
        el.value.substring(0, start) + replaceText + el.value.substring(end);
      handleContentChange(newContent);
      setTimeout(() => {
        el.setSelectionRange(
          start + replaceText.length,
          start + replaceText.length
        );
        handleFindNext();
      }, 0);
    } else {
      handleFindNext();
    }
  }, [findText, replaceText, handleContentChange, handleFindNext]);

  const handleReplaceAll = useCallback(() => {
    if (!findText) return;
    const newContent = activeTab.content.split(findText).join(replaceText);
    handleContentChange(newContent);
  }, [findText, replaceText, activeTab.content, handleContentChange]);

  // === Compare handler ===
  const handleCompare = useCallback(() => {
    const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
    if (tabs.length < 2) {
      setCompareError("You need at least 2 open tabs to compare. Open another file first.");
      return;
    }
    const nextIdx = activeIdx + 1 < tabs.length ? activeIdx + 1 : activeIdx - 1;
    if (nextIdx < 0 || nextIdx >= tabs.length) {
      setCompareError("Could not find a consecutive tab to compare with.");
      return;
    }
    setShowCompare(true);
  }, [tabs, activeTabId]);

  // === Keyboard Shortcuts ===

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "n":
            e.preventDefault();
            handleNew();
            break;
          case "o":
            e.preventDefault();
            handleOpen();
            break;
          case "s":
            e.preventDefault();
            if (e.shiftKey) {
              handleSaveAs();
            } else {
              handleSave();
            }
            break;
          case "w":
            e.preventDefault();
            handleCloseTab(activeTabId);
            break;
          case "f":
            e.preventDefault();
            handleFind();
            break;
          case "h":
            e.preventDefault();
            setFindOpen(true);
            break;
          case "=":
          case "+":
            e.preventDefault();
            updateTab(activeTabId, { fontSize: Math.min(activeTab.fontSize + 2, 48) });
            break;
          case "-":
            e.preventDefault();
            updateTab(activeTabId, { fontSize: Math.max(activeTab.fontSize - 2, 8) });
            break;
          case "p":
            if (e.shiftKey) {
              e.preventDefault();
              handleScreenshot();
            }
            break;
          case "c":
            if (e.shiftKey) {
              e.preventDefault();
              handleCompare();
            }
            break;
          case "z":
            if (!e.shiftKey) {
              e.preventDefault();
              handleUndo();
            }
            break;
          case "y":
            e.preventDefault();
            handleRedo();
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleCloseTab, activeTabId, activeTab.fontSize, updateTab, handleFind, handleScreenshot, handleCompare, handleUndo, handleRedo]);

  const charCount = activeTab.content.length;
  const wordCount = activeTab.content.trim()
    ? activeTab.content.trim().split(/\s+/).length
    : 0;
  const lineCount = activeTab.content.split("\n").length;

  return (
    <div className={`app ${theme}`} ref={appRef}>
      <div className="title-bar">
        <div className="title-bar-text">
          <img src="/logo.png" alt="Vyas" className="title-bar-logo" />
          <span className="title-bar-name">VYAS</span>
          <span className="title-bar-separator"> : </span>
          <span className="title-bar-tagline">Compile Your Epic</span>
        </div>
        <div className="title-bar-controls">
          <button className="title-bar-btn minimize" onClick={() => getCurrentWindow().minimize()} aria-label="Minimize">
            <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
          </button>
          <button className="title-bar-btn maximize" onClick={async () => { await getCurrentWindow().toggleMaximize(); }} aria-label={isMaximized ? "Restore" : "Maximize"}>
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2" y="0" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/>
                <rect x="0" y="2" width="8" height="8" rx="1" fill="var(--bg-primary)" stroke="currentColor" strokeWidth="1"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1"/></svg>
            )}
          </button>
          <button className="title-bar-btn close" onClick={() => getCurrentWindow().close()} aria-label="Close">
            <svg width="10" height="10" viewBox="0 0 10 10"><line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2"/><line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2"/></svg>
          </button>
        </div>
      </div>
      <MenuBar
        onNew={handleNew}
        onOpen={handleOpen}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onFind={handleFind}
        onUndo={handleUndo}
        onRedo={handleRedo}
        wordWrap={wordWrap}
        onToggleWordWrap={() => setWordWrap((w) => !w)}
        fontSize={activeTab.fontSize}
        onFontSizeChange={(size: number) => updateTab(activeTabId, { fontSize: size })}
        theme={theme}
        onThemeChange={setTheme}
        onScreenshot={handleScreenshot}
        screenshotFolder={screenshotFolder}
        onScreenshotFolderChange={setScreenshotFolder}
        onCompare={handleCompare}
        recentFiles={recentFiles}
        onOpenRecent={handleOpenRecent}
      />
      <FontBar
        fontFamily={activeTab.fontFamily}
        onFontFamilyChange={(f: string) => updateTab(activeTabId, { fontFamily: f })}
        fontSize={activeTab.fontSize}
        onFontSizeChange={(size: number) => updateTab(activeTabId, { fontSize: size })}
        onScreenshot={handleScreenshot}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={handleNew}
      />
      {findOpen && (
        <div className="find-bar">
          <input
            type="text"
            placeholder="Find..."
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleFindNext();
              if (e.key === "Escape") setFindOpen(false);
            }}
            autoFocus
          />
          <input
            type="text"
            placeholder="Replace..."
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleReplace();
              if (e.key === "Escape") setFindOpen(false);
            }}
          />
          <button onClick={handleFindNext} title="Find Next">
            Find
          </button>
          <button onClick={handleReplace} title="Replace">
            Replace
          </button>
          <button onClick={handleReplaceAll} title="Replace All">
            All
          </button>
          <button onClick={() => setFindOpen(false)} title="Close" className="close-find">
            ✕
          </button>
        </div>
      )}
      <div className="editor-container">
        <div className="line-numbers">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i + 1} className="line-number">
              {i + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="editor"
          value={activeTab.content}
          onChange={(e) => handleContentChange(e.target.value)}
          onKeyUp={updateCursorPosition}
          onClick={updateCursorPosition}
          spellCheck={false}
          style={{
            fontSize: `${activeTab.fontSize}px`,
            fontFamily: `"${activeTab.fontFamily}", "Consolas", "Courier New", monospace`,
            whiteSpace: wordWrap ? "pre-wrap" : "pre",
            overflowWrap: wordWrap ? "break-word" : "normal",
          }}
          placeholder="Start typing..."
        />
      </div>
      <StatusBar
        line={cursorLine}
        column={cursorCol}
        charCount={charCount}
        wordCount={wordCount}
        lineCount={lineCount}
        fileName={activeTab.filePath ?? "Untitled"}
        isModified={activeTab.isModified}
        encoding="UTF-8"
      />

      {showCompare && (() => {
        const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
        const nextIdx = activeIdx + 1 < tabs.length ? activeIdx + 1 : activeIdx - 1;
        const leftTab = tabs[activeIdx];
        const rightTab = tabs[nextIdx];
        return (
          <div className="compare-overlay">
            <CompareView
              leftTab={{ id: leftTab.id, title: leftTab.title, content: leftTab.content, filePath: leftTab.filePath }}
              rightTab={{ id: rightTab.id, title: rightTab.title, content: rightTab.content, filePath: rightTab.filePath }}
              onClose={() => setShowCompare(false)}
              onUpdateLeft={(content) => updateTab(leftTab.id, { content, isModified: true })}
              onUpdateRight={(content) => updateTab(rightTab.id, { content, isModified: true })}
              screenshotFolder={screenshotFolder}
            />
          </div>
        );
      })()}

      {compareError && (
        <div className="about-overlay" onClick={() => setCompareError(null)}>
          <div className="about-modal dialog-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo.png" alt="Vyas" className="dialog-logo" />
            <div className="dialog-title">Cannot Compare</div>
            <div className="screenshot-result-path">{compareError}</div>
            <button className="about-close" onClick={() => setCompareError(null)}>OK</button>
          </div>
        </div>
      )}

      {screenshotMessage && (
        <div className="about-overlay" onClick={() => setScreenshotMessage(null)}>
          <div className="about-modal dialog-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo.png" alt="Vyas" className="dialog-logo" />
            <div className="dialog-title">{screenshotMessage.title}</div>
            <div className="screenshot-result-path">{screenshotMessage.text}</div>
            <button className="about-close" onClick={() => setScreenshotMessage(null)}>OK</button>
          </div>
        </div>
      )}

      {savePrompt && (
        <div className="about-overlay">
          <div className="about-modal dialog-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo.png" alt="Vyas" className="dialog-logo" />
            <div className="dialog-title">Unsaved Changes</div>
            <div className="screenshot-result-path">
              Do you want to save changes to "{savePrompt.tabTitle}"?
            </div>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-primary" onClick={handleSavePromptYes}>Yes</button>
              <button className="dialog-btn dialog-btn-secondary" onClick={handleSavePromptNo}>No</button>
            </div>
          </div>
        </div>
      )}

      {formatWarning && (
        <div className="about-overlay">
          <div className="about-modal dialog-modal" onClick={(e) => e.stopPropagation()}>
            <img src="/logo.png" alt="Vyas" className="dialog-logo" />
            <div className="dialog-title">Format Warning</div>
            <div className="screenshot-result-path">
              Saving in .txt will lose all formatting. Do you want to proceed?
            </div>
            <div className="dialog-buttons">
              <button className="dialog-btn dialog-btn-primary" onClick={handleFormatWarningProceed}>Proceed</button>
              <button className="dialog-btn dialog-btn-secondary" onClick={handleFormatWarningCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
