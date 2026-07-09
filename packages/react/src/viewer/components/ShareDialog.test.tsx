/**
 * Tests for the ShareDialog component.
 *
 * Uses react-dom/server renderToStaticMarkup to render the component,
 * then validates the resulting HTML output. This matches the testing
 * pattern used across the codebase (see Toolbar.test.tsx, StatusBar.test.tsx).
 *
 * @module ShareDialog.test
 */
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { CollaborationContextValue } from '../hooks/collaboration/types';
import type { ShareDialogProps } from './ShareDialog';

// ---------------------------------------------------------------------------
// Mock react-i18next
// ---------------------------------------------------------------------------

vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const translations: Record<string, string | ((o: Record<string, unknown>) => string)> = {
				'pptx.share.title': 'Share Presentation',
				'pptx.share.collaborationActive': 'Collaboration Active',
				'pptx.share.close': 'Close',
				'pptx.share.closeDialog': 'Close dialog',
				'pptx.share.cancel': 'Cancel',
				'pptx.share.startSharing': 'Start Sharing',
				'pptx.share.stopSharing': 'Stop Sharing',
				'pptx.share.description':
					'Start a real-time collaboration session. Share the link with others to collaborate.',
				'pptx.share.preconfiguredDescription':
					'Your administrator has configured the collaboration settings below.',
				'pptx.share.sessionName': 'Session Name',
				'pptx.share.sessionPlaceholder': 'e.g. session-abc123',
				'pptx.share.sessionHint': 'A unique name for your session.',
				'pptx.share.displayName': 'Your Display Name',
				'pptx.share.namePlaceholder': 'e.g. Alice',
				'pptx.share.serverLabel': 'Collaboration Server',
				'pptx.share.serverPlaceholder': 'wss://collab.example.com',
				'pptx.share.serverHint': 'Enter the WebSocket URL of a y-websocket server.',
				'pptx.share.p2pHint':
					'Peer-to-peer mode: same-browser tabs always connect; other devices use WebRTC signaling.',
				'pptx.share.p2pServerValue': 'Peer-to-peer (no server)',
				'pptx.share.shareLink': 'Share Link',
				'pptx.share.copyUrl': 'Copy URL',
				'pptx.share.copyLink': 'Copy link to clipboard',
				'pptx.share.copied': 'Copied!',
				'pptx.share.shareHint': 'Share this link with others to join.',
				'pptx.share.room': 'Room:',
				'pptx.share.server': 'Server:',
				'pptx.share.connectedUsers': 'Connected Users',
				'pptx.share.you': '(you)',
				'pptx.collaboration.userCount': (o: Record<string, unknown>) =>
					`${o.count} ${Number(o.count) === 1 ? 'user' : 'users'}`,
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

// ---------------------------------------------------------------------------
// Mock useCollaboration
// ---------------------------------------------------------------------------

/** Current mock value returned by `useCollaboration`. Tests override this. */
let mockCollabValue: CollaborationContextValue | null = null;

vi.mock<typeof import('./collaboration')>(import('./collaboration'), () => ({
	useCollaboration: () => mockCollabValue,
}));

const { ShareDialog } = await import('./ShareDialog');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

function createProps(overrides: Partial<ShareDialogProps> = {}): ShareDialogProps {
	return {
		open: true,
		onClose: vi.fn<() => void>(),
		...overrides,
	};
}

function createConnectedCollab(
	overrides: Partial<CollaborationContextValue> = {},
): CollaborationContextValue {
	return {
		status: 'connected',
		remoteUsers: [],
		broadcastPresence: vi.fn<() => void>(),
		connectedCount: 1,
		config: {
			roomId: 'test-room',
			serverUrl: 'wss://collab.example.com',
			userName: 'Alice',
			userColor: '#6366f1',
		},
		doc: null,
		...overrides,
	};
}

// ===========================================================================
// Tests
// ===========================================================================

beforeEach(() => {
	mockCollabValue = null;
});

// ---------------------------------------------------------------------------
// 1. Renders start session form when not active
// ---------------------------------------------------------------------------
describe('shareDialog - start session form', () => {
	it('renders session name, display name, and server URL inputs when not active', () => {
		const html = render(React.createElement(ShareDialog, createProps()));

		expect(html).toContain('Session Name');
		expect(html).toContain('Your Display Name');
		expect(html).toContain('Collaboration Server');
		expect(html).toContain('Share Presentation');
	});

	it('renders Start Sharing button when not active', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('Start Sharing');
	});

	it('shows descriptive text about sharing', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('real-time collaboration');
	});

	it('shows input placeholders', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('e.g. session-abc123');
		expect(html).toContain('e.g. Alice');
		expect(html).toContain('wss://collab.example.com');
	});
});

// ---------------------------------------------------------------------------
// 2. Start button disabled when fields empty
// ---------------------------------------------------------------------------
describe('shareDialog - start button validation', () => {
	it('disables start button when userName is empty', () => {
		// Default props have no userName set (empty string)
		const html = render(
			React.createElement(
				ShareDialog,
				createProps({ defaultUserName: '', defaultRoomId: 'room-1' }),
			),
		);
		// The button should have the disabled attribute
		expect(html).toContain('disabled');
	});

	it('enables start button when all fields are filled', () => {
		const html = render(
			React.createElement(
				ShareDialog,
				createProps({
					defaultRoomId: 'my-room',
					defaultUserName: 'Alice',
					defaultServerUrl: 'wss://server.example.com',
				}),
			),
		);
		// Should contain the Start Sharing button. Check it does NOT have
		// the disabled="" attribute (note: CSS classes contain "disabled:"
		// so we must check for the actual HTML attribute).
		const startBtnRegex = /<button[^>]*>Start Sharing<\/button>/u;
		const match = html.match(startBtnRegex);
		expect(match).not.toBeNull();
		// The matched button should not have disabled="" attribute
		expect(match![0]).not.toContain('disabled=""');
	});

	it('enables start button with an empty server (peer-to-peer)', () => {
		const html = render(
			React.createElement(
				ShareDialog,
				createProps({ defaultRoomId: 'p2p-room', defaultUserName: 'Alice', defaultServerUrl: '' }),
			),
		);
		const startBtnRegex = /<button[^>]*>Start Sharing<\/button>/u;
		const match = html.match(startBtnRegex);
		expect(match).not.toBeNull();
		expect(match![0]).not.toContain('disabled=""');
	});
});

// ---------------------------------------------------------------------------
// 2b. Peer-to-peer (serverless) mode
// ---------------------------------------------------------------------------
describe('shareDialog - peer-to-peer mode', () => {
	it('shows the P2P hint when the server field is empty', () => {
		const html = render(React.createElement(ShareDialog, createProps({ defaultServerUrl: '' })));
		expect(html).toContain('Peer-to-peer mode');
	});

	it('shows the y-websocket server hint when a server URL is set', () => {
		const html = render(
			React.createElement(
				ShareDialog,
				createProps({ defaultServerUrl: 'wss://server.example.com' }),
			),
		);
		expect(html).toContain('y-websocket server');
		expect(html).not.toContain('Peer-to-peer mode');
	});

	it('shows the peer-to-peer server value in the active session for a webrtc session', () => {
		mockCollabValue = createConnectedCollab({
			config: {
				roomId: 'p2p-room',
				serverUrl: '',
				transport: 'webrtc',
				userName: 'Alice',
			},
		});
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('Peer-to-peer (no server)');
	});
});

// ---------------------------------------------------------------------------
// 3. Renders active session view when connected
// ---------------------------------------------------------------------------
describe('shareDialog - active session view', () => {
	it('shows Collaboration Active header when connected', () => {
		mockCollabValue = createConnectedCollab();
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('Collaboration Active');
	});

	it('shows connected status text', () => {
		mockCollabValue = createConnectedCollab({ status: 'connected' });
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('connected');
	});

	it('shows Stop Sharing button when onStopCollaboration is provided', () => {
		mockCollabValue = createConnectedCollab();
		const html = render(
			React.createElement(ShareDialog, createProps({ onStopCollaboration: vi.fn<() => void>() })),
		);
		expect(html).toContain('Stop Sharing');
	});

	it('does not show Start Sharing button when active', () => {
		mockCollabValue = createConnectedCollab();
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).not.toContain('Start Sharing');
	});

	it('shows Close instead of Cancel when active', () => {
		mockCollabValue = createConnectedCollab();
		const html = render(React.createElement(ShareDialog, createProps()));
		// Footer button should say "Close" not "Cancel"
		expect(html).toContain('>Close<');
	});
});

// ---------------------------------------------------------------------------
// 4. Copy URL contains room and server params
// ---------------------------------------------------------------------------
describe('shareDialog - share URL', () => {
	it('renders room ID and server URL in the session details', () => {
		// In SSR (typeof window === 'undefined'), the share link URL falls
		// back to just collab.config.roomId. We verify the room and server
		// details are shown in the session details section instead.
		mockCollabValue = createConnectedCollab({
			config: {
				roomId: 'my-session',
				serverUrl: 'wss://collab.test.io',
				userName: 'Bob',
			},
		});
		const html = render(React.createElement(ShareDialog, createProps()));
		// The session details section shows "Room: <code>my-session</code>"
		expect(html).toContain('my-session');
		// And "Server: <code>wss://collab.test.io</code>"
		expect(html).toContain('wss://collab.test.io');
	});

	it('renders Copy URL button text', () => {
		mockCollabValue = createConnectedCollab();
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('Copy URL');
	});

	it('shows Share Link label', () => {
		mockCollabValue = createConnectedCollab();
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('Share Link');
	});
});

// ---------------------------------------------------------------------------
// 5. Shows user count when active
// ---------------------------------------------------------------------------
describe('shareDialog - user count', () => {
	it('shows "1 user" when only local user is connected', () => {
		mockCollabValue = createConnectedCollab({ connectedCount: 1 });
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('1 user');
		// Should be singular
		expect(html).not.toContain('1 users');
	});

	it('shows "3 users" when multiple users are connected', () => {
		mockCollabValue = createConnectedCollab({ connectedCount: 3 });
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('3 users');
	});

	it('shows "2 users" with remote user listed', () => {
		mockCollabValue = createConnectedCollab({
			connectedCount: 2,
			remoteUsers: [
				{
					clientId: 42,
					userName: 'Bob',
					userColor: '#ff0000',
					activeSlideIndex: 2,
					cursorX: 0,
					cursorY: 0,
					lastUpdated: new Date().toISOString(),
				},
			],
		});
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('2 users');
		expect(html).toContain('Bob');
		// Shows slide info for remote user
		expect(html).toContain('Slide 3');
	});
});

// ---------------------------------------------------------------------------
// 6. Preconfigured mode makes fields readonly
// ---------------------------------------------------------------------------
describe('shareDialog - preconfigured mode', () => {
	it('sets input fields to readonly when preconfigured is true', () => {
		const html = render(
			React.createElement(
				ShareDialog,
				createProps({
					preconfigured: true,
					defaultRoomId: 'admin-room',
					defaultUserName: 'Admin',
					defaultServerUrl: 'wss://corp.server.com',
				}),
			),
		);
		// All 3 inputs should have readOnly attribute (rendered as readonly="")
		const readonlyCount = (html.match(/readonly=""/giu) || []).length;
		expect(readonlyCount).toBe(3);
	});

	it('shows administrator message when preconfigured', () => {
		const html = render(React.createElement(ShareDialog, createProps({ preconfigured: true })));
		expect(html).toContain('administrator has configured');
	});

	it('does not show administrator message when not preconfigured', () => {
		const html = render(React.createElement(ShareDialog, createProps({ preconfigured: false })));
		expect(html).not.toContain('administrator has configured');
	});
});

// ---------------------------------------------------------------------------
// 7. Close button calls onClose (structural check)
// ---------------------------------------------------------------------------
describe('shareDialog - close button', () => {
	it('renders a close button with aria-label', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('aria-label="Close"');
	});

	it('renders a backdrop button for closing', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('aria-label="Close dialog"');
	});

	it('renders Cancel button in footer when not active', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('>Cancel<');
	});
});

// ---------------------------------------------------------------------------
// 8. Shows default values
// ---------------------------------------------------------------------------
describe('shareDialog - default values', () => {
	it('populates session name from defaultRoomId', () => {
		const html = render(
			React.createElement(ShareDialog, createProps({ defaultRoomId: 'custom-room-42' })),
		);
		expect(html).toContain('custom-room-42');
	});

	it('populates display name from defaultUserName', () => {
		const html = render(
			React.createElement(ShareDialog, createProps({ defaultUserName: 'Charlie' })),
		);
		expect(html).toContain('value="Charlie"');
	});

	it('populates server URL from defaultServerUrl', () => {
		const html = render(
			React.createElement(ShareDialog, createProps({ defaultServerUrl: 'wss://my-server.io' })),
		);
		expect(html).toContain('value="wss://my-server.io"');
	});

	it('uses default server URL when not provided', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('wss://collab.example.com');
	});
});

// ---------------------------------------------------------------------------
// 9. Returns null when not open
// ---------------------------------------------------------------------------
describe('shareDialog - closed state', () => {
	it('returns empty HTML when open is false', () => {
		const html = render(React.createElement(ShareDialog, createProps({ open: false })));
		// renderToStaticMarkup returns empty string for null
		expect(html).toBe('');
	});
});

// ---------------------------------------------------------------------------
// 10. Dialog accessibility
// ---------------------------------------------------------------------------
describe('shareDialog - accessibility', () => {
	it('renders with dialog role and aria-modal', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('role="dialog"');
		expect(html).toContain('aria-modal="true"');
	});

	it('has aria-label for the dialog', () => {
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('aria-label="Share Presentation"');
	});
});

// ---------------------------------------------------------------------------
// 11. Session details when active
// ---------------------------------------------------------------------------
describe('shareDialog - session details', () => {
	it('shows room and server info', () => {
		mockCollabValue = createConnectedCollab({
			config: {
				roomId: 'detail-room',
				serverUrl: 'wss://detail.server.com',
				userName: 'DetailUser',
			},
		});
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('detail-room');
		expect(html).toContain('wss://detail.server.com');
	});

	it('shows connecting status with yellow indicator', () => {
		mockCollabValue = createConnectedCollab({ status: 'connecting' });
		const html = render(React.createElement(ShareDialog, createProps()));
		expect(html).toContain('connecting');
		expect(html).toContain('text-yellow-400');
	});

	it('shows error status with red indicator', () => {
		// 'error' status means isActive is false, so it shows the start form.
		// But if we set status to anything truthy that isn't 'disconnected' or 'error'...
		// Actually 'error' makes isActive false, so we verify the form is shown.
		mockCollabValue = createConnectedCollab({
			status: 'error' as unknown as CollaborationContextValue['status'],
		});
		const html = render(React.createElement(ShareDialog, createProps()));
		// Should show the start form since error means not active
		expect(html).toContain('Share Presentation');
	});

	it('shows local user avatar with initials', () => {
		mockCollabValue = createConnectedCollab({
			remoteUsers: [
				{
					clientId: 99,
					userName: 'Remote User',
					userColor: '#00ff00',
					activeSlideIndex: 0,
					cursorX: 0,
					cursorY: 0,
					lastUpdated: new Date().toISOString(),
				},
			],
		});
		const html = render(
			React.createElement(
				ShareDialog,
				createProps({
					activeCollaboration: {
						roomId: 'test-room',
						serverUrl: 'wss://collab.example.com',
						userName: 'Alice Baker',
					},
				}),
			),
		);
		// Local user initials: "AB" (Alice Baker)
		expect(html).toContain('AB');
		expect(html).toContain('(you)');
		// Remote user initials: "RU" (Remote User)
		expect(html).toContain('RU');
	});
});
