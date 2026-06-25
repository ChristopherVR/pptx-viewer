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
 *  - `mapAwarenessCursors` is the foundational bare-`{ cursor, user }` mapping
 *    that has no shared equivalent yet.
 */

import { sanitizeColor, MAX_LABEL_CHARS } from '../internal/shared';
import type { RemoteCursor } from '../internal/shared';

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
} from '../internal/shared';

/**
 * Clamp/format a cursor label so long names don't overflow the chip. Uses a
 * single-character ellipsis (`…`); the total length is exactly `maxChars`.
 */
export function formatCursorLabel(userName: string, maxChars: number = MAX_LABEL_CHARS): string {
	return userName.length > maxChars ? `${userName.slice(0, maxChars - 1)}…` : userName;
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
