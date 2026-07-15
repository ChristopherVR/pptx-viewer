/**
 * useAudienceMode: Detects when the viewer is running as an audience tab
 * (opened by the presenter via the audience window button) and auto-enters
 * fullscreen presentation mode, syncing slides via BroadcastChannel.
 */
import { isPresentationSessionMessage, PRESENTATION_MESSAGE_ORIGIN } from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';

import type { ViewerMode } from '../../types-core';
import { clearAudienceContent } from './audience-content-store';
import {
	PRESENTER_CHANNEL_NAME,
	PRESENTER_MSG_ORIGIN,
	isAudienceTab,
	parseAudienceNonce,
} from './usePresenterWindow';

export interface UseAudienceModeInput {
	mode: ViewerMode;
	onSetMode: (mode: ViewerMode) => void;
	onSetActiveSlideIndex: (index: number) => void;
	containerRef: React.RefObject<HTMLElement | null>;
	onSnapshot?: (snapshot: PresentationSnapshot) => void;
}

/**
 * When the page was opened with the `#pptx-audience` hash, this hook:
 * 1. Auto-enters fullscreen presentation mode after content loads
 * 2. Listens on BroadcastChannel for slide-change messages from the presenter
 * 3. Exits presentation mode when the presenter sends an exit signal
 */
export function useAudienceMode(input: UseAudienceModeInput): void {
	const { mode: _mode, onSetMode, onSetActiveSlideIndex, containerRef, onSnapshot } = input;
	const initialised = useRef(false);

	// Auto-enter presentation mode when this is an audience tab
	useEffect(() => {
		if (!isAudienceTab()) {
			return;
		}
		if (initialised.current) {
			return;
		}
		initialised.current = true;

		onSetMode('present');

		// A newly navigated audience tab has no transient user activation, so an
		// automatic fullscreen request is rejected by browsers. Use the first
		// audience interaction as the activation and keep presentation mode active
		// meanwhile as a full-viewport fallback.
		const requestAudienceFullscreen = (): void => {
			const wrapper = containerRef.current;
			if (!document.fullscreenElement && wrapper?.requestFullscreen) {
				void wrapper.requestFullscreen().catch(() => undefined);
			}
		};
		document.addEventListener('pointerdown', requestAudienceFullscreen, { once: true });
		document.addEventListener('keydown', requestAudienceFullscreen, { once: true });
		return () => {
			document.removeEventListener('pointerdown', requestAudienceFullscreen);
			document.removeEventListener('keydown', requestAudienceFullscreen);
		};
	}, [containerRef, onSetMode]);

	// Listen for slide changes from the presenter tab
	useEffect(() => {
		if (!isAudienceTab()) {
			return;
		}

		// Pin the session nonce that this audience tab was opened with. We
		// reject any BroadcastChannel message whose sessionId does not match,
		// so concurrent presenter sessions cannot drive each other's audiences.
		const expectedSessionId = parseAudienceNonce();

		let channel: BroadcastChannel;
		try {
			channel = new BroadcastChannel(PRESENTER_CHANNEL_NAME);
		} catch {
			return; // BroadcastChannel not supported
		}

		channel.onmessage = (event: MessageEvent) => {
			const data = event.data;
			if (!isPresentationSessionMessage(data) || data.origin !== PRESENTER_MSG_ORIGIN) {
				return;
			}
			// If we have a session nonce, require an exact match.
			if (expectedSessionId && data.sessionId !== expectedSessionId) {
				return;
			}

			if (data.type === 'presenter-slide-change') {
				onSetActiveSlideIndex(data.slideIndex);
			}
			if (data.type === 'presenter-state') {
				onSetActiveSlideIndex(data.snapshot.slideIndex);
				onSnapshot?.(data.snapshot);
			}

			if (data.type === 'presenter-exit') {
				if (expectedSessionId) {
					void clearAudienceContent(expectedSessionId);
				}
				onSetMode('edit');
				try {
					window.close();
				} catch {
					// Can't close: user will close manually
				}
			}
		};

		if (expectedSessionId) {
			channel.postMessage({
				origin: PRESENTATION_MESSAGE_ORIGIN,
				type: 'audience-ready',
				sessionId: expectedSessionId,
			});
		}

		return () => {
			try {
				channel.close();
			} catch {
				// Ignore
			}
		};
	}, [onSetMode, onSetActiveSlideIndex, onSnapshot]);
}
