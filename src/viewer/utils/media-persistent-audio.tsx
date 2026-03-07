import type { MediaPptxElement } from "../../core";

// ---------------------------------------------------------------------------
// Persistent Audio Manager — keeps audio playing across slide transitions
// ---------------------------------------------------------------------------

/** Tracks a persistent audio element that spans multiple slides. */
interface PersistentAudioEntry {
  elementId: string;
  audio: HTMLAudioElement;
  loop: boolean;
}

/**
 * Module-level manager for audio that uses "play across slides".
 * Audio elements registered here are NOT destroyed when a slide unmounts.
 */
const persistentAudioMap = new Map<string, PersistentAudioEntry>();

export function registerPersistentAudio(
  elementId: string,
  dataUrl: string,
  mimetype: string | undefined,
  loop: boolean,
  volume: number,
  trimStartSec: number,
): void {
  if (persistentAudioMap.has(elementId)) return;

  const audio = document.createElement("audio");
  audio.src = dataUrl;
  if (mimetype) {
    const source = document.createElement("source");
    source.src = dataUrl;
    source.type = mimetype;
    audio.appendChild(source);
  }
  audio.loop = loop;
  audio.volume = Math.max(0, Math.min(1, volume));
  if (trimStartSec > 0) audio.currentTime = trimStartSec;

  // Keep element in the DOM but hidden
  audio.style.display = "none";
  document.body.appendChild(audio);

  persistentAudioMap.set(elementId, { elementId, audio, loop });

  void audio.play().catch(() => {
    /* autoplay may be blocked */
  });
}

/** Stop all persistent audio — call when leaving presentation mode. */
export function stopAllPersistentAudio(): void {
  for (const entry of persistentAudioMap.values()) {
    entry.audio.pause();
    entry.audio.remove();
  }
  persistentAudioMap.clear();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a media fragment URI component (`#t=start,end`) for trimmed media.
 * Times are in milliseconds; the fragment uses seconds.
 */
export function buildTrimFragment(element: MediaPptxElement): string {
  const start = element.trimStartMs;
  const end = element.trimEndMs;
  if (start === undefined && end === undefined) return "";
  const parts: string[] = [];
  if (start !== undefined && start > 0) {
    parts.push((start / 1000).toFixed(3));
  } else {
    parts.push("");
  }
  if (end !== undefined && end > 0) {
    parts.push((end / 1000).toFixed(3));
  }
  return parts.length > 0 ? `#t=${parts.join(",")}` : "";
}
