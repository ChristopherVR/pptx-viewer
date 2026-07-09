import { describe, it, expect, vi, beforeEach, afterEach, expectTypeOf } from 'vitest';

import {
	isPresenterMessage,
	PRESENTER_MSG_ORIGIN,
	PRESENTER_CHANNEL_NAME,
	isAudienceTab,
	AUDIENCE_HASH,
} from './usePresenterWindow';
import type {
	PresenterSlideChangeMessage,
	PresenterExitMessage,
	PresenterMessage,
} from './usePresenterWindow';

// ---------------------------------------------------------------------------
// This package has no @testing-library/react devDependency and this test
// suite runs under vitest's default node environment (no DOM renderer), so
// usePresenterWindow's useRef/useCallback/useEffect wiring cannot be driven
// directly. Following the pattern used elsewhere in this directory
// (useRehearsalTimings.test.ts, useSlideNavigation.test.ts) and in
// collaboration/useYjsProvider.test.ts, we test the exported pure helpers
// directly and exercise a faithful reproduction of the hook's channel
// management logic against a mock BroadcastChannel.
// ---------------------------------------------------------------------------

const TEST_SESSION_ID = '00000000-0000-0000-0000-000000000001';

// ---------------------------------------------------------------------------
// isPresenterMessage
// ---------------------------------------------------------------------------

describe('isPresenterMessage', () => {
	it('accepts a valid slide-change message', () => {
		const msg: PresenterSlideChangeMessage = {
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-slide-change',
			slideIndex: 3,
			sessionId: TEST_SESSION_ID,
		};
		expect(isPresenterMessage(msg)).toBeTruthy();
	});

	it('accepts a valid exit message', () => {
		const msg: PresenterExitMessage = {
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-exit',
			sessionId: TEST_SESSION_ID,
		};
		expect(isPresenterMessage(msg)).toBeTruthy();
	});

	it('rejects null', () => {
		expect(isPresenterMessage(null)).toBeFalsy();
	});

	it('rejects undefined', () => {
		expect(isPresenterMessage(undefined)).toBeFalsy();
	});

	it('rejects a string', () => {
		expect(isPresenterMessage('hello')).toBeFalsy();
	});

	it('rejects a number', () => {
		expect(isPresenterMessage(42)).toBeFalsy();
	});

	it('rejects an object with wrong origin', () => {
		expect(
			isPresenterMessage({
				origin: 'wrong-origin',
				type: 'presenter-slide-change',
				slideIndex: 0,
				sessionId: TEST_SESSION_ID,
			}),
		).toBeFalsy();
	});

	it('rejects an object with unknown type', () => {
		expect(
			isPresenterMessage({
				origin: PRESENTER_MSG_ORIGIN,
				type: 'unknown-type',
				sessionId: TEST_SESSION_ID,
			}),
		).toBeFalsy();
	});

	it('rejects a message missing the sessionId', () => {
		expect(
			isPresenterMessage({
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-slide-change',
				slideIndex: 0,
			}),
		).toBeFalsy();
	});

	it('rejects an empty object', () => {
		expect(isPresenterMessage({})).toBeFalsy();
	});

	it('rejects an object with only the origin', () => {
		expect(isPresenterMessage({ origin: PRESENTER_MSG_ORIGIN })).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// isAudienceTab: requires a browser environment
// ---------------------------------------------------------------------------

describe('isAudienceTab', () => {
	it('is exported as a function', () => {
		expectTypeOf(isAudienceTab).toBeFunction();
	});

	it('aUDIENCE_HASH is the expected value', () => {
		expect(AUDIENCE_HASH).toBe('#pptx-audience');
	});
});

// ---------------------------------------------------------------------------
// Mock BroadcastChannel: mirrors the surface usePresenterWindow.ts relies on.
//
// Unlike window.postMessage, BroadcastChannel.postMessage takes exactly one
// argument: there is no targetOrigin parameter, so there is no wildcard-origin
// ('*') footgun to guard against. Delivery is scoped by the platform to
// same-origin listeners on the same channel name.
// ---------------------------------------------------------------------------

class MockBroadcastChannel {
	closed = false;
	readonly postMessage = vi.fn<(message: PresenterMessage) => void>();

	constructor(public readonly name: string) {}

	close(): void {
		this.closed = true;
	}
}

interface MockWindow {
	closed: boolean;
	close: ReturnType<typeof vi.fn>;
}

function createMockWindow(): MockWindow {
	return {
		closed: false,
		close: vi.fn<() => void>(),
	};
}

/**
 * Reproduces the channel-management logic of usePresenterWindow without
 * React hooks: a lazily-created BroadcastChannel, a per-session nonce that
 * gates every send, and exit-before-replace semantics on re-open.
 */
class PresenterChannelManager {
	audienceWindow: MockWindow | null = null;
	channel: MockBroadcastChannel | null = null;
	sessionId = '';

	private getChannel(): MockBroadcastChannel {
		if (!this.channel) {
			this.channel = new MockBroadcastChannel(PRESENTER_CHANNEL_NAME);
		}
		return this.channel;
	}

	isAudienceWindowOpen(): boolean {
		return this.audienceWindow !== null && !this.audienceWindow.closed;
	}

	syncSlideToAudience(slideIndex: number): void {
		if (!this.sessionId) {
			return;
		}
		const message: PresenterSlideChangeMessage = {
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-slide-change',
			slideIndex,
			sessionId: this.sessionId,
		};
		try {
			this.getChannel().postMessage(message);
		} catch {
			// BroadcastChannel may already be closed.
		}
	}

	closeAudienceWindow(): void {
		if (this.sessionId) {
			const exitMessage: PresenterExitMessage = {
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-exit',
				sessionId: this.sessionId,
			};
			try {
				this.getChannel().postMessage(exitMessage);
			} catch {
				// Ignore.
			}
		}
		const win = this.audienceWindow;
		if (win && !win.closed) {
			try {
				win.close();
			} catch {
				// Ignore.
			}
		}
		this.audienceWindow = null;
		this.sessionId = '';
	}

	openAudienceWindow(
		mockWin: MockWindow | null,
		currentSlideIndex: number,
		sessionId: string,
	): boolean {
		if (this.isAudienceWindowOpen()) {
			this.closeAudienceWindow();
		}
		if (!mockWin) {
			return false;
		}
		this.audienceWindow = mockWin;
		this.sessionId = sessionId;
		this.syncSlideToAudience(currentSlideIndex);
		return true;
	}
}

describe('presenterChannelManager', () => {
	let manager: PresenterChannelManager;
	let mockWin: MockWindow;

	beforeEach(() => {
		manager = new PresenterChannelManager();
		mockWin = createMockWindow();
	});

	afterEach(() => {
		manager.closeAudienceWindow();
	});

	// -- isAudienceWindowOpen ---------------------------------------------------

	it('reports window not open when no window has been opened', () => {
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	it('reports window open after successful open', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		expect(manager.isAudienceWindowOpen()).toBeTruthy();
	});

	it('reports window not open after close', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.closeAudienceWindow();
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	it('reports window not open when external close (win.closed = true)', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		mockWin.closed = true;
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	// -- openAudienceWindow -------------------------------------------------------

	it('returns false when window.open returns null', () => {
		const result = manager.openAudienceWindow(null, 0, TEST_SESSION_ID);
		expect(result).toBeFalsy();
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	it('returns true on successful open', () => {
		const result = manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		expect(result).toBeTruthy();
	});

	it('sends the initial slide index over the channel on open, with no target-origin argument', () => {
		manager.openAudienceWindow(mockWin, 5, TEST_SESSION_ID);

		expect(manager.channel?.postMessage).toHaveBeenCalledWith({
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-slide-change',
			slideIndex: 5,
			sessionId: TEST_SESSION_ID,
		});
		// BroadcastChannel.postMessage has no targetOrigin parameter: a single
		// argument is the whole contract, unlike window.postMessage(msg, '*').
		expect(manager.channel?.postMessage.mock.calls[0]).toHaveLength(1);
	});

	it('closes the existing session (posting exit) before opening a new one, reusing the same channel', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		expect(manager.isAudienceWindowOpen()).toBeTruthy();
		const firstChannel = manager.channel;

		const secondWin = createMockWindow();
		const secondSessionId = '00000000-0000-0000-0000-000000000002';
		manager.openAudienceWindow(secondWin, 1, secondSessionId);

		// The prior session's exit message was posted before the new session
		// started, and the same BroadcastChannel instance is reused (matches
		// the hook's channelRef, which persists for the component lifetime).
		expect(firstChannel?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'presenter-exit', sessionId: TEST_SESSION_ID }),
		);
		expect(manager.channel).toBe(firstChannel);
		expect(mockWin.close).toHaveBeenCalledOnce();

		// The new session's slide-change message carries the new sessionId.
		expect(manager.channel?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'presenter-slide-change', sessionId: secondSessionId }),
		);
		expect(manager.isAudienceWindowOpen()).toBeTruthy();
	});

	// -- syncSlideToAudience -------------------------------------------------------

	it('sends a slide-change message to the channel', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.channel?.postMessage.mockClear();

		manager.syncSlideToAudience(3);

		expect(manager.channel?.postMessage).toHaveBeenCalledWith({
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-slide-change',
			slideIndex: 3,
			sessionId: TEST_SESSION_ID,
		});
	});

	it('does nothing when no session has been started', () => {
		// Should not throw, and no channel should even be created.
		manager.syncSlideToAudience(5);
		expect(manager.channel).toBeNull();
	});

	it('still posts via the channel even if the window was closed externally, since delivery is channel-scoped, not window-scoped', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		mockWin.closed = true;
		manager.channel?.postMessage.mockClear();

		manager.syncSlideToAudience(5);
		expect(manager.channel?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ slideIndex: 5 }),
		);
	});

	it('syncs slide index 0 correctly', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.channel?.postMessage.mockClear();

		manager.syncSlideToAudience(0);

		expect(manager.channel?.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ slideIndex: 0 }),
		);
	});

	// -- closeAudienceWindow -------------------------------------------------------

	it('sends an exit message over the channel before closing', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.channel?.postMessage.mockClear();

		manager.closeAudienceWindow();

		expect(manager.channel?.postMessage).toHaveBeenCalledWith({
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-exit',
			sessionId: TEST_SESSION_ID,
		});
	});

	it('calls win.close()', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.closeAudienceWindow();
		expect(mockWin.close).toHaveBeenCalledOnce();
	});

	it('is idempotent: calling close twice does not throw', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.closeAudienceWindow();
		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	it('handles the window already being closed externally', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		mockWin.closed = true;

		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	it('handles channel.postMessage throwing on close', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.channel?.postMessage.mockImplementation(() => {
			throw new Error('Channel already closed');
		});

		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	it('handles win.close() throwing', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		mockWin.close.mockImplementation(() => {
			throw new Error('Permission denied');
		});

		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	// -- Message protocol / session-scoping validation -----------------------------

	it('slide-change messages include the correct origin tag and validate as a presenter message', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.channel?.postMessage.mockClear();

		manager.syncSlideToAudience(7);

		const sentMessage = manager.channel?.postMessage.mock.calls[0]?.[0] as PresenterMessage;
		expect(sentMessage.origin).toBe(PRESENTER_MSG_ORIGIN);
		expect(isPresenterMessage(sentMessage)).toBeTruthy();
	});

	it('exit messages include the correct origin tag and validate as a presenter message', () => {
		manager.openAudienceWindow(mockWin, 0, TEST_SESSION_ID);
		manager.channel?.postMessage.mockClear();

		manager.closeAudienceWindow();

		const sentMessage = manager.channel?.postMessage.mock.calls[0]?.[0] as PresenterMessage;
		expect(sentMessage.origin).toBe(PRESENTER_MSG_ORIGIN);
		expect(isPresenterMessage(sentMessage)).toBeTruthy();
	});

	it('stamps a distinct sessionId per session, so a stale/rejoining audience tab can reject cross-talk', () => {
		const managerA = new PresenterChannelManager();
		const managerB = new PresenterChannelManager();
		const sessionA = '00000000-0000-0000-0000-0000000000aa';
		const sessionB = '00000000-0000-0000-0000-0000000000bb';

		managerA.openAudienceWindow(createMockWindow(), 0, sessionA);
		managerB.openAudienceWindow(createMockWindow(), 0, sessionB);

		const messageA = managerA.channel?.postMessage.mock.calls[0]?.[0] as PresenterMessage;
		const messageB = managerB.channel?.postMessage.mock.calls[0]?.[0] as PresenterMessage;
		expect(messageA.sessionId).toBe(sessionA);
		expect(messageB.sessionId).toBe(sessionB);
		expect(messageA.sessionId).not.toBe(messageB.sessionId);

		managerA.closeAudienceWindow();
		managerB.closeAudienceWindow();
	});
});
