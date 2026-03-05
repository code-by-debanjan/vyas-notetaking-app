// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyasa-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

interface StatusBarProps {
  line: number;
  column: number;
  charCount: number;
  wordCount: number;
  lineCount: number;
  fileName: string;
  isModified: boolean;
  encoding: string;
}

function StatusBar({
  line,
  column,
  charCount,
  wordCount,
  lineCount,
  fileName,
  isModified,
  encoding,
}: StatusBarProps) {
  return (
    <div className="status-bar">
      <div className="status-left">
        <span className="status-item" title="File path">
          {fileName}
          {isModified && " (modified)"}
        </span>
      </div>
      <div className="status-right">
        <span className="status-item">
          Ln {line}, Col {column}
        </span>
        <span className="status-item">{lineCount} lines</span>
        <span className="status-item">{wordCount} words</span>
        <span className="status-item">{charCount} chars</span>
        <span className="status-item">{encoding}</span>
      </div>
    </div>
  );
}

export default StatusBar;
