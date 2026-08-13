import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	advanceChartValueDrag,
	applyChartPartHighlight,
	beginChartValueDrag,
	buildChartViewModel,
	ensureChartInteractionStyles,
	findChartPartTarget,
	formatAxisValue,
} from 'pptx-viewer-shared';
import type { ChartPartRef, ChartValueDragState } from 'pptx-viewer-shared';

/**
 * chart-drag (Svelte): direct on-canvas chart editing, the Svelte port of Vue's
 * `useChartCanvasInteraction` and React's `ChartElementView`.
 *
 * The state machine, the hit-target stylesheet and the highlight all live in
 * `pptx-viewer-shared/render/chart-canvas-drag`; this module is only the runes
 * wrapper, so a fix to the drag maths reaches all five bindings at once.
 *
 * Behaviour: press a bar / dot / slice to select it, drag it vertically to
 * change its value (live local preview, committed ONCE on release so one drag
 * is one undo step), Escape cancels. The projector always emits the
 * `data-chart-*` hit-testing attributes; they stay pointer-transparent until
 * the root carries `pptx-chart-interactive`, which is why thumbnails and the
 * presentation stage cannot be dragged.
 */
export class ChartDragController {
	/** Chart data with the in-flight drag applied, or null when idle. */
	preview = $state<PptxChartData | null>(null);
	/** Formatted value for the floating mid-drag badge, or null when idle. */
	label = $state<string | null>(null);
	/** The mark the user last pressed, highlighted until selection moves away. */
	selectedPart = $state<ChartPartRef | null>(null);

	#active: ChartValueDragState | null = null;
	#element: () => ChartPptxElement;
	#commit: (elementId: string, chartData: PptxChartData) => void;
	#root: () => HTMLElement | null;

	constructor(input: {
		element: () => ChartPptxElement;
		root: () => HTMLElement | null;
		commit: (elementId: string, chartData: PptxChartData) => void;
	}) {
		this.#element = input.element;
		this.#root = input.root;
		this.#commit = input.commit;
		ensureChartInteractionStyles();
	}

	/** The element to render: the committed one, or the drag preview over it. */
	rendered(): PptxElement {
		const element = this.#element();
		return this.preview ? ({ ...element, chartData: this.preview } as PptxElement) : element;
	}

	/** Re-apply the selected-mark highlight; the SVG is re-created every render. */
	syncHighlight(): void {
		applyChartPartHighlight(this.#root(), this.selectedPart);
	}

	onpointerdown = (event: PointerEvent): void => {
		const part = findChartPartTarget(event.target);
		if (!part) {
			return;
		}
		// Stop the press reaching the element-level drag handler, or moving a bar
		// would also move the whole chart frame.
		event.stopPropagation();
		this.selectedPart = part;
		const element = this.#element();
		if (!element.chartData) {
			return;
		}
		// Built from the COMMITTED data so the axis does not rescale under the
		// pointer mid-drag and take the mark away from the cursor.
		const started = beginChartValueDrag({
			part,
			viewModel: buildChartViewModel(element),
			chartData: element.chartData,
			clientY: event.clientY,
		});
		if (!started) {
			return;
		}
		event.preventDefault();
		try {
			(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
		} catch {
			// Non-fatal: the drag still works while the pointer stays over the chart.
		}
		this.#active = started;
		window.addEventListener('keydown', this.#onkeydown);
		// Move / release are watched on the WINDOW, not the chart root: each
		// preview frame re-renders the SVG and detaches the mark the pointer went
		// down on, so a root-level listener would stop receiving the gesture as
		// soon as the first frame painted.
		window.addEventListener('pointermove', this.#onpointermove);
		window.addEventListener('pointerup', this.#onpointerup);
	};

	/** Release listeners when the chart unmounts mid-drag. */
	destroy(): void {
		this.#active = null;
		this.#detach();
	}

	#detach(): void {
		window.removeEventListener('keydown', this.#onkeydown);
		window.removeEventListener('pointermove', this.#onpointermove);
		window.removeEventListener('pointerup', this.#onpointerup);
	}

	#onpointermove = (event: PointerEvent): void => {
		const active = this.#active;
		if (!active) {
			return;
		}
		const height = this.#root()?.querySelector('svg')?.getBoundingClientRect().height ?? 0;
		const step = advanceChartValueDrag(active, event.clientY, height);
		if (!step) {
			return;
		}
		this.preview = step.chartData;
		this.label = formatAxisValue(step.value);
	};

	#onpointerup = (): void => {
		this.#end(true);
	};

	#onkeydown = (event: KeyboardEvent): void => {
		if (event.key === 'Escape') {
			this.#end(false);
		}
	};

	#end(commit: boolean): void {
		const active = this.#active;
		this.#active = null;
		this.#detach();
		this.preview = null;
		this.label = null;
		if (commit && active?.moved && active.lastData) {
			this.#commit(this.#element().id, active.lastData);
		}
	}
}
