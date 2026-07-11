/**
 * Thin re-export shim → vendored `pptx-viewer-shared`
 * (`render/collaboration-presence`).
 *
 * The pure presence/cursor sanitisation logic now lives in shared and is
 * consumed by every binding. This shim preserves the historical Angular import
 * surface so `collaboration.service.ts`, `collaboration-cursors.component.ts`,
 * the viewer barrel, and the colocated tests are unchanged.
 *
 * `RemotePresence` is the Angular name for shared's `SanitizedPresence`
 * (re-aliased here). `formatCursorLabel` and `mapAwarenessCursors` are now
 * re-exported as-is from shared: Angular's `formatCursorLabel` used to keep
 * its own single-character ellipsis (`…`) truncation that differed from
 * shared's three-dot (`...`) variant, so two peers viewing the same presence
 * record saw differently-truncated names depending on which binding hosted
 * the session - a real cross-binding consistency bug, not a style choice.
 */

export type {
	RemoteCursor,
	RawPresenceData,
	SanitizedPresence as RemotePresence,
} from '../internal/shared';

export {
	DEFAULT_CURSOR_COLOR,
	STALE_PRESENCE_MS,
	MAX_LABEL_CHARS,
	CURSOR_PALETTE,
	isValidRoomId,
	validateRoomId,
	sanitizeUserName,
	sanitizeColor,
	sanitizeAvatarUrl,
	sanitizeSlideIndex,
	clampCursorPosition,
	assignUserColor,
	sanitizePresence,
	derivePresenceList,
	presenceToCursors,
	mapAwarenessCursors,
	formatCursorLabel,
} from '../internal/shared';
