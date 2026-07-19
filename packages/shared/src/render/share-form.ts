/**
 * share-form: framework-free helpers for the Share dialog's start/join form
 * (field seeding, validity, and CollaborationConfig assembly). Thin sugar over
 * the neutral session builders in `share-session`, exposing the binding-facing
 * names the Share dialogs already used. Shared by every binding; each re-exports
 * these through a thin shim so the SFC/DOM layer stays presentation-only.
 */

import type { CollaborationConfig } from '../types';
import { resolveTransportForServerUrl } from './broadcast-helpers';
import {
	buildCreateCollaborationConfig,
	buildJoinCollaborationConfig,
	canJoinCollaborationSession,
} from './share-session';
import type { JoinSessionFields } from './share-session';

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
 * Whether the form can start a session: room id and display name are required
 * (after trimming); the server URL may be blank, which selects the serverless
 * webrtc peer-to-peer transport.
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
 * `null` when the form is incomplete. Peers edit together under the default
 * `role: 'collaborator'`.
 */
export function buildShareConfig(fields: ShareFormFields): CollaborationConfig | null {
	return buildCreateCollaborationConfig(fields);
}

export {
	buildJoinCollaborationConfig as buildJoinConfig,
	canJoinCollaborationSession as canJoinShare,
};
export type { JoinSessionFields };
