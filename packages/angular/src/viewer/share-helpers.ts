/**
 * share-helpers.ts: Pure (no Angular) helpers for the Share dialog.
 *
 * Mirrors the form-validation / config-assembly logic of the Vue
 * `ShareDialog.vue` plus the share-link builder from the React `ShareDialog`.
 *
 * No `any`; all regexes use the `/u` flag; no `String.prototype.replaceAll`,
 * no regex named-capture-groups (ng-packagr lib-target constraints).
 */

import type { CollaborationConfig } from '../internal/shared';

/** Prefilled values for the Share form fields. */
export interface ShareDefaults {
	roomId?: string;
	userName?: string;
	serverUrl?: string;
}

/** The Share form's editable fields. */
export interface ShareFormFields {
	roomId: string;
	userName: string;
	serverUrl: string;
}

/** Seed the form fields from the (optional) defaults, coercing absent values. */
export function seedShareFields(defaults?: ShareDefaults): ShareFormFields {
	return {
		roomId: defaults?.roomId ?? '',
		userName: defaults?.userName ?? '',
		serverUrl: defaults?.serverUrl ?? '',
	};
}

/** Whether all three required fields are non-blank (after trimming). */
export function canStartShare(fields: ShareFormFields): boolean {
	return (
		fields.roomId.trim().length > 0 &&
		fields.userName.trim().length > 0 &&
		fields.serverUrl.trim().length > 0
	);
}

/**
 * Assemble a {@link CollaborationConfig} from the (trimmed) form fields, or
 * `null` when the form is incomplete.
 */
export function buildCollaborationConfig(fields: ShareFormFields): CollaborationConfig | null {
	if (!canStartShare(fields)) {
		return null;
	}
	return {
		roomId: fields.roomId.trim(),
		userName: fields.userName.trim(),
		serverUrl: fields.serverUrl.trim(),
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
	const server = encodeURIComponent(serverUrl);
	return `${location.origin}${location.pathname}?room=${room}&server=${server}`;
}
