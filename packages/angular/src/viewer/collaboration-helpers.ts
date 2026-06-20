/**
 * collaboration-helpers.ts: Pure, framework-agnostic logic for the real-time
 * collaboration subsystem (Yjs-backed presence + remote cursors).
 *
 * Everything here is a plain function with no Angular / Yjs dependency so it can
 * be unit-tested in isolation (vitest + happy-dom, no TestBed, no live provider).
 * The Angular service (`collaboration.service.ts`) and the cursors component
 * (`collaboration-cursors.component.ts`) consume these helpers.
 *
 * Responsibilities:
 *  - Validate/sanitise inbound awareness data (XSS, bounds, colour, room id).
 *  - Map awareness state → a `RemoteCursor` view-model for rendering.
 *  - Derive the presence list (remote users only, stale entries dropped).
 *  - Deterministic per-user colour assignment + cursor label formatting.
 *
 * Mirrors the Vue composable (`useCollaboration.ts`) and the React
 * `sanitize.ts` / `usePresenceTracking.ts` helpers.
 */

import type { CollaborationRole } from '../internal/shared';

// ---------------------------------------------------------------------------
// View-model types
// ---------------------------------------------------------------------------

/** A single remote collaborator's cursor, in unscaled slide coordinates. */
export interface RemoteCursor {
	/** Stable id for the remote client (awareness clientId or peer id). */
	clientId: number | string;
	/** Display name shown in the label chip. */
	userName: string;
	/** Cursor + chip colour (any CSS colour string). */
	color: string;
	/** Unscaled slide-space X coordinate (px). */
	x: number;
	/** Unscaled slide-space Y coordinate (px). */
	y: number;
	/** Optional ids of elements this user has selected. */
	selectionIds?: string[];
}

/**
 * Presence data for a remote (or local) collaborator, sanitised from the
 * awareness protocol. Cursor position is in unscaled slide coordinates.
 */
export interface RemotePresence {
	/** Awareness client id. */
	clientId: number;
	/** Sanitised display name. */
	userName: string;
	/** Hex colour for the user's cursor/avatar. */
	userColor: string;
	/** Validated avatar URL, when present. */
	userAvatar?: string;
	/** Zero-based slide index the user is viewing. */
	activeSlideIndex: number;
	/** Cursor X (unscaled slide px, clamped to bounds). */
	cursorX: number;
	/** Cursor Y (unscaled slide px, clamped to bounds). */
	cursorY: number;
	/** ISO timestamp of the last update (for stale-presence cleanup). */
	lastUpdated: string;
	/** Currently selected element id, when present. */
	selectedElementId?: string;
	/** Session role. */
	role?: CollaborationRole;
}

/** The shape stored under the awareness `presence` field. */
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
	role?: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Fallback cursor/label colour when none is supplied or it fails validation. */
export const DEFAULT_CURSOR_COLOR = '#4c8bf5';

/** Presence entries older than this (ms) are considered stale and dropped. */
export const STALE_PRESENCE_MS = 30_000;

/** Maximum characters shown in a cursor label before truncation. */
export const MAX_LABEL_CHARS = 20;

/** px margin allowed outside the slide bounds for edge cursors. */
const CURSOR_BOUNDS_MARGIN = 20;

/**
 * Palette used for deterministic per-user colour assignment. Distinct, legible
 * hues with white text contrast. Mirrors the React default-colour set.
 */
export const CURSOR_PALETTE: readonly string[] = [
	'#ef4444',
	'#f97316',
	'#eab308',
	'#22c55e',
	'#06b6d4',
	'#3b82f6',
	'#8b5cf6',
	'#ec4899',
];

// ---------------------------------------------------------------------------
// Room id / username / colour / url validation
// ---------------------------------------------------------------------------

// NOTE: ng-packagr lib target forbids regex named-capture-groups; these use none.
const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/u;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/u;
const HTML_TAG_REGEX = /<[^>]*>/gu;

/** True when `roomId` is a safe 1–128 char alphanumeric/`-`/`_` token. */
export function isValidRoomId(roomId: string): boolean {
	return ROOM_ID_REGEX.test(roomId);
}

/**
 * Validate a room id, returning it when valid and throwing otherwise. Mirrors
 * the React `validateRoomId`.
 */
export function validateRoomId(roomId: string): string {
	if (!isValidRoomId(roomId)) {
		throw new Error(
			`Invalid collaboration room ID: "${roomId}". Must be 1-128 alphanumeric characters, hyphens, or underscores.`,
		);
	}
	return roomId;
}

/** Strip HTML tags, trim, and clamp to 64 chars; falls back to `'Anonymous'`. */
export function sanitizeUserName(name: unknown): string {
	if (typeof name !== 'string') {
		return 'Anonymous';
	}
	const stripped = name.replace(HTML_TAG_REGEX, '');
	const trimmed = stripped.trim().slice(0, 64);
	return trimmed || 'Anonymous';
}

/** Validate a 6-digit hex colour; returns `fallback` when invalid. */
export function sanitizeColor(color: unknown, fallback: string = DEFAULT_CURSOR_COLOR): string {
	if (typeof color !== 'string') {
		return fallback;
	}
	return HEX_COLOR_REGEX.test(color) ? color : fallback;
}

/** Allow only http(s)/data: avatar URLs; otherwise `undefined`. */
export function sanitizeAvatarUrl(url: unknown): string | undefined {
	if (typeof url !== 'string') {
		return undefined;
	}
	try {
		const parsed = new URL(url);
		if (
			parsed.protocol === 'https:' ||
			parsed.protocol === 'http:' ||
			parsed.protocol === 'data:'
		) {
			return url;
		}
	} catch {
		// invalid URL, fall through
	}
	return undefined;
}

/** Coerce a value to a non-negative integer slide index. */
export function sanitizeSlideIndex(value: unknown): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}
	return Math.max(0, Math.floor(value));
}

/** Clamp a cursor coordinate to `[min - margin, max + margin]`. */
export function clampCursorPosition(value: unknown, min: number, max: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return 0;
	}
	return Math.max(min - CURSOR_BOUNDS_MARGIN, Math.min(max + CURSOR_BOUNDS_MARGIN, value));
}

// ---------------------------------------------------------------------------
// Colour assignment + label formatting
// ---------------------------------------------------------------------------

/**
 * Deterministically pick a palette colour for a user. The same `seed` (client
 * id or user name) always maps to the same colour so a peer keeps a stable hue.
 */
export function assignUserColor(
	seed: number | string,
	palette: readonly string[] = CURSOR_PALETTE,
): string {
	if (palette.length === 0) {
		return DEFAULT_CURSOR_COLOR;
	}
	let hash = 0;
	const text = String(seed);
	for (let i = 0; i < text.length; i++) {
		hash = (hash * 31 + text.charCodeAt(i)) | 0;
	}
	const index = Math.abs(hash) % palette.length;
	return palette[index] ?? DEFAULT_CURSOR_COLOR;
}

/** Clamp/format a cursor label so long names don't overflow the chip. */
export function formatCursorLabel(userName: string, maxChars: number = MAX_LABEL_CHARS): string {
	return userName.length > maxChars ? `${userName.slice(0, maxChars - 1)}…` : userName;
}

// ---------------------------------------------------------------------------
// Presence sanitisation + derivation
// ---------------------------------------------------------------------------

const VALID_ROLES: readonly CollaborationRole[] = ['owner', 'collaborator', 'viewer'];

function sanitizeRole(value: unknown): CollaborationRole | undefined {
	return VALID_ROLES.includes(value as CollaborationRole)
		? (value as CollaborationRole)
		: undefined;
}

/**
 * Sanitise raw awareness presence data into a `RemotePresence`. Returns `null`
 * when the entry is fundamentally invalid (missing numeric client id).
 */
export function sanitizePresence(
	raw: RawPresenceData,
	canvasWidth: number,
	canvasHeight: number,
): RemotePresence | null {
	if (typeof raw.clientId !== 'number') {
		return null;
	}

	return {
		clientId: raw.clientId,
		userName: sanitizeUserName(raw.userName),
		userColor: sanitizeColor(raw.userColor),
		userAvatar: sanitizeAvatarUrl(raw.userAvatar),
		activeSlideIndex: sanitizeSlideIndex(raw.activeSlideIndex),
		cursorX: clampCursorPosition(raw.cursorX, 0, canvasWidth),
		cursorY: clampCursorPosition(raw.cursorY, 0, canvasHeight),
		lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : new Date().toISOString(),
		selectedElementId:
			typeof raw.selectedElementId === 'string' ? raw.selectedElementId.slice(0, 128) : undefined,
		role: sanitizeRole(raw.role),
	};
}

/**
 * Derive the remote-presence list from a raw awareness state map. Skips the
 * local client, sanitises each entry, and drops stale entries (older than
 * `staleMs`, evaluated against `now`).
 */
export function derivePresenceList(
	states: Map<number, Record<string, unknown>>,
	localClientId: number,
	canvasWidth: number,
	canvasHeight: number,
	now: number = Date.now(),
	staleMs: number = STALE_PRESENCE_MS,
): RemotePresence[] {
	const users: RemotePresence[] = [];
	for (const [clientId, state] of states) {
		if (clientId === localClientId) {
			continue;
		}
		const raw = state?.presence;
		if (!raw || typeof raw !== 'object') {
			continue;
		}
		const sanitized = sanitizePresence(
			{ ...(raw as Record<string, unknown>), clientId },
			canvasWidth,
			canvasHeight,
		);
		if (!sanitized) {
			continue;
		}
		const updatedAt = new Date(sanitized.lastUpdated).getTime();
		if (Number.isNaN(updatedAt) || now - updatedAt > staleMs) {
			continue;
		}
		users.push(sanitized);
	}
	return users;
}

/**
 * Map a sanitised presence list into the cursor view-model for the overlay,
 * optionally filtering to a single slide (so cursors only show on the slide the
 * local user is viewing). Pass `activeSlideIndex` undefined to show all.
 */
export function presenceToCursors(
	presence: readonly RemotePresence[],
	activeSlideIndex?: number,
): RemoteCursor[] {
	const cursors: RemoteCursor[] = [];
	for (const user of presence) {
		if (activeSlideIndex !== undefined && user.activeSlideIndex !== activeSlideIndex) {
			continue;
		}
		cursors.push({
			clientId: user.clientId,
			userName: user.userName,
			color: user.userColor,
			x: user.cursorX,
			y: user.cursorY,
			selectionIds: user.selectedElementId ? [user.selectedElementId] : undefined,
		});
	}
	return cursors;
}

/**
 * Lightweight awareness-state → `RemoteCursor` mapping used by the foundational
 * sync path that stores a bare `{ cursor, user }` (no full presence record),
 * mirroring the Vue composable's `refreshCursors`.
 */
export function mapAwarenessCursors(
	states: Map<number, Record<string, unknown>>,
	localClientId: number,
): RemoteCursor[] {
	const cursors: RemoteCursor[] = [];
	for (const [clientId, state] of states) {
		if (clientId === localClientId) {
			continue;
		}
		const cursor = state?.cursor as { x?: unknown; y?: unknown } | undefined;
		const user = state?.user as { name?: unknown; color?: unknown } | undefined;
		if (!cursor || typeof cursor.x !== 'number' || typeof cursor.y !== 'number') {
			continue;
		}
		cursors.push({
			clientId,
			userName: typeof user?.name === 'string' ? user.name : 'Guest',
			color: sanitizeColor(user?.color),
			x: cursor.x,
			y: cursor.y,
		});
	}
	return cursors;
}
