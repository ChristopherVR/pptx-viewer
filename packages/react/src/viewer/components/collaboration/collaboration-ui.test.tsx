import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
/**
 * Tests for collaboration UI components: pure logic and rendering checks.
 *
 * Tests verify component logic and output via direct React element creation,
 * structure validation, and renderToStaticMarkup for HTML output assertions.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

import type { ConnectionStatus, UserPresence } from '../../hooks/collaboration/types';

// ---------------------------------------------------------------------------
// Mock react-i18next before importing components
// ---------------------------------------------------------------------------

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const translations: Record<string, string | ((o: Record<string, unknown>) => string)> = {
				'pptx.collaboration.youLabel': (o: Record<string, unknown>) => `${o.name} (you)`,
				'pptx.collaboration.usersConnected': (o: Record<string, unknown>) =>
					`${o.count} ${Number(o.count) === 1 ? 'user' : 'users'} connected`,
				'pptx.collaboration.moreUsers': (o: Record<string, unknown>) => `${o.count} more users`,
				'pptx.collaboration.userCount': (o: Record<string, unknown>) =>
					`${o.count} ${Number(o.count) === 1 ? 'user' : 'users'}`,
				'pptx.collaboration.statusAriaLabel': (o: Record<string, unknown>) =>
					`Collaboration: ${o.status}`,
				'pptx.collaboration.status.connected': 'Connected',
				'pptx.collaboration.status.connecting': 'Connecting...',
				'pptx.collaboration.status.disconnected': 'Disconnected',
				'pptx.collaboration.status.error': 'Connection error',
			};
			const v = translations[key];
			if (typeof v === 'function') {
				return v(opts ?? {});
			}
			if (typeof v === 'string') {
				return v;
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

const { CollaborationStatusIndicator } = await import('./CollaborationStatusIndicator');
const { RemoteUserCursors } = await import('./RemoteUserCursors');
const { UserAvatarBar } = await import('./UserAvatarBar');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function render(element: React.ReactElement): string {
	return renderToStaticMarkup(element);
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockUser1: UserPresence = {
	clientId: 1,
	userName: 'Alice',
	userColor: '#ff0000',
	activeSlideIndex: 0,
	cursorX: 100,
	cursorY: 200,
	lastUpdated: new Date().toISOString(),
};

const mockUser2: UserPresence = {
	clientId: 2,
	userName: 'Bob',
	userColor: '#00ff00',
	activeSlideIndex: 0,
	cursorX: 300,
	cursorY: 400,
	lastUpdated: new Date().toISOString(),
};

const mockUserOnDifferentSlide: UserPresence = {
	clientId: 3,
	userName: 'Charlie',
	userColor: '#0000ff',
	activeSlideIndex: 1,
	cursorX: 150,
	cursorY: 250,
	lastUpdated: new Date().toISOString(),
};

const mockUserWithAvatar: UserPresence = {
	clientId: 4,
	userName: 'Diana Prince',
	userColor: '#9b59b6',
	activeSlideIndex: 0,
	cursorX: 500,
	cursorY: 300,
	lastUpdated: new Date().toISOString(),
	userAvatar: 'https://example.com/diana.png',
};

// ---------------------------------------------------------------------------
// RemoteUserCursors
// ---------------------------------------------------------------------------

describe('remoteUserCursors', () => {
	it('returns null for no visible users', () => {
		const result = RemoteUserCursors({
			remoteUsers: [],
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		expect(result).toBeNull();
	});

	it('returns null when all users are on different slides', () => {
		const result = RemoteUserCursors({
			remoteUsers: [mockUserOnDifferentSlide],
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		expect(result).toBeNull();
	});

	it('renders an SVG element for visible users', () => {
		const result = RemoteUserCursors({
			remoteUsers: [mockUser1, mockUser2],
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		expect(result).not.toBeNull();
		expect(result?.type).toBe('svg');
		expect(result?.props['data-testid']).toBe('remote-user-cursors');
	});

	it('only renders cursors for users on the active slide', () => {
		const result = RemoteUserCursors({
			remoteUsers: [mockUser1, mockUserOnDifferentSlide],
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		expect(result).not.toBeNull();
		// Should have 1 child <g> (only mockUser1 on slide 0)
		const children = React.Children.toArray(result?.props.children);
		expect(children).toHaveLength(1);
	});

	it('renders both users when both are on the active slide', () => {
		const result = RemoteUserCursors({
			remoteUsers: [mockUser1, mockUser2],
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		const children = React.Children.toArray(result?.props.children);
		expect(children).toHaveLength(2);
	});
});

// ---------------------------------------------------------------------------
// UserAvatarBar
// ---------------------------------------------------------------------------

describe('userAvatarBar', () => {
	it('returns null when disconnected', () => {
		const result = UserAvatarBar({
			remoteUsers: [mockUser1],
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'disconnected',
		});
		expect(result).toBeNull();
	});

	it('returns null when status is error', () => {
		const result = UserAvatarBar({
			remoteUsers: [mockUser1],
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'error',
		});
		expect(result).toBeNull();
	});

	it('renders when connected', () => {
		const result = UserAvatarBar({
			remoteUsers: [mockUser1],
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'connected',
		});
		expect(result).not.toBeNull();
		expect(result?.props['data-testid']).toBe('user-avatar-bar');
	});

	it('renders local + remote user circles', () => {
		const result = UserAvatarBar({
			remoteUsers: [mockUser1, mockUser2],
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'connected',
		});
		// 1 local + 2 remote = 3 children (no overflow)
		const children = React.Children.toArray(result?.props.children);
		expect(children).toHaveLength(3);
	});

	it('shows overflow indicator when exceeding maxVisible', () => {
		const users = Array.from({ length: 6 }, (_, i) => ({
			...mockUser1,
			clientId: i + 10,
			userName: `User${i}`,
		}));
		const result = UserAvatarBar({
			remoteUsers: users,
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'connected',
			maxVisible: 3,
		});
		// 3 visible + 1 overflow div = 4 children
		const children = React.Children.toArray(result?.props.children);
		expect(children).toHaveLength(4); // 3 visible circles + 1 overflow
	});
});

// ---------------------------------------------------------------------------
// CollaborationStatusIndicator
// ---------------------------------------------------------------------------

describe('collaborationStatusIndicator', () => {
	it('renders with connected status and user count', () => {
		const result = CollaborationStatusIndicator({
			status: 'connected',
			connectedCount: 3,
		});
		expect(result.props['data-testid']).toBe('collaboration-status');
		expect(result.props.role).toBe('status');
		expect(result.props['aria-label']).toBe('Collaboration: Connected');
	});

	it('keeps the connected runtime label stable across participant counts', () => {
		const result = CollaborationStatusIndicator({
			status: 'connected',
			connectedCount: 1,
		});
		expect(result.props['aria-label']).toBe('Collaboration: Connected');
	});

	it('shows connecting label', () => {
		const result = CollaborationStatusIndicator({
			status: 'connecting',
			connectedCount: 0,
		});
		expect(result.props['aria-label']).toContain('Connecting');
	});

	it('shows disconnected label', () => {
		const result = CollaborationStatusIndicator({
			status: 'disconnected',
			connectedCount: 0,
		});
		expect(result.props['aria-label']).toContain('Disconnected');
	});

	it('shows error label', () => {
		const result = CollaborationStatusIndicator({
			status: 'error',
			connectedCount: 0,
		});
		expect(result.props['aria-label']).toContain('Connection error');
	});
});

// ---------------------------------------------------------------------------
// RemoteUserCursors: extended tests
// ---------------------------------------------------------------------------

describe('remoteUserCursors - extended', () => {
	it('uses user color for cursor path fill', () => {
		const html = render(
			<RemoteUserCursors
				remoteUsers={[mockUser1]}
				activeSlideIndex={0}
				canvasWidth={960}
				canvasHeight={540}
			/>,
		);
		expect(html).toContain(mockUser1.userColor);
	});

	it('renders username text in cursor label', () => {
		const html = render(
			<RemoteUserCursors
				remoteUsers={[mockUser1]}
				activeSlideIndex={0}
				canvasWidth={960}
				canvasHeight={540}
			/>,
		);
		expect(html).toContain('Alice');
	});

	it('truncates long usernames with ellipsis', () => {
		const longNameUser: UserPresence = {
			...mockUser1,
			clientId: 99,
			userName: 'A Very Long Username That Exceeds Twenty Characters',
		};
		const html = render(
			<RemoteUserCursors
				remoteUsers={[longNameUser]}
				activeSlideIndex={0}
				canvasWidth={960}
				canvasHeight={540}
			/>,
		);
		expect(html).toContain('...');
		expect(html).not.toContain('A Very Long Username That Exceeds Twenty Characters');
	});

	it('positions cursor at correct coordinates via transform', () => {
		const html = render(
			<RemoteUserCursors
				remoteUsers={[mockUser1]}
				activeSlideIndex={0}
				canvasWidth={960}
				canvasHeight={540}
			/>,
		);
		expect(html).toContain(`translate(${mockUser1.cursorX}, ${mockUser1.cursorY})`);
	});

	it('renders SVG with correct viewBox dimensions', () => {
		const html = render(
			<RemoteUserCursors
				remoteUsers={[mockUser1]}
				activeSlideIndex={0}
				canvasWidth={1920}
				canvasHeight={1080}
			/>,
		);
		expect(html).toContain('viewBox="0 0 1920 1080"');
	});

	it('sets data-testid per cursor', () => {
		const result = RemoteUserCursors({
			remoteUsers: [mockUser1, mockUser2],
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		const html = render(result!);
		expect(html).toContain('data-testid="remote-cursor-1"');
		expect(html).toContain('data-testid="remote-cursor-2"');
	});

	it('renders zero cursors when all users are on different slides', () => {
		const users = Array.from({ length: 5 }, (_, i) => ({
			...mockUser1,
			clientId: i + 10,
			activeSlideIndex: i + 1, // all on different slides
		}));
		const result = RemoteUserCursors({
			remoteUsers: users,
			activeSlideIndex: 0,
			canvasWidth: 960,
			canvasHeight: 540,
		});
		expect(result).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// UserAvatarBar: extended tests
// ---------------------------------------------------------------------------

describe('userAvatarBar - extended', () => {
	it('renders when status is connecting', () => {
		const result = UserAvatarBar({
			remoteUsers: [],
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'connecting',
		});
		expect(result).not.toBeNull();
	});

	it('renders the local user first', () => {
		const html = render(
			<UserAvatarBar
				remoteUsers={[mockUser1]}
				localUserName='Local'
				localUserColor='#6366f1'
				status='connected'
			/>,
		);
		// Local user has "(you)" title
		expect(html).toContain('Local (you)');
	});

	it('renders initials for users without avatars', () => {
		const html = render(
			<UserAvatarBar
				remoteUsers={[mockUser1]}
				localUserName='Local'
				localUserColor='#6366f1'
				status='connected'
			/>,
		);
		// "Local" → "LO" initials, "Alice" → "AL" initials
		expect(html).toContain('LO'); // local user initials
		expect(html).toContain('AL'); // Alice initials
	});

	it('renders avatar image when userAvatar is provided', () => {
		const html = render(
			<UserAvatarBar
				remoteUsers={[mockUserWithAvatar]}
				localUserName='Local'
				localUserColor='#6366f1'
				status='connected'
			/>,
		);
		expect(html).toContain('https://example.com/diana.png');
		expect(html).toContain('<img');
	});

	it('shows two-part initials for users with first and last name', () => {
		const twoNameUser: UserPresence = {
			...mockUser1,
			clientId: 20,
			userName: 'John Smith',
		};
		const html = render(
			<UserAvatarBar
				remoteUsers={[twoNameUser]}
				localUserName='Jane Doe'
				localUserColor='#6366f1'
				status='connected'
			/>,
		);
		expect(html).toContain('JD'); // Jane Doe
		expect(html).toContain('JS'); // John Smith
	});

	it('shows correct overflow count text', () => {
		const users = Array.from({ length: 8 }, (_, i) => ({
			...mockUser1,
			clientId: i + 10,
			userName: `User${i}`,
		}));
		const html = render(
			<UserAvatarBar
				remoteUsers={users}
				localUserName='Local'
				localUserColor='#6366f1'
				status='connected'
				maxVisible={3}
			/>,
		);
		// 1 local + 8 remote = 9 total, 3 visible, 6 overflow
		expect(html).toContain('+6');
	});

	it('shows no overflow when user count equals maxVisible', () => {
		const users = Array.from({ length: 4 }, (_, i) => ({
			...mockUser1,
			clientId: i + 10,
			userName: `User${i}`,
		}));
		const result = UserAvatarBar({
			remoteUsers: users,
			localUserName: 'Local',
			localUserColor: '#6366f1',
			status: 'connected',
			maxVisible: 5, // 1 local + 4 remote = 5 total = maxVisible
		});
		const children = React.Children.toArray(result?.props.children);
		expect(children).toHaveLength(5); // no overflow element
	});

	it('uses correct aria-label with user count', () => {
		const html = render(
			<UserAvatarBar
				remoteUsers={[mockUser1, mockUser2]}
				localUserName='Local'
				localUserColor='#6366f1'
				status='connected'
			/>,
		);
		expect(html).toContain('3 users connected');
	});

	it('uses singular form for 1 user', () => {
		const html = render(
			<UserAvatarBar
				remoteUsers={[]}
				localUserName='Local'
				localUserColor='#6366f1'
				status='connected'
			/>,
		);
		expect(html).toContain('1 user connected');
	});
});

// ---------------------------------------------------------------------------
// CollaborationStatusIndicator: extended tests
// ---------------------------------------------------------------------------

describe('collaborationStatusIndicator - extended', () => {
	it('renders correct text content for connected status', () => {
		const html = render(<CollaborationStatusIndicator status='connected' connectedCount={5} />);
		expect(html).toContain('5 users');
	});

	it('renders singular "user" for connected count of 1', () => {
		const html = render(<CollaborationStatusIndicator status='connected' connectedCount={1} />);
		expect(html).toContain('1 user');
		expect(html).not.toContain('1 users');
	});

	it('renders status label text in visible span when not connected', () => {
		const result = CollaborationStatusIndicator({
			status: 'connecting',
			connectedCount: 0,
		});
		// The visible span shows the label, not the user count
		const children = React.Children.toArray(result.props.children);
		const textSpan = children[1] as React.ReactElement;
		expect(textSpan.props.children).toBe('Connecting...');
	});

	it('renders disconnected status label', () => {
		const html = render(<CollaborationStatusIndicator status='disconnected' connectedCount={0} />);
		expect(html).toContain('Disconnected');
	});

	it('renders error status label', () => {
		const html = render(<CollaborationStatusIndicator status='error' connectedCount={0} />);
		expect(html).toContain('Connection error');
	});

	it('includes data-testid for test targeting', () => {
		const html = render(<CollaborationStatusIndicator status='connected' connectedCount={1} />);
		expect(html).toContain('data-testid="collaboration-status"');
	});

	it('renders all four statuses without errors', () => {
		const statuses: ConnectionStatus[] = ['connected', 'connecting', 'disconnected', 'error'];
		statuses.forEach((status) => {
			const html = render(<CollaborationStatusIndicator status={status} connectedCount={0} />);
			expect(html).toContain('data-testid="collaboration-status"');
		});
		expect(statuses).toHaveLength(4);
	});

	it('includes status dot with color classes', () => {
		const html = render(<CollaborationStatusIndicator status='connected' connectedCount={1} />);
		// The connected status dot uses 'bg-green-400'
		expect(html).toContain('bg-green-400');
	});

	it('shows pulse animation for connecting status', () => {
		const html = render(<CollaborationStatusIndicator status='connecting' connectedCount={0} />);
		expect(html).toContain('animate-pulse');
	});

	it('shows red dot for error status', () => {
		const html = render(<CollaborationStatusIndicator status='error' connectedCount={0} />);
		expect(html).toContain('bg-red-400');
	});

	it('renders retry button when error status and onRetry provided', () => {
		const html = render(
			<CollaborationStatusIndicator status='error' connectedCount={0} onRetry={() => {}} />,
		);
		expect(html).toContain('>Retry<');
		expect(html).toContain('<button');
	});

	it('does not render retry button when connected', () => {
		const html = render(
			<CollaborationStatusIndicator status='connected' connectedCount={2} onRetry={() => {}} />,
		);
		expect(html).not.toContain('<button');
	});

	it('does not render retry button when error but no onRetry', () => {
		const html = render(<CollaborationStatusIndicator status='error' connectedCount={0} />);
		expect(html).not.toContain('<button');
	});
});
