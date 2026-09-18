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

export type CollaborationShellTranslate = (
	key: string,
	params?: Record<string, string | number>,
) => string;

/**
 * One-line, localised status for a custom shell's `role="status"` readout.
 *
 * Every binding's custom-shell demo renders this same string under the same
 * `Collaboration status` label, so the framework-neutral e2e helper that
 * waits for the shell to become editable (`waitForHostEditing`) reads every
 * binding the same way. Three of five demos once phrased it differently and
 * the helper silently skipped them; on vanilla, that let a peer double-click
 * before its edit gate opened.
 */
export function describeCollaborationShellState(
	state: Pick<CollaborationShellState, 'canEdit' | 'status' | 'connectedCount'>,
	translate: CollaborationShellTranslate,
): string {
	return [
		translate(`pptx.collaboration.status.${state.status}`),
		translate('pptx.collaboration.usersConnected', { count: state.connectedCount }),
		translate(state.canEdit ? 'pptx.collaboration.editable' : 'pptx.toolbar.readOnly'),
	].join(' · ');
}
