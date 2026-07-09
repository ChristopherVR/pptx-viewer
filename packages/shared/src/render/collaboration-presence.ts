/**
 * collaboration-presence.ts: Pure, framework-agnostic logic for the real-time
 * collaboration subsystem (Yjs-backed presence + remote cursors).
 *
 * Everything here is a plain function with no framework / Yjs dependency, so it
 * can be unit-tested in isolation and shared across the React, Vue, and Angular
 * bindings. The bindings own the stateful provider lifecycle (creating the
 * Y.Doc / WebsocketProvider, wiring awareness listeners) and call into these
 * helpers to validate config, sanitise inbound awareness data, and project it
 * into render-ready view-models.
 *
 * Responsibilities:
 *  - Validate the room id and detect mixed-content (ws:// from https) up front.
 *  - Sanitise inbound awareness data (XSS, bounds, colour, avatar, room id).
 *  - Map awareness state into a `RemoteCursor` view-model for rendering.
 *  - Derive the presence list (remote users only, stale entries dropped).
 *  - Deterministic per-user colour assignment + cursor label formatting.
 *
 * This mirrors the React `sanitize.ts` / `usePresenceTracking.ts` helpers and
 * the Angular `collaboration-helpers.ts` (which predates this shared copy).
 */

import type { CollaborationRole } from '../types';

// ---------------------------------------------------------------------------
// Connection lifecycle
// ---------------------------------------------------------------------------

/** Connection lifecycle states for the Yjs WebSocket provider. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/** Maximum time (ms) to wait for an initial WebSocket connection before giving up. */
export const CONNECTION_TIMEOUT_MS = 30_000;

/**
 * Grace period (ms) before the first local doc write when the provider has not
 * signalled initial sync. Websocket providers emit 'synced' reliably; webrtc
 * only syncs once a peer is present, so a lone (fresh-room) peer seeds the doc
 * after this delay instead. Gating the first write prevents a late joiner's
 * bootstrap deck from merging into a room whose real content has not arrived.
 */
export const INITIAL_SYNC_GRACE_MS = 3_000;

/** Heartbeat interval (ms): re-publish presence so peers don't time us out. */
export const PRESENCE_HEARTBEAT_MS = 10_000;

/** Minimum interval (ms) between outgoing presence broadcasts (rate limiting). */
export const BROADCAST_THROTTLE_MS = 50;

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

/** The shape stored under an awareness `presence` field, before sanitisation. */
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

/**
 * Presence data for a remote collaborator, sanitised from the awareness
 * protocol. Returned by {@link sanitizePresence}; coordinates are in unscaled
 * slide pixels, clamped to the supplied canvas bounds.
 */
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
	role?: CollaborationRole;
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
 * hues with white-text contrast. Mirrors the React default-colour set.
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

const ROOM_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/u;
const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/u;

/** True when `roomId` is a safe 1-128 char alphanumeric/`-`/`_` token. */
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

/**
 * Remove HTML tags from `text`, keeping only the text outside them, in a
 * single linear pass with no regex backtracking.
 *
 * This deliberately avoids a regex like `/<[^>]*>/g`: the negated character
 * class re-scans from every failed start position, which is a polynomial
 * (O(n^2)) ReDoS on strings with many unmatched `<` characters. Worse, a
 * "match one `<...>` pair and remove it" regex is an *incomplete* sanitizer:
 * a crafted `<scr<script>ipt>` still contains a live `<script>` after the
 * outer match is stripped, because the removal only ever considers one
 * paired match at a time.
 *
 * Tracking open/closed tag state while walking the string once closes both
 * holes. It is O(n) with no backtracking, and every character is classified
 * exactly once as "inside a tag" or "text", so there is nothing left to
 * reconstruct: overlapping or nested `<`/`>` sequences can never leave a
 * live tag behind, however they are arranged.
 */
function stripHtmlTags(text: string): string {
	let result = '';
	let insideTag = false;
	for (const char of text) {
		if (char === '<') {
			insideTag = true;
		} else if (char === '>') {
			insideTag = false;
		} else if (!insideTag) {
			result += char;
		}
	}
	return result;
}

/** Strip HTML tags, trim, and clamp to 64 chars; falls back to `'Anonymous'`. */
export function sanitizeUserName(name: unknown): string {
	if (typeof name !== 'string') {
		return 'Anonymous';
	}
	const stripped = stripHtmlTags(name);
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
// Mixed-content detection
// ---------------------------------------------------------------------------

/**
 * Returns true if connecting to `serverUrl` would be blocked as mixed content:
 * an insecure `ws://` socket opened from a secure `https://` page. Browsers
 * exempt loopback hosts (localhost / 127.0.0.1 / [::1]) as potentially
 * trustworthy, so those are allowed.
 *
 * Detecting this up front lets a binding fail fast with a clear `'error'`
 * status instead of waiting out the full connection timeout on a socket the
 * browser will never open. `pageProtocol` defaults to the current page
 * protocol when a DOM is available.
 */
export function isMixedContentBlocked(
	serverUrl: string,
	pageProtocol: string | undefined = typeof window !== 'undefined'
		? window.location.protocol
		: undefined,
): boolean {
	if (pageProtocol !== 'https:') {
		return false;
	}
	let parsed: URL;
	try {
		parsed = new URL(serverUrl);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'ws:') {
		return false;
	}
	const loopbackHosts = ['localhost', '127.0.0.1', '[::1]'];
	return !loopbackHosts.includes(parsed.hostname);
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

/**
 * Clamp/format a cursor label so long names don't overflow the chip. When
 * truncating, the result is exactly `maxChars` characters including a trailing
 * `...` ellipsis.
 */
export function formatCursorLabel(userName: string, maxChars: number = MAX_LABEL_CHARS): string {
	if (userName.length <= maxChars) {
		return userName;
	}
	const keep = Math.max(0, maxChars - 3);
	return `${userName.slice(0, keep)}...`;
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
 * Sanitise raw awareness presence data into a {@link SanitizedPresence}.
 * Returns `null` when the entry is fundamentally invalid (missing numeric
 * client id).
 */
export function sanitizePresence(
	raw: RawPresenceData,
	canvasWidth: number,
	canvasHeight: number,
): SanitizedPresence | null {
	if (typeof raw.clientId !== 'number') {
		return null;
	}

	return {
		clientId: raw.clientId,
		userName: sanitizeUserName(raw.userName),
		userAvatar: sanitizeAvatarUrl(raw.userAvatar),
		userColor: sanitizeColor(raw.userColor),
		activeSlideIndex: sanitizeSlideIndex(raw.activeSlideIndex),
		cursorX: clampCursorPosition(raw.cursorX, 0, canvasWidth),
		cursorY: clampCursorPosition(raw.cursorY, 0, canvasHeight),
		lastUpdated: typeof raw.lastUpdated === 'string' ? raw.lastUpdated : new Date().toISOString(),
		selectedElementId:
			typeof raw.selectedElementId === 'string' ? raw.selectedElementId.slice(0, 128) : undefined,
		role: sanitizeRole(raw.role),
	};
}

/** True when `lastUpdated` is parseable and within `staleMs` of `now`. */
export function isPresenceFresh(
	lastUpdated: string,
	now: number = Date.now(),
	staleMs: number = STALE_PRESENCE_MS,
): boolean {
	const updatedAt = new Date(lastUpdated).getTime();
	return !Number.isNaN(updatedAt) && now - updatedAt <= staleMs;
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
): SanitizedPresence[] {
	const users: SanitizedPresence[] = [];
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
		if (!sanitized || !isPresenceFresh(sanitized.lastUpdated, now, staleMs)) {
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
	presence: readonly SanitizedPresence[],
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
 * Map a raw awareness-state map into a `RemoteCursor[]` for the foundational
 * sync path that stores a bare `{ cursor: { x, y }, user: { name, color } }`
 * per client (no full {@link SanitizedPresence} record). Skips the local client
 * and any entry without numeric cursor coordinates. Colours are passed through
 * {@link sanitizeColor}; a missing name falls back to `'Guest'`.
 *
 * Used by the Angular collaboration service and the Vue collaboration
 * composable's cursor projection, which share this flat awareness shape.
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

/**
 * Coerce an unknown awareness value into a string-id array, dropping any
 * non-string entries. Used to validate the `selection` field broadcast by a
 * collaborator before it is rendered as a remote selection.
 */
export function asSelectionIds(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((entry): entry is string => typeof entry === 'string');
}
