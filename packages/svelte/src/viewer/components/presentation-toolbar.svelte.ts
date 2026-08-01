/**
 * Non-view state for the slide-show toolbar: auto-hide visibility, the elapsed
 * clock, and which colour palette popover is open.
 *
 * It lives beside `PresentationToolbar.svelte` rather than inside it because
 * the SFC is already at its budget with sixteen controls, and because this is
 * the part worth unit testing on its own: timers and document listeners, with
 * no markup involved.
 *
 * The timings and the trigger zone come from `pptx-viewer-shared` so this
 * binding cannot drift from React's toolbar the way the old bottom-right
 * annotation strip had.
 */
import { AUTO_HIDE_DELAY_MS, isInBottomTriggerZone } from 'pptx-viewer-shared';

/** Which tool's colour palette is currently open, if any. */
export type PresentPaletteKey = 'pen' | 'highlighter';

/** DOM getters {@link PresentToolbarChrome.attach} needs from the component. */
export interface PresentToolbarChromeTargets {
	/**
	 * The positioned show surface the bar floats over. Used only for the
	 * bottom-trigger-zone fast path; a missing container still shows the bar on
	 * any movement, exactly as React's wrapper does.
	 */
	getContainer: () => HTMLElement | null;
	/** The bar itself, so a mousedown outside it can close an open palette. */
	getToolbar: () => HTMLElement | null;
}

export class PresentToolbarChrome {
	/** Whether the bar is currently faded in and accepting pointer events. */
	visible = $state(false);
	/** Milliseconds since the show started, refreshed once a second. */
	elapsedMs = $state(0);
	/** The open colour palette, or `null` when both are closed. */
	palette = $state<PresentPaletteKey | null>(null);

	#hideTimer: number | null = null;
	#hovering = false;
	/**
	 * The show's start instant. The toolbar is only ever mounted while the show
	 * runs, so construction time IS the show start; there is no separate
	 * timestamp on the viewer state to read (`presenterStartedAt` belongs to
	 * presenter view, which can be entered long after the show began).
	 */
	#startedAt = Date.now();

	/**
	 * Wire the document listeners and the one-second tick. Returns a teardown,
	 * so a component can hand it straight to `$effect`.
	 */
	attach(targets: PresentToolbarChromeTargets): () => void {
		this.#startedAt = Date.now();
		this.elapsedMs = 0;

		const onMouseMove = (event: MouseEvent): void => {
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

		const onMouseDown = (event: MouseEvent): void => {
			const toolbar = targets.getToolbar();
			if (toolbar && !toolbar.contains(event.target as Node)) {
				this.palette = null;
			}
		};

		const tick = window.setInterval(() => {
			this.elapsedMs = Date.now() - this.#startedAt;
		}, 1000);

		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mousedown', onMouseDown);
		return () => {
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mousedown', onMouseDown);
			window.clearInterval(tick);
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

	/** Open `key`'s palette, or close it when it is already the open one. */
	togglePalette(key: PresentPaletteKey): void {
		this.palette = this.palette === key ? null : key;
	}

	/** Close both palettes (after picking a colour or choosing a tool). */
	closePalettes(): void {
		this.palette = null;
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
