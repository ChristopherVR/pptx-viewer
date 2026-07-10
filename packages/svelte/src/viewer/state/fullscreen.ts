/**
 * Thin wrappers over the real Fullscreen API, used by the toolbar's
 * presentation button. Kept side-effect-light and safe for non-browser
 * environments (all functions no-op when the API is unavailable).
 */

/** Whether the Fullscreen API is available on this document/element. */
export function isFullscreenSupported(): boolean {
	return typeof document !== 'undefined' && typeof document.exitFullscreen === 'function';
}

/** Whether any element is currently fullscreen. */
export function isFullscreenActive(): boolean {
	return typeof document !== 'undefined' && document.fullscreenElement !== null;
}

/** Enter fullscreen on `el`, swallowing rejection (user gesture policies). */
export async function enterFullscreen(el: HTMLElement): Promise<void> {
	try {
		await el.requestFullscreen();
	} catch {
		// Denied (not a user gesture, iframe policy, ...): stay windowed.
	}
}

/** Exit fullscreen if active. */
export async function exitFullscreen(): Promise<void> {
	if (!isFullscreenActive()) {
		return;
	}
	try {
		await document.exitFullscreen();
	} catch {
		// Already exited or unsupported.
	}
}

/** Toggle fullscreen for `el`. */
export async function toggleFullscreen(el: HTMLElement): Promise<void> {
	if (isFullscreenActive()) {
		await exitFullscreen();
	} else {
		await enterFullscreen(el);
	}
}
