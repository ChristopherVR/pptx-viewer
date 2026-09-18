import { describe, expect, it } from 'vitest';

import type { CollaborationShellInput } from './collaboration-shell-state';
import {
	describeCollaborationShellState,
	resolveCollaborationShellState,
} from './collaboration-shell-state';

const input: CollaborationShellInput = {
	authorizedCanEdit: true,
	configured: true,
	readOnly: false,
	sourcePending: false,
	sourceError: false,
	status: 'connected',
	remoteUsers: [],
};

describe('custom-shell collaboration state', () => {
	it.each([
		{ configured: false, sourcePending: true },
		{ configured: false, sourceError: true },
		{ configured: false, readOnly: true },
		{ status: 'disconnected' as const },
		{},
	])('preserves local authorization without inventing a readiness rule: %o', (overrides) => {
		expect(resolveCollaborationShellState({ ...input, ...overrides }).canEdit).toBeTruthy();
	});

	it.each([
		{ authorizedCanEdit: false },
		{ authorizedCanEdit: false, configured: false },
		{ readOnly: true },
		{ sourcePending: true },
		{ sourceError: true },
	])('honors host and active-session restrictions: %o', (overrides) => {
		expect(resolveCollaborationShellState({ ...input, ...overrides }).canEdit).toBeFalsy();
	});

	it('returns the session presence without copying and clears it when disabled', () => {
		const remoteUsers = [
			{
				clientId: 2,
				userName: 'Peer',
				userColor: '#123456',
				activeSlideIndex: 0,
				cursorX: 20,
				cursorY: 30,
				lastUpdated: '2026-09-17T00:00:00Z',
			},
		];
		const connected = resolveCollaborationShellState({ ...input, remoteUsers });
		expect(connected.remoteUsers).toBe(remoteUsers);
		expect(connected.connectedCount).toBe(2);
		expect(
			resolveCollaborationShellState({ ...input, configured: false, remoteUsers }),
		).toStrictEqual({
			canEdit: true,
			status: 'disconnected',
			remoteUsers: [],
			connectedCount: 0,
		});
	});

	it('describes the state the same way for every custom-shell demo', () => {
		const translate = (key: string, params?: Record<string, string | number>): string =>
			params ? `${key}:${params.count}` : key;
		expect(describeCollaborationShellState(resolveCollaborationShellState(input), translate)).toBe(
			'pptx.collaboration.status.connected · pptx.collaboration.usersConnected:1 · pptx.collaboration.editable',
		);
		expect(
			describeCollaborationShellState(
				resolveCollaborationShellState({ ...input, readOnly: true, status: 'connecting' }),
				translate,
			),
		).toBe(
			'pptx.collaboration.status.connecting · pptx.collaboration.usersConnected:0 · pptx.toolbar.readOnly',
		);
	});
});
