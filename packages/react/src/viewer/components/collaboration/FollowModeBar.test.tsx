/**
 * Tests for the FollowModeBar component (React port of the Vue follow bar).
 *
 * Uses react-dom/server renderToStaticMarkup (the codebase's node-env render
 * pattern) to validate the rendered markup across follow states.
 *
 * @module collaboration/FollowModeBar.test
 */
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import type { UserPresence } from '../../hooks/collaboration/types';
import type { FollowModeBarProps } from './FollowModeBar';

// ---------------------------------------------------------------------------
// Mock react-i18next
// ---------------------------------------------------------------------------

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const map: Record<string, string> = {
				'pptx.followMode.following': 'Following',
				'pptx.followMode.stop': 'Stop',
				'pptx.followMode.stopFollowing': 'Stop following',
				'pptx.followMode.followCollaborator': 'Follow a collaborator',
				'pptx.followMode.followUser': `Follow ${opts?.name ?? ''}`,
				'pptx.followMode.stopFollowingUser': `Stop following ${opts?.name ?? ''}`,
			};
			if (map[key] !== undefined) {
				return map[key];
			}
			const fallback = translationsEn[key];
			if (fallback === undefined) {
				return key;
			}
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

const { FollowModeBar } = await import('./FollowModeBar');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

function presence(over: Partial<UserPresence>): UserPresence {
	return {
		clientId: 1,
		userName: 'Ada',
		userColor: '#ff0000',
		activeSlideIndex: 0,
		cursorX: 0,
		cursorY: 0,
		lastUpdated: new Date().toISOString(),
		...over,
	};
}

function createProps(overrides: Partial<FollowModeBarProps> = {}): FollowModeBarProps {
	return {
		presences: [],
		followedClientId: null,
		onFollow: vi.fn<(clientId: number | null) => void>(),
		...overrides,
	};
}

function countPeers(html: string): number {
	return (html.match(/data-testid="follow-peer"/gu) || []).length;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('followModeBar', () => {
	it('renders nothing when there are no peers', () => {
		expect(render(React.createElement(FollowModeBar, createProps()))).toBe('');
	});

	it('lists one chip per active peer', () => {
		const html = render(
			React.createElement(
				FollowModeBar,
				createProps({
					presences: [
						presence({ clientId: 2, userName: 'Bob' }),
						presence({ clientId: 3, userName: 'Carol' }),
					],
				}),
			),
		);
		expect(countPeers(html)).toBe(2);
	});

	it('shows a prompt when not following anyone', () => {
		const html = render(
			React.createElement(
				FollowModeBar,
				createProps({ presences: [presence({ clientId: 2, userName: 'Bob' })] }),
			),
		);
		expect(html).toContain('Follow a collaborator');
		expect(html).not.toContain('data-testid="follow-stop"');
	});

	it('shows who is being followed with a Stop affordance', () => {
		const html = render(
			React.createElement(
				FollowModeBar,
				createProps({
					presences: [presence({ clientId: 2, userName: 'Bob' })],
					followedClientId: 2,
				}),
			),
		);
		expect(html).toContain('Following');
		expect(html).toContain('Bob');
		expect(html).toContain('data-testid="follow-stop"');
		expect(html).toContain('aria-pressed="true"');
	});

	it('renders initials avatars in the peer colour', () => {
		const html = render(
			React.createElement(
				FollowModeBar,
				createProps({
					presences: [presence({ clientId: 2, userName: 'Bob Jones', userColor: '#00ff00' })],
				}),
			),
		);
		expect(html).toContain('BJ');
		expect(html).toContain('background-color:#00ff00');
	});
});
