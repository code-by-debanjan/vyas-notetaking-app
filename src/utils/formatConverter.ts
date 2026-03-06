// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyas-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

import { jsPDF } from "jspdf";
import { invoke } from "@tauri-apps/api/core";

/**
 * Supported export formats for Save / Save As.
 */
export type ExportFormat = "txt" | "csv" | "json" | "xml" | "pdf" | "other";

/**
 * Detect the export format from a file path based on its extension.
 */
export function detectFormat(filePath: string): ExportFormat {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "csv":
      return "csv";
    case "json":
      return "json";
    case "xml":
      return "xml";
    case "pdf":
      return "pdf";
    case "txt":
    case "md":
    case "log":
      return "txt";
    default:
      return "other";
  }
}

/**
 * Convert plain text content to CSV format.
 * Each line of text becomes a row. Columns are detected by:
 *   1. Tab characters (highest priority — TSV-style input)
 *   2. Commas (if no tabs are present — user-typed CSV data)
 *   3. Entire line as a single column (fallback)
 * Fields are quoted only when they contain characters that would
 * be ambiguous in CSV (embedded quotes or newlines).
 */
export function convertToCSV(content: string): string {
  const lines = content.split("\n");
  return lines
    .map((line) => {
      let columns: string[];
      if (line.includes("\t")) {
        // Tab-separated → split on tabs, then quote fields that contain commas
        columns = line.split("\t");
      } else if (line.includes(",")) {
        // Already comma-separated → treat commas as delimiters directly.
        // The line is valid CSV as-is; return it unchanged so each value
        // lands in its own column when opened in Excel.
        return line;
      } else {
        columns = [line];
      }
      return columns
        .map((col) => {
          if (col.includes(",") || col.includes('"') || col.includes("\n")) {
            return `"${col.replace(/"/g, '""')}"`;
          }
          return col;
        })
        .join(",");
    })
    .join("\n");
}

/**
 * Convert plain text content to a structured JSON format.
 */
export function convertToJSON(content: string): string {
  const lines = content.split("\n");
  const data = {
    document: {
      totalLines: lines.length,
      totalCharacters: content.length,
      content: content,
      lines: lines.map((line, index) => ({
        lineNumber: index + 1,
        text: line,
      })),
    },
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Convert plain text content to an XML document.
 */
export function convertToXML(content: string): string {
  const lines = content.split("\n");
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<document>\n";
  xml += `  <metadata>\n`;
  xml += `    <totalLines>${lines.length}</totalLines>\n`;
  xml += `    <totalCharacters>${content.length}</totalCharacters>\n`;
  xml += `  </metadata>\n`;
  xml += "  <content>\n";
  lines.forEach((line, index) => {
    xml += `    <line number="${index + 1}">${escapeXml(line)}</line>\n`;
  });
  xml += "  </content>\n";
  xml += "</document>";
  return xml;
}

/**
 * Generate a PDF from plain text content and return as Uint8Array.
 * Uses the specified font size and embeds the actual editor font.
 */
export async function convertToPDF(
  content: string,
  options?: { fontSize?: number; fontFamily?: string; title?: string }
): Promise<Uint8Array> {
  const fontSizePx = options?.fontSize ?? 12;
  const fontFamily = options?.fontFamily ?? "";

  // Convert CSS pixels to PDF points (1pt = 1.333px, so 1px = 0.75pt)
  const fontSize = fontSizePx * 0.75;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = (fontSize * 0.3528) * 1.5;

  // Try to load and embed the actual system font
  let fontName = "helvetica";
  try {
    const fontData: number[] = await invoke("get_font_data", { family: fontFamily });
    const fontBytes = new Uint8Array(fontData);
    // Convert to base64 for jsPDF
    let binary = "";
    for (let i = 0; i < fontBytes.length; i++) {
      binary += String.fromCharCode(fontBytes[i]);
    }
    const base64 = btoa(binary);
    const safeName = fontFamily.replace(/[^a-zA-Z0-9]/g, "");
    doc.addFileToVFS(`${safeName}.ttf`, base64);
    doc.addFont(`${safeName}.ttf`, safeName, "normal");
    fontName = safeName;
  } catch {
    // Fallback: map to closest jsPDF built-in font
    const fl = fontFamily.toLowerCase();
    if (fl.includes("courier") || fl.includes("mono") || fl.includes("consolas") || fl.includes("cascadia")) {
      fontName = "courier";
    } else if (fl.includes("times") || fl.includes("serif") || fl.includes("georgia")) {
      fontName = "times";
    }
  }

  doc.setFont(fontName);
  doc.setFontSize(fontSize);

  let y = margin;

  const lines = content.split("\n");

  for (const line of lines) {
    const wrappedLines: string[] = line === ""
      ? [""]
      : doc.splitTextToSize(line, usableWidth);

    for (const wl of wrappedLines) {
      if (y + lineHeight > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(wl, margin, y);
      y += lineHeight;
    }
  }

  return doc.output("arraybuffer") as unknown as Uint8Array;
}

/**
 * Convert content to the target format. Returns the converted string
 * content for text-based formats, or a Uint8Array for binary formats (PDF).
 */
export async function convertContent(
  content: string,
  format: ExportFormat,
  options?: { fontSize?: number; fontFamily?: string; title?: string }
): Promise<{ type: "text"; data: string } | { type: "binary"; data: Uint8Array }> {
  switch (format) {
    case "csv":
      return { type: "text", data: convertToCSV(content) };
    case "json":
      return { type: "text", data: convertToJSON(content) };
    case "xml":
      return { type: "text", data: convertToXML(content) };
    case "pdf":
      return { type: "binary", data: await convertToPDF(content, options) };
    default:
      return { type: "text", data: content };
  }
}
