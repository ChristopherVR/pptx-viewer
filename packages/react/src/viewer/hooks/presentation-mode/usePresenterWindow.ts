/**
 * usePresenterWindow — Manages a secondary browser tab for audience display.
 *
 * Opens the same app URL in a new tab with a `#pptx-audience` hash. The
 * audience tab loads the full viewer (same presentation file) and auto-enters
 * fullscreen presentation mode. Slide sync uses BroadcastChannel so both
 * tabs stay in lock-step without needing window references for postMessage.
 *
 * BroadcastChannel protocol:
 * - Presenter → Audience: `{ type: "slide-change", slideIndex: number }`
 * - Presenter → Audience: `{ type: "exit" }`
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

// ---------------------------------------------------------------------------
// Channel message types
// ---------------------------------------------------------------------------

export interface PresenterSlideChangeMessage {
	origin: typeof PRESENTER_MSG_ORIGIN;
	type: 'presenter-slide-change';
	slideIndex: number;
}

export interface PresenterExitMessage {
	origin: typeof PRESENTER_MSG_ORIGIN;
	type: 'presenter-exit';
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
		(msg.type === 'presenter-slide-change' || msg.type === 'presenter-exit')
	);
}

/** Returns true if the current page was opened as an audience tab. */
export function isAudienceTab(): boolean {
	return window.location.hash === AUDIENCE_HASH;
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
			const msg: PresenterSlideChangeMessage = {
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-slide-change',
				slideIndex,
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
		try {
			const exitMsg: PresenterExitMessage = {
				origin: PRESENTER_MSG_ORIGIN,
				type: 'presenter-exit',
			};
			getChannel().postMessage(exitMsg);
		} catch {
			// Ignore
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

		// Store the PPTX content in IndexedDB so the audience tab can load it.
		// This is fire-and-forget — we open the tab immediately and the audience
		// tab waits briefly before loading, giving IndexedDB time to finish.
		if (content) {
			void storeAudienceContent(content);
		}

		// Open the same app URL in a new tab with the audience hash.
		// The audience tab loads the full viewer with the same presentation
		// and auto-enters fullscreen presentation mode.
		const url = new URL(window.location.href);
		url.hash = AUDIENCE_HASH;
		const win = window.open(url.toString(), '_blank');
		if (!win) {
			return false;
		}

		audienceWindowRef.current = win;

		// Send the current slide index after a short delay so the audience
		// tab has time to initialise.
		window.setTimeout(() => syncSlideToAudience(currentSlideIndex), 1500);

		// Poll for tab close to clean up refs
		pollTimerRef.current = setInterval(() => {
			if (win.closed) {
				audienceWindowRef.current = null;
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

	return {
		openAudienceWindow,
		closeAudienceWindow,
		isAudienceWindowOpen,
		syncSlideToAudience,
	};
}
