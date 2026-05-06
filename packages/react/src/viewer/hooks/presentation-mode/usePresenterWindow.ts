/**
 * usePresenterWindow — Manages a secondary browser tab for audience display.
 *
 * Opens the same app URL in a new tab with a `#pptx-audience` hash. The
 * audience tab loads the full viewer (same presentation file) and auto-enters
 * fullscreen presentation mode. Slide sync uses BroadcastChannel so both
 * tabs stay in lock-step without needing window references for postMessage.
 *
 * BroadcastChannel protocol:
 * - Presenter → Audience: `{ type: "slide-change", slideIndex: number, sessionId }`
 * - Presenter → Audience: `{ type: "exit", sessionId }`
 *
 * Each presenter session generates a UUID nonce shared via the audience URL
 * hash. The audience tab parses the nonce and rejects any message with a
 * different `sessionId`, preventing cross-talk between concurrent sessions.
 */
import { useRef, useCallback, useEffect } from 'react';

import { storeAudienceContent, clearAudienceContent } from './audience-content-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** BroadcastChannel name shared between presenter and audience tabs. */
export const PRESENTER_CHANNEL_NAME = 'pptx-viewer-presenter';

/** Hash fragment used to identify the audience tab. */
export const AUDIENCE_HASH = '#pptx-audience';

/** Unique origin identifier so we only react to our own messages. */
export const PRESENTER_MSG_ORIGIN = 'pptx-viewer-presenter';

/** Hash key used to pass the session nonce to the audience tab. */
export const AUDIENCE_NONCE_KEY = 'nonce';

/** Generate a per-presenter session UUID. Falls back to Math.random where crypto is missing. */
function generateSessionId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parse the session nonce from the current page URL hash. Returns null if the
 * hash is not in the expected `#pptx-audience&nonce=<uuid>` form.
 */
export function parseAudienceNonce(): string | null {
	const hash = window.location.hash;
	if (!hash.startsWith(AUDIENCE_HASH)) {
		return null;
	}
	const trailing = hash.slice(AUDIENCE_HASH.length);
	if (!trailing) {
		return null;
	}
	// Strip leading separator (& or ;) then parse as URLSearchParams.
	const params = new URLSearchParams(trailing.replace(/^[&;?]/, ''));
	return params.get(AUDIENCE_NONCE_KEY);
}

// ---------------------------------------------------------------------------
// Channel message types
// ---------------------------------------------------------------------------

export interface PresenterSlideChangeMessage {
	origin: typeof PRESENTER_MSG_ORIGIN;
	type: 'presenter-slide-change';
	slideIndex: number;
	sessionId: string;
}

export interface PresenterExitMessage {
	origin: typeof PRESENTER_MSG_ORIGIN;
	type: 'presenter-exit';
	sessionId: string;
}

export type PresenterMessage = PresenterSlideChangeMessage | PresenterExitMessage;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isPresenterMessage(data: unknown): data is PresenterMessage {
	if (typeof data !== 'object' || data === null) {
		return false;
	}
	const msg = data as Record<string, unknown>;
	return (
		msg.origin === PRESENTER_MSG_ORIGIN &&
		typeof msg.sessionId === 'string' &&
		(msg.type === 'presenter-slide-change' || msg.type === 'presenter-exit')
	);
}

/** Returns true if the current page was opened as an audience tab. */
export function isAudienceTab(): boolean {
	return window.location.hash.startsWith(AUDIENCE_HASH);
}

// ---------------------------------------------------------------------------
// Input / output
// ---------------------------------------------------------------------------

export interface UsePresenterWindowInput {
	currentSlideIndex: number;
	isPresenterMode: boolean;
	/** Raw PPTX bytes to share with the audience tab via IndexedDB. */
	content?: ArrayBuffer | Uint8Array | null;
}

export interface UsePresenterWindowResult {
	openAudienceWindow: () => boolean;
	closeAudienceWindow: () => void;
	isAudienceWindowOpen: () => boolean;
	syncSlideToAudience: (slideIndex: number) => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePresenterWindow(input: UsePresenterWindowInput): UsePresenterWindowResult {
	const { currentSlideIndex, isPresenterMode, content } = input;
	const audienceWindowRef = useRef<Window | null>(null);
	const channelRef = useRef<BroadcastChannel | null>(null);
	const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	/** Per-session UUID. Regenerated each time openAudienceWindow is invoked. */
	const sessionIdRef = useRef<string>('');

	// -- Helpers ---------------------------------------------------------------

	const getChannel = useCallback((): BroadcastChannel => {
		if (!channelRef.current) {
			channelRef.current = new BroadcastChannel(PRESENTER_CHANNEL_NAME);
		}
		return channelRef.current;
	}, []);

	const isAudienceWindowOpen = useCallback((): boolean => {
		return audienceWindowRef.current !== null && !audienceWindowRef.current.closed;
	}, []);

	const syncSlideToAudience = useCallback(
		(slideIndex: number) => {
			if (!sessionIdRef.current) {
				return;
			}
			const msg: PresenterSlideChangeMessage = {
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-slide-change',
				slideIndex,
				sessionId: sessionIdRef.current,
			};
			try {
				getChannel().postMessage(msg);
			} catch {
				// BroadcastChannel may be closed
			}
		},
		[getChannel],
	);

	const closeAudienceWindow = useCallback(() => {
		// Send exit signal via BroadcastChannel
		if (sessionIdRef.current) {
			try {
				const exitMsg: PresenterExitMessage = {
					origin: PRESENTER_MSG_ORIGIN,
					type: 'presenter-exit',
					sessionId: sessionIdRef.current,
				};
				getChannel().postMessage(exitMsg);
			} catch {
				// Ignore
			}
		}

		const win = audienceWindowRef.current;
		if (win && !win.closed) {
			try {
				win.close();
			} catch {
				// Ignore
			}
		}
		audienceWindowRef.current = null;
		sessionIdRef.current = '';
		if (pollTimerRef.current !== null) {
			clearInterval(pollTimerRef.current);
			pollTimerRef.current = null;
		}

		// Clean up shared content from IndexedDB
		void clearAudienceContent();
	}, [getChannel]);

	const openAudienceWindow = useCallback((): boolean => {
		if (isAudienceWindowOpen()) {
			closeAudienceWindow();
		}

		// Step 1: open about:blank synchronously inside the user gesture so
		// popup blockers don't fire. The blank tab acts as a placeholder while
		// we asynchronously persist the PPTX bytes.
		const blankWin = window.open('about:blank', '_blank');
		if (!blankWin) {
			return false;
		}
		audienceWindowRef.current = blankWin;

		// Generate a per-session nonce so audience tabs from other sessions
		// (or stale tabs) ignore our messages.
		const sessionId = generateSessionId();
		sessionIdRef.current = sessionId;

		const audienceUrl = new URL(window.location.href);
		const params = new URLSearchParams();
		params.set(AUDIENCE_NONCE_KEY, sessionId);
		audienceUrl.hash = `${AUDIENCE_HASH}&${params.toString()}`;

		// Step 2: persist content (if any), then navigate the placeholder tab.
		// If persistence fails, close the placeholder so we don't leave the user
		// staring at about:blank.
		const navigateOrClose = (ok: boolean): void => {
			const win = audienceWindowRef.current;
			if (!win || win.closed) {
				return;
			}
			if (!ok) {
				try {
					win.close();
				} catch {
					// Ignore
				}
				audienceWindowRef.current = null;
				sessionIdRef.current = '';
				return;
			}
			try {
				win.location.replace(audienceUrl.toString());
			} catch {
				// If navigation fails (cross-origin etc.), close to clean up.
				try {
					win.close();
				} catch {
					// Ignore
				}
				audienceWindowRef.current = null;
				sessionIdRef.current = '';
			}
		};

		if (content) {
			void storeAudienceContent(content)
				.then(() => navigateOrClose(true))
				.catch(() => navigateOrClose(false));
		} else {
			navigateOrClose(true);
		}

		// Send the current slide index after a short delay so the audience
		// tab has time to initialise.
		window.setTimeout(() => syncSlideToAudience(currentSlideIndex), 1500);

		// Poll for tab close to clean up refs
		pollTimerRef.current = setInterval(() => {
			const win = audienceWindowRef.current;
			if (!win || win.closed) {
				audienceWindowRef.current = null;
				sessionIdRef.current = '';
				if (pollTimerRef.current !== null) {
					clearInterval(pollTimerRef.current);
					pollTimerRef.current = null;
				}
			}
		}, 1000);

		return true;
	}, [isAudienceWindowOpen, closeAudienceWindow, syncSlideToAudience, currentSlideIndex, content]);

	// -- Sync slide changes to audience tab ------------------------------------

	useEffect(() => {
		if (isPresenterMode && isAudienceWindowOpen()) {
			syncSlideToAudience(currentSlideIndex);
		}
	}, [currentSlideIndex, isPresenterMode, isAudienceWindowOpen, syncSlideToAudience]);

	// -- Cleanup on unmount or when leaving presenter mode ----------------------

	useEffect(() => {
		return () => {
			closeAudienceWindow();
			try {
				channelRef.current?.close();
			} catch {
				// Ignore
			}
		};
	}, [closeAudienceWindow]);

	useEffect(() => {
		if (!isPresenterMode) {
			closeAudienceWindow();
		}
	}, [isPresenterMode, closeAudienceWindow]);

	// Ensure stored audience bytes do not persist across presenter tab unloads.
	useEffect(() => {
		const handleBeforeUnload = (): void => {
			void clearAudienceContent();
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, []);

	return {
		openAudienceWindow,
		closeAudienceWindow,
		isAudienceWindowOpen,
		syncSlideToAudience,
	};
}
