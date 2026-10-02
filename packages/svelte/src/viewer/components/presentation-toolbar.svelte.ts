/**
 * Non-view state for the slide-show toolbar: auto-hide visibility and the show's
 * start instant. (The colour palettes and the elapsed readout belong to the
 * shared `pptx-ui-present-toolbar`.)
 *
 * It lives beside `PresentationToolbar.svelte` because this is the part worth
 * unit testing on its own: timers and document listeners, with no markup.
 *
 * The timings and the trigger zone come from `pptx-viewer-shared` so this
 * binding cannot drift from React's toolbar the way the old bottom-right
 * annotation strip had.
 */
import { AUTO_HIDE_DELAY_MS, isInBottomTriggerZone } from 'pptx-viewer-shared';

/** DOM getters {@link PresentToolbarChrome.attach} needs from the component. */
export interface PresentToolbarChromeTargets {
	/**
	 * The positioned show surface the bar floats over. Used only for the
	 * bottom-trigger-zone fast path; a missing container still shows the bar on
	 * any movement, exactly as React's wrapper does.
	 */
	getContainer: () => HTMLElement | null;
	/**
	 * File > Options > Advanced > "Show popup toolbar" (default true). When it
	 * returns `false`, `mousemove` never auto-reveals the bar; `toggleVisible`
	 * (PowerPoint's Ctrl+H) still works. Read fresh on every `mousemove`.
	 */
	popupToolbarEnabled?: () => boolean;
}

export class PresentToolbarChrome {
	/** Whether the bar is currently faded in and accepting pointer events. */
	visible = $state(false);
	/** Epoch ms the show started; the shared element ticks the elapsed readout from it. */
	startedAt = $state(Date.now());

	#hideTimer: number | null = null;
	#hovering = false;

	/**
	 * Wire the document listeners and the one-second tick. Returns a teardown,
	 * so a component can hand it straight to `$effect`.
	 */
	attach(targets: PresentToolbarChromeTargets): () => void {
		// The toolbar is only ever mounted while the show runs, so attach time IS the
		// show start; there is no separate timestamp on the viewer state to read
		// (`presenterStartedAt` belongs to presenter view, which can be entered long
		// after the show began).
		this.startedAt = Date.now();

		const onMouseMove = (event: MouseEvent): void => {
			if (targets.popupToolbarEnabled?.() === false) {
				return;
			}
			const container = targets.getContainer();
			if (container) {
				const rect = container.getBoundingClientRect();
				if (isInBottomTriggerZone(event.clientY, rect.height, rect.top)) {
					this.#show();
					return;
				}
			}
			// Any movement at all reveals the bar; the bottom zone is only a
			// short-circuit, which is what keeps this identical to React.
			this.#show();
		};

		document.addEventListener('mousemove', onMouseMove);
		return () => {
			document.removeEventListener('mousemove', onMouseMove);
			this.#clearHideTimer();
		};
	}

	/** Pointer entered the bar: pin it open until the pointer leaves again. */
	enter(): void {
		this.#hovering = true;
		this.#clearHideTimer();
		this.visible = true;
	}

	/** Pointer left the bar: restart the auto-hide countdown. */
	leave(): void {
		this.#hovering = false;
		this.#resetHideTimer();
	}

	/**
	 * PowerPoint's Ctrl+H: flip the show chrome. Deliberately the same `visible`
	 * flag auto-hide writes, and it re-arms the countdown when it reveals the bar,
	 * so the shortcut leaves the toolbar in a state the pointer can still govern.
	 */
	toggleVisible(): void {
		if (this.visible) {
			this.#clearHideTimer();
			this.visible = false;
			return;
		}
		this.#show();
	}

	#show(): void {
		this.visible = true;
		this.#resetHideTimer();
	}

	#clearHideTimer(): void {
		if (this.#hideTimer !== null) {
			window.clearTimeout(this.#hideTimer);
			this.#hideTimer = null;
		}
	}

	#resetHideTimer(): void {
		this.#clearHideTimer();
		this.#hideTimer = window.setTimeout(() => {
			if (!this.#hovering) {
				this.visible = false;
			}
		}, AUTO_HIDE_DELAY_MS);
	}
}
