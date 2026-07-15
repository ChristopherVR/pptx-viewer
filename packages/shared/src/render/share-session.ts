/**
 * Framework-neutral Share dialog form, invitation-link, and join parsing.
 * Every UI binding emits the same CollaborationConfig shape from these helpers.
 */
import type { CollaborationConfig } from '../types';
import { resolveTransportForServerUrl } from './broadcast-helpers';
import { isValidRoomId } from './collaboration-presence';

export interface ShareSessionDefaults {
	roomId?: string;
	userName?: string;
	serverUrl?: string;
}

export interface ShareSessionFields {
	roomId: string;
	userName: string;
	serverUrl: string;
}

export interface JoinSessionFields {
	/** A complete invitation URL or a room ID. */
	invitation: string;
	userName: string;
	/** Used when `invitation` is a room ID rather than a complete URL. */
	serverUrl: string;
}

export function seedShareSessionFields(defaults?: ShareSessionDefaults): ShareSessionFields {
	return {
		roomId: defaults?.roomId ?? '',
		userName: defaults?.userName ?? '',
		serverUrl: defaults?.serverUrl ?? '',
	};
}

export function canCreateCollaborationSession(fields: ShareSessionFields): boolean {
	return isValidRoomId(fields.roomId.trim()) && fields.userName.trim().length > 0;
}

export function buildCreateCollaborationConfig(
	fields: ShareSessionFields,
): CollaborationConfig | null {
	if (!canCreateCollaborationSession(fields)) {
		return null;
	}
	const serverUrl = fields.serverUrl.trim();
	return {
		roomId: fields.roomId.trim(),
		userName: fields.userName.trim(),
		serverUrl,
		transport: resolveTransportForServerUrl(serverUrl),
		role: 'collaborator',
		sessionIntent: 'create',
	};
}

function parseInvitationUrl(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

/**
 * Parse an invitation produced by any framework binding. Complete links carry
 * the standard `room`, `server`, `transport`, and optional `signaling` query
 * parameters. A bare room ID uses the supplied fallback server.
 */
export function buildJoinCollaborationConfig(
	fields: JoinSessionFields,
): CollaborationConfig | null {
	const invitation = fields.invitation.trim();
	const userName = fields.userName.trim();
	if (!invitation || !userName) {
		return null;
	}

	const url = parseInvitationUrl(invitation);
	const roomId = (url?.searchParams.get('room') ?? (url ? '' : invitation)).trim();
	if (!isValidRoomId(roomId)) {
		return null;
	}

	const requestedTransport = url?.searchParams.get('transport');
	const serverUrl = (url?.searchParams.get('server') ?? fields.serverUrl).trim();
	const transport =
		requestedTransport === 'webrtc' ? 'webrtc' : resolveTransportForServerUrl(serverUrl);
	const signalingValue = url?.searchParams.get('signaling');
	const signaling = signalingValue
		?.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);

	return {
		roomId,
		userName,
		serverUrl: transport === 'webrtc' ? '' : serverUrl,
		transport,
		...(signaling?.length ? { signaling } : {}),
		role: 'collaborator',
		sessionIntent: 'join',
	};
}

export function canJoinCollaborationSession(fields: JoinSessionFields): boolean {
	return buildJoinCollaborationConfig(fields) !== null;
}

export function buildCollaborationShareUrl(
	config: Pick<CollaborationConfig, 'roomId' | 'serverUrl' | 'transport' | 'signaling'>,
	location?: { origin: string; pathname: string },
): string {
	if (!location) {
		return config.roomId;
	}
	const url = new URL(location.pathname, location.origin);
	url.searchParams.set('room', config.roomId);
	if (config.transport === 'webrtc' || !config.serverUrl.trim()) {
		url.searchParams.set('transport', 'webrtc');
		if (config.signaling?.length) {
			url.searchParams.set('signaling', config.signaling.join(','));
		}
	} else {
		url.searchParams.set('server', config.serverUrl.trim());
	}
	return url.toString();
}
