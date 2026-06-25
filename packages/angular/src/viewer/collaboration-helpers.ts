/**
 * Thin re-export shim → vendored `pptx-viewer-shared`
 * (`render/collaboration-presence`).
 *
 * The pure presence/cursor sanitisation logic now lives in shared and is
 * consumed by every binding. This shim preserves the historical Angular import
 * surface so `collaboration.service.ts`, `collaboration-cursors.component.ts`,
 * the viewer barrel, and the colocated tests are unchanged.
 *
 * Two pieces stay Angular-local because they diverge from the shared copy:
 *  - `RemotePresence` is the Angular name for shared's `SanitizedPresence`
 *    (re-aliased here).
 *  - `formatCursorLabel` keeps the historical single-character ellipsis (`…`)
 *    truncation, which differs from shared's three-dot (`...`) variant that the
 *    React binding expects. Kept local so the rendered label and the colocated
 *    test are unchanged.
 *
 * `mapAwarenessCursors` (the foundational bare-`{ cursor, user }` mapping) now
 * lives in shared and is re-exported here so existing Angular imports are
 * unchanged.
 */

import { MAX_LABEL_CHARS } from '../internal/shared';

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
} from '../internal/shared';

/**
 * Clamp/format a cursor label so long names don't overflow the chip. Uses a
 * single-character ellipsis (`…`); the total length is exactly `maxChars`.
 */
export function formatCursorLabel(userName: string, maxChars: number = MAX_LABEL_CHARS): string {
	return userName.length > maxChars ? `${userName.slice(0, maxChars - 1)}…` : userName;
}
