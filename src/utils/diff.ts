// Copyright (c) 2026 Debanjan Bhattacharya
// Project: vyas-notetaking-app
// Licensed under the MIT License
// See LICENSE.txt for details

/**
 * Simple line-based diff using the Longest Common Subsequence (LCS) algorithm.
 * Produces a list of diff lines tagged as "equal", "added", or "removed".
 */

export type DiffLineType = "equal" | "added" | "removed";

export interface DiffLine {
  type: DiffLineType;
  leftLineNo?: number;
  rightLineNo?: number;
  text: string;
}

/**
 * Compute the LCS table for two arrays of strings.
 */
function lcsTable(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Compute a line-based diff between two strings.
 */
export function computeDiff(leftText: string, rightText: string): DiffLine[] {
  const leftLines = leftText.split("\n");
  const rightLines = rightText.split("\n");
  const dp = lcsTable(leftLines, rightLines);

  const result: DiffLine[] = [];
  let i = leftLines.length;
  let j = rightLines.length;

  // Trace back through the LCS table
  const stack: DiffLine[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && leftLines[i - 1] === rightLines[j - 1]) {
      stack.push({
        type: "equal",
        leftLineNo: i,
        rightLineNo: j,
        text: leftLines[i - 1],
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({
        type: "added",
        rightLineNo: j,
        text: rightLines[j - 1],
      });
      j--;
    } else {
      stack.push({
        type: "removed",
        leftLineNo: i,
        text: leftLines[i - 1],
      });
      i--;
    }
  }

  // Reverse since we built from bottom-up
  while (stack.length > 0) {
    result.push(stack.pop()!);
  }

  return result;
}

/**
 * Summary statistics for a diff.
 */
export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

export function getDiffStats(diff: DiffLine[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;
  for (const line of diff) {
    if (line.type === "added") additions++;
    else if (line.type === "removed") deletions++;
    else unchanged++;
  }
  return { additions, deletions, unchanged };
}
