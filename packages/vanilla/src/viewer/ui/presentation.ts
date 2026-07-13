export interface PresentationController {
	/** Enter presentation mode (real Fullscreen API on the target element). */
	enter(): Promise<void>;
	/** Exit presentation mode. */
	exit(): Promise<void>;
	/** True while the target is the fullscreen element. */
	isActive(): boolean;
	/** Remove listeners. */
	dispose(): void;
}

/**
 * Presentation mode over the real Fullscreen API. `onChange` fires for every
 * transition, including user-initiated exits (Esc, browser chrome), driven by
 * the `fullscreenchange` event rather than the promise result.
 *
 * In environments without the Fullscreen API (older browsers, tests) it
 * degrades to a plain state toggle so the viewer still hides its chrome.
 */
export function createPresentationController(
	target: HTMLElement,
	onChange: (presenting: boolean) => void,
): PresentationController {
	const doc = target.ownerDocument;
	const supported = typeof target.requestFullscreen === 'function';
	let fallbackActive = false;

	const isActive = () => (supported ? doc.fullscreenElement === target : fallbackActive);

	const handleChange = () => {
		onChange(isActive());
	};
	if (supported) {
		doc.addEventListener('fullscreenchange', handleChange);
	}

	return {
		async enter() {
			if (isActive()) {
				return;
			}
			if (supported) {
				try {
					await target.requestFullscreen();
					target.focus();
					return;
				} catch {
					// Fall through to the non-fullscreen fallback below.
				}
			}
			fallbackActive = true;
			onChange(true);
			target.focus();
		},
		async exit() {
			if (supported && doc.fullscreenElement === target) {
				await doc.exitFullscreen();
				return;
			}
			if (fallbackActive) {
				fallbackActive = false;
				onChange(false);
			}
		},
		isActive,
		dispose() {
			if (supported) {
				doc.removeEventListener('fullscreenchange', handleChange);
			}
		},
	};
}
