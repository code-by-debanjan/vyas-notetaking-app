import { getCurrentWindow } from "@tauri-apps/api/window";
import type { Platform } from "../utils/platform";

interface TitleBarProps {
  platform: Platform;
  isMaximized: boolean;
}

function TitleBar({ platform, isMaximized }: TitleBarProps) {
  const appWindow = getCurrentWindow();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = async () => {
    await appWindow.toggleMaximize();
  };
  const handleClose = () => appWindow.close();

  const titleContent = (
    <div className="title-bar-text">
      <img src="/logo.png" alt="Vyas" className="title-bar-logo" />
      <span className="title-bar-name">VYAS</span>
      <span className="title-bar-separator"> : </span>
      <span className="title-bar-tagline">Compile Your Epic</span>
    </div>
  );

  if (platform === "macos") {
    return (
      <div className="title-bar title-bar-macos">
        <div className="title-bar-controls macos-controls">
          <button
            className="macos-btn macos-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="6" height="6" viewBox="0 0 6 6">
              <line x1="0.5" y1="0.5" x2="5.5" y2="5.5" stroke="currentColor" strokeWidth="1.5" />
              <line x1="5.5" y1="0.5" x2="0.5" y2="5.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            className="macos-btn macos-minimize"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg width="6" height="1" viewBox="0 0 6 1">
              <rect width="6" height="1.2" fill="currentColor" />
            </svg>
          </button>
          <button
            className="macos-btn macos-maximize"
            onClick={handleMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="6" height="6" viewBox="0 0 8 8">
                <path d="M1 4L4 1L7 4L4 7Z" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            ) : (
              <svg width="6" height="6" viewBox="0 0 8 8">
                <polygon points="1,7 4,1 7,7" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            )}
          </button>
        </div>
        {titleContent}
        <div className="macos-spacer" />
      </div>
    );
  }

  if (platform === "linux") {
    return (
      <div className="title-bar title-bar-linux">
        {titleContent}
        <div className="title-bar-controls linux-controls">
          <button
            className="linux-btn linux-minimize"
            onClick={handleMinimize}
            aria-label="Minimize"
          >
            <svg width="10" height="1" viewBox="0 0 10 1">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            className="linux-btn linux-maximize"
            onClick={handleMaximize}
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="2" y="0" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
                <rect x="0" y="2" width="8" height="8" rx="1.5" fill="var(--bg-primary)" stroke="currentColor" strokeWidth="1" />
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10">
                <rect x="1" y="1" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
            )}
          </button>
          <button
            className="linux-btn linux-close"
            onClick={handleClose}
            aria-label="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Windows (default)
  return (
    <div className="title-bar">
      {titleContent}
      <div className="title-bar-controls">
        <button
          className="title-bar-btn minimize"
          onClick={handleMinimize}
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="title-bar-btn maximize"
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="2" y="0" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
              <rect x="0" y="2" width="8" height="8" rx="1" fill="var(--bg-primary)" stroke="currentColor" strokeWidth="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          )}
        </button>
        <button
          className="title-bar-btn close"
          onClick={handleClose}
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
