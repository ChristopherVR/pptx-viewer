import {
	buildPresentationAudienceUrl,
	createPresentationSessionId,
	isPresentationSessionMessage,
	parsePresentationSessionId,
	placeAudienceWindow,
	PRESENTATION_CHANNEL_NAME,
	PRESENTATION_MESSAGE_ORIGIN,
	resolveAudienceScreenPlacement,
} from 'pptx-viewer-shared';
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

	function sendSlide(index = options.currentSlideIndex.value): void {
		if (!sessionId.value) {
			return;
		}
		getChannel()?.postMessage({
			origin: PRESENTATION_MESSAGE_ORIGIN,
			type: 'presenter-state',
			sessionId: sessionId.value,
			snapshot: {
				slideIndex: index,
				buildStep: 0,
				sequence: ++sequence,
				blackout: 'none',
				paused: false,
				elapsedMs: 0,
			},
		});
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

	watch(options.currentSlideIndex, (index) => {
		if (audienceOpen.value) {
			sendSlide(index);
		}
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
					options.onAudienceSlide(message.snapshot.slideIndex);
				} else if (message.type === 'presenter-slide-change') {
					options.onAudienceSlide(message.slideIndex);
				} else if (message.type === 'presenter-exit') {
					options.onAudienceExit();
					window.close();
				}
			} else if (message.type === 'audience-ready' && message.sessionId === sessionId.value) {
				sendSlide();
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

	return { isAudience, audienceOpen, openAudience, closeAudience };
}
