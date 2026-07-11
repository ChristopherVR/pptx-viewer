import type { CollaborationConfig } from 'pptx-viewer-shared';
import { resolveTransportForServerUrl } from 'pptx-viewer-shared';

/**
 * share-helpers.ts: pure (framework-free) helpers for the Share dialog.
 *
 * Mirrors the Vue `ShareDialog.vue` / Angular `share-helpers.ts` form
 * validation and config-assembly logic (see `useCollaborationWiring.onShareStart`
 * for the `role: 'collaborator'` config this produces). No DOM here so it is
 * trivially unit-testable; the DOM builder lives in `ui/share-dialog.ts`.
 */

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

/**
 * Whether the required fields are non-blank (after trimming). A blank server
 * URL is valid: it selects the serverless (webrtc) peer-to-peer transport, so
 * only the room id and display name are required.
 */
export function canStartShare(fields: ShareFormFields): boolean {
	return fields.roomId.trim().length > 0 && fields.userName.trim().length > 0;
}

/**
 * Assemble a two-way collaboration {@link CollaborationConfig} from the
 * (trimmed) form fields, or `null` when the form is incomplete. Always sets
 * `role: 'collaborator'`, matching the Vue/Angular Share flow (peers edit
 * together under the default role).
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
		role: 'collaborator',
	};
}
