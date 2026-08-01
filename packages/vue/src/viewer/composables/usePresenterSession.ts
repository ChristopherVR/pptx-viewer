import {
	buildPresentationAudienceUrl,
	createPresentationSessionId,
	createInitialPresentationSnapshot,
	isPresentationSessionMessage,
	parsePresentationSessionId,
	placeAudienceWindow,
	PRESENTATION_CHANNEL_NAME,
	PRESENTATION_MESSAGE_ORIGIN,
	resolveAudienceScreenPlacement,
	mergePresentationSnapshot,
	swapPresentationWindows,
} from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Ref } from 'vue';

import { clearAudienceContent, storeAudienceContent } from './audience-content-store';

export interface PresenterSessionOptions {
	currentSlideIndex: Ref<number>;
	content: () => ArrayBuffer | Uint8Array | null;
	onAudienceSlide: (index: number) => void;
	onAudienceExit: () => void;
}

export function usePresenterSession(options: PresenterSessionOptions) {
	const sessionId = ref('');
	const audienceOpen = ref(false);
	const snapshot = ref(createInitialPresentationSnapshot(options.currentSlideIndex.value));
	const audienceSessionId =
		typeof window === 'undefined' ? null : parsePresentationSessionId(window.location.hash);
	const isAudience = audienceSessionId !== null;
	let audienceWindow: Window | null = null;
	let channel: BroadcastChannel | null = null;
	let sequence = 0;

	function getChannel(): BroadcastChannel | null {
		try {
			channel ??= new BroadcastChannel(PRESENTATION_CHANNEL_NAME);
			return channel;
		} catch {
			return null;
		}
	}

	function sendSnapshot(): void {
		if (!sessionId.value) {
			return;
		}
		getChannel()?.postMessage({
			origin: PRESENTATION_MESSAGE_ORIGIN,
			type: 'presenter-state',
			sessionId: sessionId.value,
			snapshot: { ...snapshot.value, sequence: ++sequence },
		});
	}

	function updateSnapshot(patch: Partial<PresentationSnapshot>): void {
		snapshot.value = mergePresentationSnapshot(snapshot.value, patch);
		if (audienceOpen.value) {
			sendSnapshot();
		}
	}

	function closeAudience(): void {
		const closingSession = sessionId.value;
		if (closingSession) {
			getChannel()?.postMessage({
				origin: PRESENTATION_MESSAGE_ORIGIN,
				type: 'presenter-exit',
				sessionId: closingSession,
			});
			void clearAudienceContent(closingSession);
		}
		try {
			audienceWindow?.close();
		} catch {
			/* ignore */
		}
		audienceWindow = null;
		audienceOpen.value = false;
		sessionId.value = '';
	}

	function openAudience(): boolean {
		closeAudience();
		const popup = window.open(
			'about:blank',
			'pptx-viewer-audience',
			'popup=yes,width=1280,height=720',
		);
		if (!popup) {
			return false;
		}
		audienceWindow = popup;
		audienceOpen.value = true;
		const nextSession = createPresentationSessionId();
		sessionId.value = nextSession;
		const url = buildPresentationAudienceUrl(window.location.href, nextSession);
		void resolveAudienceScreenPlacement(window).then((placement) => {
			if (placement && audienceWindow === popup && !popup.closed) {
				placeAudienceWindow(popup, placement);
			}
			return undefined;
		});
		const content = options.content();
		const stored = content ? storeAudienceContent(content, nextSession) : Promise.resolve();
		void stored.then(() => popup.location.replace(url)).catch(() => closeAudience());
		return true;
	}

	/**
	 * Move the console onto the audience screen and the deck onto the presenter's
	 * (PowerPoint's "Swap Displays"). Needs the Window Management API to know
	 * where the two screens are, so it reports `false` where that is unavailable
	 * rather than moving windows blind.
	 */
	async function swapDisplays(): Promise<boolean> {
		const target = audienceWindow;
		if (!target || target.closed) {
			return false;
		}
		return swapPresentationWindows(window, target);
	}

	watch(options.currentSlideIndex, (index) => {
		updateSnapshot({ slideIndex: index });
	});

	onMounted(() => {
		const activeChannel = getChannel();
		if (!activeChannel) {
			return;
		}
		activeChannel.onmessage = (event: MessageEvent) => {
			const message = event.data;
			if (!isPresentationSessionMessage(message)) {
				return;
			}
			if (isAudience && message.sessionId === audienceSessionId) {
				if (message.type === 'presenter-state') {
					snapshot.value = message.snapshot;
					options.onAudienceSlide(message.snapshot.slideIndex);
				} else if (message.type === 'presenter-slide-change') {
					options.onAudienceSlide(message.slideIndex);
				} else if (message.type === 'presenter-exit') {
					// The host decides what an ended session looks like (close the tab,
					// else show the end screen). It must never land in the editor.
					options.onAudienceExit();
				}
			} else if (message.type === 'audience-ready' && message.sessionId === sessionId.value) {
				sendSnapshot();
			}
		};
		if (isAudience && audienceSessionId) {
			activeChannel.postMessage({
				origin: PRESENTATION_MESSAGE_ORIGIN,
				type: 'audience-ready',
				sessionId: audienceSessionId,
			});
		}
	});

	onBeforeUnmount(() => {
		if (!isAudience) {
			closeAudience();
		}
		channel?.close();
		channel = null;
	});

	return {
		isAudience,
		audienceOpen,
		snapshot,
		updateSnapshot,
		openAudience,
		closeAudience,
		swapDisplays,
	};
}
