export type Platform = "windows" | "macos" | "linux";

export function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "windows";
}

export const platform: Platform = detectPlatform();
