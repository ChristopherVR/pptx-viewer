import type { ConnectionStatus, SanitizedPresence } from './collaboration-presence';

export interface CollaborationShellInput {
	/** Host permission is a ceiling; collaboration never grants it. */
	authorizedCanEdit: boolean;
	configured: boolean;
	/** Includes the active session's role and readiness, not an unvalidated config role. */
	readOnly: boolean;
	/** A real source is loading. A blank document is not a pending source. */
	sourcePending: boolean;
	sourceError: boolean;
	status: ConnectionStatus;
	remoteUsers: readonly SanitizedPresence[];
}

export interface CollaborationShellState {
	canEdit: boolean;
	status: ConnectionStatus;
	remoteUsers: readonly SanitizedPresence[];
	connectedCount: number;
}

export type CollaborationShellEditInput = Pick<
	CollaborationShellInput,
	'authorizedCanEdit' | 'configured' | 'readOnly' | 'sourcePending' | 'sourceError'
>;

export function resolveCollaborationShellEditability(input: CollaborationShellEditInput): boolean {
	return (
		input.authorizedCanEdit &&
		(!input.configured || (!input.readOnly && !input.sourcePending && !input.sourceError))
	);
}

/** Map the existing session state into custom chrome without another sync policy. */
export function resolveCollaborationShellState(
	input: CollaborationShellInput,
): CollaborationShellState {
	const status = input.configured ? input.status : 'disconnected';
	const remoteUsers = input.configured ? input.remoteUsers : [];
	return {
		canEdit: resolveCollaborationShellEditability(input),
		status,
		remoteUsers,
		connectedCount: remoteUsers.length + (status === 'connected' ? 1 : 0),
	};
}
