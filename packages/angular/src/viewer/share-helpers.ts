/**
 * share-helpers.ts: Share dialog helpers for the Angular viewer.
 *
 * The shared subset (ShareFormFields / ShareDefaults / seedShareFields /
 * canStartShare) is re-exported from `pptx-viewer-shared` (`render/share-form`).
 * Two helpers stay local because they diverge from the shared builders:
 *   - `buildCollaborationConfig` validates with `canStartShare` (non-blank room)
 *     and emits a config WITHOUT `role`/`sessionIntent`, unlike the shared
 *     `buildShareConfig` (which is `buildCreateCollaborationConfig`).
 *   - `buildShareUrl` is Angular-only (no other binding builds a share link).
 *
 * No `any`; all regexes use the `/u` flag; no `String.prototype.replaceAll`,
 * no regex named-capture-groups (ng-packagr lib-target constraints).
 */

import type { CollaborationConfig, ShareDefaults, ShareFormFields } from '../internal/shared';
import { canStartShare, resolveTransportForServerUrl, seedShareFields } from '../internal/shared';

export type { ShareDefaults, ShareFormFields };
export { canStartShare, seedShareFields };

/**
 * Assemble a {@link CollaborationConfig} from the (trimmed) form fields, or
 * `null` when the form is incomplete. A blank server URL yields
 * `transport: 'webrtc'`; otherwise the default websocket transport is used.
 */
export function buildCollaborationConfig(fields: ShareFormFields): CollaborationConfig | null {
	if (!canStartShare(fields)) {
		return null;
	}
	const serverUrl = fields.serverUrl.trim();
	return {
		roomId: fields.roomId.trim(),
		userName: fields.userName.trim(),
		serverUrl,
		transport: resolveTransportForServerUrl(serverUrl),
	};
}

/**
 * Build a shareable join URL for a session. Returns just the room id when no
 * `origin`/`pathname` are available (e.g. non-browser environments).
 */
export function buildShareUrl(
	roomId: string,
	serverUrl: string,
	location?: { origin: string; pathname: string },
): string {
	if (!location) {
		return roomId;
	}
	const room = encodeURIComponent(roomId);
	const trimmed = serverUrl.trim();
	if (trimmed.length === 0) {
		return `${location.origin}${location.pathname}?room=${room}&transport=webrtc`;
	}
	const server = encodeURIComponent(trimmed);
	return `${location.origin}${location.pathname}?room=${room}&server=${server}`;
}
