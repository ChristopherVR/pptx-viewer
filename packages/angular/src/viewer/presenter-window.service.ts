/**
 * presenter-window.service.ts: Manages a secondary browser tab for audience
 * display, the Angular counterpart of React's `usePresenterWindow` hook.
 *
 * Opens the same app URL in a new tab with a `#pptx-audience` hash. The
 * audience tab loads the full viewer (same presentation file, retrieved from
 * the shared IndexedDB store) and auto-enters fullscreen presentation mode.
 * Slide sync uses BroadcastChannel so both tabs stay in lock-step.
 *
 * The channel name, message origin, nonce key, and hash are kept identical to
 * the React/Vue bindings so a presenter from any framework can drive an
 * audience tab rendered by any other.
 *
 * BroadcastChannel protocol:
 *  - Presenter -> Audience: `{ type: 'presenter-slide-change', slideIndex, sessionId }`
 *  - Presenter -> Audience: `{ type: 'presenter-exit', sessionId }`
 */

import { Injectable } from '@angular/core';

import {
	AUDIENCE_HASH,
	clearAudienceContent,
	storeAudienceContent,
} from './audience-content-store';

/** BroadcastChannel name shared between presenter and audience tabs. */
export const PRESENTER_CHANNEL_NAME = 'pptx-viewer-presenter';

/** Unique origin identifier so we only react to our own messages. */
export const PRESENTER_MSG_ORIGIN = 'pptx-viewer-presenter';

/** Hash key used to pass the session nonce to the audience tab. */
export const AUDIENCE_NONCE_KEY = 'nonce';

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

/** Type guard for messages arriving on the presenter BroadcastChannel. */
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

/** Generate a per-presenter session UUID, falling back where crypto is missing. */
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
	if (typeof window === 'undefined') {
		return null;
	}
	const hash = window.location.hash;
	if (!hash.startsWith(AUDIENCE_HASH)) {
		return null;
	}
	const trailing = hash.slice(AUDIENCE_HASH.length);
	if (!trailing) {
		return null;
	}
	const params = new URLSearchParams(trailing.replace(/^[&;?]/u, ''));
	return params.get(AUDIENCE_NONCE_KEY);
}

@Injectable({ providedIn: 'root' })
export class PresenterWindowService {
	private audienceWindow: Window | null = null;
	private channel: BroadcastChannel | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	/** Per-session UUID. Regenerated each time openAudienceWindow is invoked. */
	private sessionId = '';

	private getChannel(): BroadcastChannel {
		if (!this.channel) {
			this.channel = new BroadcastChannel(PRESENTER_CHANNEL_NAME);
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
		const msg: PresenterSlideChangeMessage = {
			origin: PRESENTER_MSG_ORIGIN,
			type: 'presenter-slide-change',
			slideIndex,
			sessionId: this.sessionId,
		};
		try {
			this.getChannel().postMessage(msg);
		} catch {
			// BroadcastChannel may be closed.
		}
	}

	closeAudienceWindow(): void {
		if (this.sessionId) {
			try {
				const exitMsg: PresenterExitMessage = {
					origin: PRESENTER_MSG_ORIGIN,
					type: 'presenter-exit',
					sessionId: this.sessionId,
				};
				this.getChannel().postMessage(exitMsg);
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
		if (this.pollTimer !== null) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
		void clearAudienceContent();
	}

	/**
	 * Open the audience tab. Persists the PPTX bytes (if any) to IndexedDB, then
	 * navigates the placeholder tab to the audience URL. Returns false when the
	 * popup is blocked.
	 */
	openAudienceWindow(content: ArrayBuffer | Uint8Array | null, currentSlideIndex: number): boolean {
		if (typeof window === 'undefined') {
			return false;
		}
		if (this.isAudienceWindowOpen()) {
			this.closeAudienceWindow();
		}

		// Open about:blank synchronously inside the user gesture so popup blockers
		// do not fire while we asynchronously persist the bytes.
		const blankWin = window.open('about:blank', '_blank');
		if (!blankWin) {
			return false;
		}
		this.audienceWindow = blankWin;
		this.sessionId = generateSessionId();

		const audienceUrl = new URL(window.location.href);
		const params = new URLSearchParams();
		params.set(AUDIENCE_NONCE_KEY, this.sessionId);
		audienceUrl.hash = `${AUDIENCE_HASH}&${params.toString()}`;

		const navigateOrClose = (ok: boolean): void => {
			const win = this.audienceWindow;
			if (!win || win.closed) {
				return;
			}
			if (!ok) {
				this.disposeWindow(win);
				return;
			}
			try {
				win.location.replace(audienceUrl.toString());
			} catch {
				this.disposeWindow(win);
			}
		};

		if (content) {
			void storeAudienceContent(content)
				.then(() => navigateOrClose(true))
				.catch(() => navigateOrClose(false));
		} else {
			navigateOrClose(true);
		}

		window.setTimeout(() => this.syncSlideToAudience(currentSlideIndex), 1500);

		this.pollTimer = setInterval(() => {
			const win = this.audienceWindow;
			if (!win || win.closed) {
				this.audienceWindow = null;
				this.sessionId = '';
				if (this.pollTimer !== null) {
					clearInterval(this.pollTimer);
					this.pollTimer = null;
				}
			}
		}, 1000);

		return true;
	}

	private disposeWindow(win: Window): void {
		try {
			win.close();
		} catch {
			// Ignore.
		}
		this.audienceWindow = null;
		this.sessionId = '';
	}
}
