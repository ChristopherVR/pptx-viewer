/**
 * usePresenterWindow — Manages a secondary browser window for audience display.
 *
 * Opens a popup window that mirrors the current slide in fullscreen-like view.
 * The presenter console (main window) shows speaker notes, next slide preview,
 * and elapsed timer. Cross-window synchronisation uses `postMessage()`.
 *
 * Message protocol:
 * - Main → Audience: `{ type: "presenter-slide-change", slideIndex: number }`
 * - Main → Audience: `{ type: "presenter-exit" }`
 */
import { useRef, useCallback, useEffect } from "react";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Unique origin identifier so we only react to our own messages. */
export const PRESENTER_MSG_ORIGIN = "pptx-viewer-presenter";

/** Message sent from presenter to audience window on slide change. */
export interface PresenterSlideChangeMessage {
  origin: typeof PRESENTER_MSG_ORIGIN;
  type: "presenter-slide-change";
  slideIndex: number;
}

/** Message sent from presenter to audience window to signal exit. */
export interface PresenterExitMessage {
  origin: typeof PRESENTER_MSG_ORIGIN;
  type: "presenter-exit";
}

export type PresenterMessage =
  | PresenterSlideChangeMessage
  | PresenterExitMessage;

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

export interface UsePresenterWindowInput {
  /** Current slide index shown in presenter view. */
  currentSlideIndex: number;
  /** Whether presenter mode is currently active. */
  isPresenterMode: boolean;
}

export interface UsePresenterWindowResult {
  /** Open the audience window. Returns `true` if successful. */
  openAudienceWindow: () => boolean;
  /** Close the audience window if open. */
  closeAudienceWindow: () => void;
  /** Whether the audience window is currently open. */
  isAudienceWindowOpen: () => boolean;
  /** Send the current slide index to the audience window. */
  syncSlideToAudience: (slideIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Type guard to check if a MessageEvent contains a valid PresenterMessage.
 */
export function isPresenterMessage(
  data: unknown,
): data is PresenterMessage {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Record<string, unknown>;
  return (
    msg.origin === PRESENTER_MSG_ORIGIN &&
    (msg.type === "presenter-slide-change" || msg.type === "presenter-exit")
  );
}

/**
 * Build the HTML content for the audience window.
 * Renders a minimal page that listens for postMessage events and displays
 * the current slide index (the actual slide rendering will be injected
 * via DOM manipulation or the audience window can host a stripped-down viewer).
 */
export function buildAudienceWindowHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Presentation — Audience View</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; color: #fff; font-family: system-ui, sans-serif; }
    #audience-root { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    #slide-container { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    #slide-label { position: absolute; bottom: 16px; right: 16px; font-size: 14px; opacity: 0.4; pointer-events: none; }
    #waiting { font-size: 24px; color: #888; }
  </style>
</head>
<body>
  <div id="audience-root">
    <div id="slide-container">
      <div id="waiting">Waiting for presenter...</div>
      <div id="slide-label"></div>
    </div>
  </div>
  <script>
    const ORIGIN_TAG = "${PRESENTER_MSG_ORIGIN}";
    const container = document.getElementById("slide-container");
    const waiting = document.getElementById("waiting");
    const label = document.getElementById("slide-label");

    let currentIndex = -1;

    window.addEventListener("message", function(event) {
      const data = event.data;
      if (!data || data.origin !== ORIGIN_TAG) return;

      if (data.type === "presenter-slide-change") {
        currentIndex = data.slideIndex;
        if (waiting) waiting.style.display = "none";
        if (label) label.textContent = "Slide " + (currentIndex + 1);
        // Dispatch a custom event that the embedded viewer can listen for
        window.dispatchEvent(new CustomEvent("presenter-slide-change", { detail: { slideIndex: currentIndex } }));
      }

      if (data.type === "presenter-exit") {
        window.close();
      }
    });

    // Notify opener that we are ready
    if (window.opener) {
      window.opener.postMessage({ origin: ORIGIN_TAG, type: "audience-ready" }, "*");
    }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresenterWindow(
  input: UsePresenterWindowInput,
): UsePresenterWindowResult {
  const { currentSlideIndex, isPresenterMode } = input;
  const audienceWindowRef = useRef<Window | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -- Helpers ---------------------------------------------------------------

  const isAudienceWindowOpen = useCallback((): boolean => {
    return (
      audienceWindowRef.current !== null &&
      !audienceWindowRef.current.closed
    );
  }, []);

  const syncSlideToAudience = useCallback((slideIndex: number) => {
    const win = audienceWindowRef.current;
    if (!win || win.closed) return;
    const message: PresenterSlideChangeMessage = {
      origin: PRESENTER_MSG_ORIGIN,
      type: "presenter-slide-change",
      slideIndex,
    };
    win.postMessage(message, "*");
  }, []);

  const closeAudienceWindow = useCallback(() => {
    const win = audienceWindowRef.current;
    if (win && !win.closed) {
      const exitMsg: PresenterExitMessage = {
        origin: PRESENTER_MSG_ORIGIN,
        type: "presenter-exit",
      };
      try {
        win.postMessage(exitMsg, "*");
      } catch {
        // Window may already be closed
      }
      try {
        win.close();
      } catch {
        // Ignore
      }
    }
    audienceWindowRef.current = null;
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const openAudienceWindow = useCallback((): boolean => {
    // Close any existing window first
    if (isAudienceWindowOpen()) {
      closeAudienceWindow();
    }

    const width = Math.round(screen.availWidth * 0.8);
    const height = Math.round(screen.availHeight * 0.8);
    const left = Math.round((screen.availWidth - width) / 2);
    const top = Math.round((screen.availHeight - height) / 2);

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "menubar=no",
      "toolbar=no",
      "location=no",
      "status=no",
      "scrollbars=no",
      "resizable=yes",
    ].join(",");

    const win = window.open("about:blank", "pptx-audience-view", features);
    if (!win) return false;

    // Write the audience page HTML
    const html = buildAudienceWindowHtml();
    win.document.open();
    win.document.write(html);
    win.document.close();

    audienceWindowRef.current = win;

    // Send the current slide index immediately once loaded
    syncSlideToAudience(currentSlideIndex);

    // Poll for window close to clean up refs
    pollTimerRef.current = setInterval(() => {
      if (win.closed) {
        audienceWindowRef.current = null;
        if (pollTimerRef.current !== null) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      }
    }, 1000);

    return true;
  }, [
    isAudienceWindowOpen,
    closeAudienceWindow,
    syncSlideToAudience,
    currentSlideIndex,
  ]);

  // -- Sync slide changes to audience window ---------------------------------

  useEffect(() => {
    if (isPresenterMode && isAudienceWindowOpen()) {
      syncSlideToAudience(currentSlideIndex);
    }
  }, [currentSlideIndex, isPresenterMode, isAudienceWindowOpen, syncSlideToAudience]);

  // -- Cleanup on unmount or when leaving presenter mode ----------------------

  useEffect(() => {
    return () => {
      closeAudienceWindow();
    };
  }, [closeAudienceWindow]);

  useEffect(() => {
    if (!isPresenterMode) {
      closeAudienceWindow();
    }
  }, [isPresenterMode, closeAudienceWindow]);

  return {
    openAudienceWindow,
    closeAudienceWindow,
    isAudienceWindowOpen,
    syncSlideToAudience,
  };
}
