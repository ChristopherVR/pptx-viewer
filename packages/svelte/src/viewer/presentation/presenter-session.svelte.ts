import {
	buildPresentationAudienceUrl,
	clearPresentationDeck,
	createInitialPresentationSnapshot,
	createPresentationSessionId,
	isPresentationSessionMessage,
	parsePresentationSessionId,
	placeAudienceWindow,
	PRESENTATION_CHANNEL_NAME,
	PRESENTATION_MESSAGE_ORIGIN,
	resolveAudienceScreenPlacement,
	storePresentationDeck,
	mergePresentationSnapshot,
} from 'pptx-viewer-shared';
import type { PresentationSnapshot } from 'pptx-viewer-shared';

export interface PresenterSessionOptions {
	getSource: () => Uint8Array | ArrayBuffer | null | undefined;
	getSlideIndex: () => number;
	onAudienceSlide: (index: number) => void;
	onAudienceExit: () => void;
}

export class PresenterSession {
	audienceOpen = $state(false);
	snapshot = $state(createInitialPresentationSnapshot(0));
	readonly audienceSessionId =
		typeof window === 'undefined' ? null : parsePresentationSessionId(window.location.hash);
	readonly isAudience = this.audienceSessionId !== null;
	private channel: BroadcastChannel | null = null;
	private audienceWindow: Window | null = null;
	private presenterSessionId = '';
	private sequence = 0;

	constructor(private readonly options: PresenterSessionOptions) {}

	connect(): void {
		const channel = this.getChannel();
		if (!channel) {
			return;
		}
		channel.onmessage = (event: MessageEvent) => {
			const message = event.data;
			if (!isPresentationSessionMessage(message)) {
				return;
			}
			if (this.isAudience && message.sessionId === this.audienceSessionId) {
				if (message.type === 'presenter-state') {
					this.snapshot = message.snapshot;
					this.options.onAudienceSlide(message.snapshot.slideIndex);
				} else if (message.type === 'presenter-slide-change') {
					this.options.onAudienceSlide(message.slideIndex);
				} else if (message.type === 'presenter-exit') {
					// The host decides what an ended session looks like (close the tab,
					// else show the end screen). It must never land in the editor.
					this.options.onAudienceExit();
				}
			} else if (
				message.type === 'audience-ready' &&
				message.sessionId === this.presenterSessionId
			) {
				this.sync();
			}
		};
		if (this.audienceSessionId) {
			channel.postMessage({
				origin: PRESENTATION_MESSAGE_ORIGIN,
				type: 'audience-ready',
				sessionId: this.audienceSessionId,
			});
		}
	}

	openAudience(): boolean {
		this.closeAudience();
		const popup = window.open(
			'about:blank',
			'pptx-viewer-audience',
			'popup=yes,width=1280,height=720',
		);
		const source = this.options.getSource();
		if (!popup || !source) {
			return false;
		}
		this.audienceWindow = popup;
		this.audienceOpen = true;
		this.presenterSessionId = createPresentationSessionId();
		const url = buildPresentationAudienceUrl(window.location.href, this.presenterSessionId);
		void resolveAudienceScreenPlacement(window).then((placement) => {
			if (placement && this.audienceWindow === popup && !popup.closed) {
				placeAudienceWindow(popup, placement);
			}
			return undefined;
		});
		void storePresentationDeck(this.presenterSessionId, source)
			.then(() => popup.location.replace(url))
			.catch(() => this.closeAudience());
		return true;
	}

	sync(slideIndex = this.options.getSlideIndex()): void {
		if (!this.presenterSessionId) {
			return;
		}
		this.getChannel()?.postMessage({
			origin: PRESENTATION_MESSAGE_ORIGIN,
			type: 'presenter-state',
			sessionId: this.presenterSessionId,
			snapshot: { ...this.snapshot, slideIndex, sequence: ++this.sequence },
		});
	}

	updateSnapshot(patch: Partial<PresentationSnapshot>): void {
		this.snapshot = mergePresentationSnapshot(this.snapshot, patch);
		this.sync(this.snapshot.slideIndex);
	}

	closeAudience(): void {
		const sessionId = this.presenterSessionId;
		if (sessionId) {
			this.getChannel()?.postMessage({
				origin: PRESENTATION_MESSAGE_ORIGIN,
				type: 'presenter-exit',
				sessionId,
			});
			void clearPresentationDeck(sessionId);
		}
		try {
			this.audienceWindow?.close();
		} catch {
			/* ignore */
		}
		this.audienceWindow = null;
		this.audienceOpen = false;
		this.presenterSessionId = '';
	}

	dispose(): void {
		if (!this.isAudience) {
			this.closeAudience();
		}
		this.channel?.close();
		this.channel = null;
	}

	private getChannel(): BroadcastChannel | null {
		try {
			this.channel ??= new BroadcastChannel(PRESENTATION_CHANNEL_NAME);
			return this.channel;
		} catch {
			return null;
		}
	}
}
