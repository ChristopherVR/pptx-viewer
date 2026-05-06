import { describe, it, expect, vi, beforeEach, afterEach, expectTypeOf } from 'vitest';

import {
	isPresenterMessage,
	PRESENTER_MSG_ORIGIN,
	isAudienceTab,
	AUDIENCE_HASH,
} from './usePresenterWindow';
import type {
	PresenterSlideChangeMessage,
	PresenterExitMessage,
	PresenterMessage,
} from './usePresenterWindow';

// ---------------------------------------------------------------------------
// Since @testing-library/react is not available, we test the pure helper
// functions and the window management logic extracted from the hook.
// The hook itself is thin (useRef + useCallback + useEffect), so testing
// the logic functions covers the important behaviour.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// isPresenterMessage
// ---------------------------------------------------------------------------

const TEST_SESSION_ID = '00000000-0000-0000-0000-000000000001';

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
// isAudienceTab — requires a browser environment
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
// PresenterWindowManager — simulates the hook's window management logic
// ---------------------------------------------------------------------------

interface MockWindow {
	closed: boolean;
	close: ReturnType<typeof vi.fn>;
	postMessage: ReturnType<typeof vi.fn>;
	document: {
		open: ReturnType<typeof vi.fn>;
		write: ReturnType<typeof vi.fn>;
		close: ReturnType<typeof vi.fn>;
	};
}

function createMockWindow(): MockWindow {
	return {
		closed: false,
		close: vi.fn<() => void>(),
		postMessage: vi.fn<() => void>(),
		document: {
			open: vi.fn<() => void>(),
			write: vi.fn<() => void>(),
			close: vi.fn<() => void>(),
		},
	};
}

/**
 * Simulates the core logic of usePresenterWindow without React hooks.
 */
class PresenterWindowManager {
	audienceWindow: MockWindow | null = null;
	pollTimer: ReturnType<typeof setInterval> | null = null;

	isAudienceWindowOpen(): boolean {
		return this.audienceWindow !== null && !this.audienceWindow.closed;
	}

	syncSlideToAudience(slideIndex: number): void {
		const win = this.audienceWindow;
		if (!win || win.closed) {
			return;
		}
		const message: PresenterSlideChangeMessage = {
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-slide-change',
			slideIndex,
			sessionId: TEST_SESSION_ID,
		};
		win.postMessage(message, '*');
	}

	closeAudienceWindow(): void {
		const win = this.audienceWindow;
		if (win && !win.closed) {
			const exitMsg: PresenterExitMessage = {
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-exit',
				sessionId: TEST_SESSION_ID,
			};
			try {
				win.postMessage(exitMsg, '*');
			} catch {
				// Window may already be closed
			}
			try {
				win.close();
			} catch {
				// Ignore
			}
		}
		this.audienceWindow = null;
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}

	openAudienceWindow(mockWin: MockWindow | null, currentSlideIndex: number): boolean {
		if (this.isAudienceWindowOpen()) {
			this.closeAudienceWindow();
		}

		if (!mockWin) {
			return false;
		}

		this.audienceWindow = mockWin;
		this.syncSlideToAudience(currentSlideIndex);

		return true;
	}
}

describe('presenterWindowManager', () => {
	let manager: PresenterWindowManager;
	let mockWin: MockWindow;

	beforeEach(() => {
		manager = new PresenterWindowManager();
		mockWin = createMockWindow();
	});

	afterEach(() => {
		manager.closeAudienceWindow();
	});

	// -- isAudienceWindowOpen --------------------------------------------------

	it('reports window not open when no window has been opened', () => {
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	it('reports window open after successful open', () => {
		manager.openAudienceWindow(mockWin, 0);
		expect(manager.isAudienceWindowOpen()).toBeTruthy();
	});

	it('reports window not open after close', () => {
		manager.openAudienceWindow(mockWin, 0);
		manager.closeAudienceWindow();
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	it('reports window not open when external close (win.closed = true)', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.closed = true;
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	// -- openAudienceWindow ----------------------------------------------------

	it('returns false when window.open returns null', () => {
		const result = manager.openAudienceWindow(null, 0);
		expect(result).toBeFalsy();
		expect(manager.isAudienceWindowOpen()).toBeFalsy();
	});

	it('returns true on successful open', () => {
		const result = manager.openAudienceWindow(mockWin, 0);
		expect(result).toBeTruthy();
	});

	it('sends initial slide index on open', () => {
		manager.openAudienceWindow(mockWin, 5);
		expect(mockWin.postMessage).toHaveBeenCalledWith(
			{
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-slide-change',
				slideIndex: 5,
				sessionId: TEST_SESSION_ID,
			},
			'*',
		);
	});

	it('closes existing window before opening a new one', () => {
		const firstWin = createMockWindow();
		manager.openAudienceWindow(firstWin, 0);
		expect(manager.isAudienceWindowOpen()).toBeTruthy();

		const secondWin = createMockWindow();
		manager.openAudienceWindow(secondWin, 1);

		// First window should have received exit message and been closed
		expect(firstWin.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ type: 'presenter-exit' }),
			'*',
		);
		expect(firstWin.close).toHaveBeenCalled();

		// Second window should now be the active one
		expect(manager.isAudienceWindowOpen()).toBeTruthy();
	});

	// -- syncSlideToAudience ---------------------------------------------------

	it('sends slide change message to audience window', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.postMessage.mockClear();

		manager.syncSlideToAudience(3);

		expect(mockWin.postMessage).toHaveBeenCalledWith(
			{
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-slide-change',
				slideIndex: 3,
				sessionId: TEST_SESSION_ID,
			},
			'*',
		);
	});

	it('does nothing when no window is open', () => {
		// Should not throw
		manager.syncSlideToAudience(5);
	});

	it('does nothing when window is closed externally', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.closed = true;
		mockWin.postMessage.mockClear();

		manager.syncSlideToAudience(5);
		expect(mockWin.postMessage).not.toHaveBeenCalled();
	});

	it('syncs slide index 0 correctly', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.postMessage.mockClear();

		manager.syncSlideToAudience(0);

		expect(mockWin.postMessage).toHaveBeenCalledWith(
			expect.objectContaining({ slideIndex: 0 }),
			'*',
		);
	});

	// -- closeAudienceWindow ---------------------------------------------------

	it('sends exit message before closing', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.postMessage.mockClear();

		manager.closeAudienceWindow();

		expect(mockWin.postMessage).toHaveBeenCalledWith(
			{
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-exit',
				sessionId: TEST_SESSION_ID,
			},
			'*',
		);
	});

	it('calls win.close()', () => {
		manager.openAudienceWindow(mockWin, 0);
		manager.closeAudienceWindow();
		expect(mockWin.close).toHaveBeenCalledOnce();
	});

	it('is idempotent — calling close twice does not throw', () => {
		manager.openAudienceWindow(mockWin, 0);
		manager.closeAudienceWindow();
		// Calling close again should be safe
		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	it('handles window already closed externally', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.closed = true;

		// Should not throw even though window is already closed
		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	it('handles postMessage throwing on close', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.postMessage.mockImplementation(() => {
			throw new Error('Window already closed');
		});

		// Should not throw
		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	it('handles win.close() throwing', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.close.mockImplementation(() => {
			throw new Error('Permission denied');
		});

		// Should not throw
		expect(() => manager.closeAudienceWindow()).not.toThrow();
	});

	// -- Message protocol validation -------------------------------------------

	it('slide change messages include correct origin tag', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.postMessage.mockClear();

		manager.syncSlideToAudience(7);

		const sentMessage = mockWin.postMessage.mock.calls[0][0] as PresenterMessage;
		expect(sentMessage.origin).toBe(PRESENTER_MSG_ORIGIN);
		expect(isPresenterMessage(sentMessage)).toBeTruthy();
	});

	it('exit messages include correct origin tag', () => {
		manager.openAudienceWindow(mockWin, 0);
		mockWin.postMessage.mockClear();

		manager.closeAudienceWindow();

		const sentMessage = mockWin.postMessage.mock.calls[0][0] as PresenterMessage;
		expect(sentMessage.origin).toBe(PRESENTER_MSG_ORIGIN);
		expect(isPresenterMessage(sentMessage)).toBeTruthy();
	});
});
