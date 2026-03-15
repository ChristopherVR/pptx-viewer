/**
 * sanitize — Security utilities for collaboration data.
 *
 * Validates and sanitises all incoming presence data to prevent XSS,
 * injection attacks, and out-of-bounds rendering.
 *
 * @module collaboration/sanitize
 */

// ---------------------------------------------------------------------------
// Room ID validation
// ---------------------------------------------------------------------------

/** Room IDs must be alphanumeric with hyphens/underscores, 1–128 chars. */
const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validate a room ID. Returns the room ID if valid, throws otherwise.
 */
export function validateRoomId(roomId: string): string {
  if (!ROOM_ID_REGEX.test(roomId)) {
    throw new Error(
      `Invalid collaboration room ID: "${roomId}". Must be 1-128 alphanumeric characters, hyphens, or underscores.`,
    );
  }
  return roomId;
}

// ---------------------------------------------------------------------------
// Username sanitisation
// ---------------------------------------------------------------------------

/** Strip HTML tags and limit length. */
export function sanitizeUserName(name: unknown): string {
  if (typeof name !== "string") return "Anonymous";
  // Strip HTML tags
  const stripped = name.replace(/<[^>]*>/g, "");
  // Trim whitespace and limit to 64 chars
  const trimmed = stripped.trim().slice(0, 64);
  return trimmed || "Anonymous";
}

// ---------------------------------------------------------------------------
// Cursor position clamping
// ---------------------------------------------------------------------------

/**
 * Clamp a cursor coordinate to slide bounds.
 * Allows a small margin outside the slide for edge cursors.
 */
export function clampCursorPosition(
  value: unknown,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const margin = 20; // px margin outside slide
  return Math.max(min - margin, Math.min(max + margin, value));
}

// ---------------------------------------------------------------------------
// Color validation
// ---------------------------------------------------------------------------

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

/** Validate a hex colour string. Returns a default if invalid. */
export function sanitizeColor(color: unknown, fallback = "#6366f1"): string {
  if (typeof color !== "string") return fallback;
  return HEX_COLOR_REGEX.test(color) ? color : fallback;
}

// ---------------------------------------------------------------------------
// Avatar URL validation
// ---------------------------------------------------------------------------

/** Validate an avatar URL — only allow http(s) and data: URIs. */
export function sanitizeAvatarUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:" || parsed.protocol === "data:") {
      return url;
    }
  } catch {
    // invalid URL
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Slide index validation
// ---------------------------------------------------------------------------

/** Ensure slide index is a non-negative integer. */
export function sanitizeSlideIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

// ---------------------------------------------------------------------------
// Full presence sanitisation
// ---------------------------------------------------------------------------

export interface RawPresenceData {
  clientId?: unknown;
  userName?: unknown;
  userAvatar?: unknown;
  userColor?: unknown;
  activeSlideIndex?: unknown;
  cursorX?: unknown;
  cursorY?: unknown;
  lastUpdated?: unknown;
  selectedElementId?: unknown;
}

export interface SanitizedPresence {
  clientId: number;
  userName: string;
  userAvatar?: string;
  userColor: string;
  activeSlideIndex: number;
  cursorX: number;
  cursorY: number;
  lastUpdated: string;
  selectedElementId?: string;
}

/**
 * Sanitise raw presence data from the awareness protocol.
 * Returns null if the data is fundamentally invalid (no clientId).
 */
export function sanitizePresence(
  raw: RawPresenceData,
  canvasWidth: number,
  canvasHeight: number,
): SanitizedPresence | null {
  if (typeof raw.clientId !== "number") return null;

  return {
    clientId: raw.clientId,
    userName: sanitizeUserName(raw.userName),
    userAvatar: sanitizeAvatarUrl(raw.userAvatar),
    userColor: sanitizeColor(raw.userColor),
    activeSlideIndex: sanitizeSlideIndex(raw.activeSlideIndex),
    cursorX: clampCursorPosition(raw.cursorX, 0, canvasWidth),
    cursorY: clampCursorPosition(raw.cursorY, 0, canvasHeight),
    lastUpdated:
      typeof raw.lastUpdated === "string"
        ? raw.lastUpdated
        : new Date().toISOString(),
    selectedElementId:
      typeof raw.selectedElementId === "string"
        ? raw.selectedElementId.slice(0, 128)
        : undefined,
  };
}
