/**
 * share-helpers.ts: framework-free, unit-testable logic for `ShareDialog.svelte`
 * (form seeding, validity, and `CollaborationConfig` assembly), a Svelte port
 * of the Vue `ShareDialog.vue` inline logic. Kept out of the SFC per the repo's
 * "thin SFC" convention and so it can be unit-tested directly.
 */
import type { CollaborationConfig } from 'pptx-viewer-shared';
import { resolveTransportForServerUrl } from 'pptx-viewer-shared';

/** The share form's editable fields. */
export interface ShareFormFields {
	roomId: string;
	userName: string;
	serverUrl: string;
}

/** Optional seed values for the share start form. */
export interface ShareDefaults {
	roomId?: string;
	userName?: string;
	serverUrl?: string;
}

/** Seed the form fields from the (optional) host-supplied defaults. */
export function seedShareFields(defaults?: ShareDefaults): ShareFormFields {
	return {
		roomId: defaults?.roomId ?? '',
		userName: defaults?.userName ?? '',
		serverUrl: defaults?.serverUrl ?? '',
	};
}

/**
 * Whether the form can start a session: room id and display name are
 * required; the server URL may be blank, which selects the serverless webrtc
 * transport.
 */
export function canStartShare(fields: ShareFormFields): boolean {
	return fields.roomId.trim().length > 0 && fields.userName.trim().length > 0;
}

/** True when the current server field selects serverless peer-to-peer mode. */
export function isPeerToPeerShare(serverUrl: string): boolean {
	return resolveTransportForServerUrl(serverUrl) === 'webrtc';
}

/**
 * Assemble a {@link CollaborationConfig} from the (trimmed) form fields, or
 * `null` when the form is incomplete.
 */
export function buildShareConfig(fields: ShareFormFields): CollaborationConfig | null {
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
