/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent handler-local `const`s, not one statement */
import type { ChartPptxElement, PptxChartData, PptxElement } from 'pptx-viewer-core';
import {
	advanceChartMarkDrag,
	advanceChartValueDrag,
	applyChartPartHighlight,
	beginChartMarkDrag,
	beginChartValueDrag,
	buildChartMarkDragGeometry,
	buildChartViewModel,
	ensureChartInteractionStyles,
	findChartPartTarget,
	formatAxisValue,
	resolveChartKind,
	withChartTitle,
} from 'pptx-viewer-shared';
import type { ChartMarkDragState, ChartPartRef, ChartValueDragState } from 'pptx-viewer-shared';

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
 * is one undo step), Escape cancels; double-click the title to edit it in
 * place (Enter/blur commits, Escape cancels). The projector always emits the
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
	/** Inline title editor draft; null while the editor is closed. */
	titleDraft = $state<string | null>(null);

	#active: ChartValueDragState | null = null;
	/**
	 * In-flight pie/doughnut slice, radar vertex, or stacked segment drag, or
	 * null. Runs through a parallel state machine (no single vertical value
	 * axis), never alongside `#active`.
	 */
	#activeMark: ChartMarkDragState | null = null;
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
		const vm = buildChartViewModel(element);
		let captured = false;
		// Pie/doughnut/radar/stacked marks: try the angle/radial/segment drag first.
		const chartKind = resolveChartKind(element.chartData.chartType ?? 'bar');
		if (part.pointIndex !== undefined && chartKind !== 'unsupported') {
			const markGeometry = buildChartMarkDragGeometry({
				kind: chartKind,
				element,
				chartData: element.chartData,
				categoryLabels: element.chartData.categories,
				seriesIndex: part.seriesIndex,
				pointIndex: part.pointIndex,
			});
			const startedMark = beginChartMarkDrag({
				part,
				geometry: markGeometry,
				chartData: element.chartData,
				svgWidth: vm.svgWidth,
				svgHeight: vm.svgHeight,
				clientX: event.clientX,
				clientY: event.clientY,
			});
			if (startedMark) {
				this.#activeMark = startedMark;
				captured = true;
			}
		}
		// Clustered bar/line/scatter/bubble: the existing vertical value-axis drag.
		if (!captured) {
			const started = beginChartValueDrag({
				part,
				viewModel: vm,
				chartData: element.chartData,
				clientY: event.clientY,
			});
			if (started) {
				this.#active = started;
				captured = true;
			}
		}
		if (!captured) {
			return;
		}
		event.preventDefault();
		try {
			(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId);
		} catch {
			// Non-fatal: the drag still works while the pointer stays over the chart.
		}
		window.addEventListener('keydown', this.#onkeydown);
		// Move / release are watched on the WINDOW, not the chart root: each
		// preview frame re-renders the SVG and detaches the mark the pointer went
		// down on, so a root-level listener would stop receiving the gesture as
		// soon as the first frame painted.
		window.addEventListener('pointermove', this.#onpointermove);
		window.addEventListener('pointerup', this.#onpointerup);
	};

	/**
	 * Double-click handler for the chart root: opens the inline title editor
	 * when the title itself was hit, and otherwise just keeps a mark
	 * double-click from bubbling into the element-level inline-text-edit
	 * handler (a mark double-click is already handled as two presses).
	 */
	ondblclick = (event: MouseEvent): void => {
		const target = event.target;
		if (!(target instanceof Element)) {
			return;
		}
		if (target.closest("[data-chart-part='title']")) {
			event.stopPropagation();
			this.titleDraft = this.#element().chartData?.title ?? '';
			return;
		}
		if (findChartPartTarget(event.target)) {
			event.stopPropagation();
		}
	};

	setTitleDraft(value: string): void {
		this.titleDraft = value;
	}

	commitTitle(): void {
		const element = this.#element();
		if (this.titleDraft !== null && element.chartData) {
			this.#commit(element.id, withChartTitle(element.chartData, this.titleDraft));
		}
		this.titleDraft = null;
	}

	cancelTitle(): void {
		this.titleDraft = null;
	}

	/** Release listeners when the chart unmounts mid-drag. */
	destroy(): void {
		this.#active = null;
		this.#activeMark = null;
		this.#detach();
	}

	#detach(): void {
		window.removeEventListener('keydown', this.#onkeydown);
		window.removeEventListener('pointermove', this.#onpointermove);
		window.removeEventListener('pointerup', this.#onpointerup);
	}

	#onpointermove = (event: PointerEvent): void => {
		const activeMark = this.#activeMark;
		if (activeMark) {
			const rect = this.#root()?.querySelector('svg')?.getBoundingClientRect();
			if (!rect) {
				return;
			}
			const step = advanceChartMarkDrag(activeMark, event.clientX, event.clientY, rect);
			if (!step) {
				return;
			}
			this.preview = step.chartData;
			this.label = formatAxisValue(step.value);
			return;
		}
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
		const activeMark = this.#activeMark;
		this.#active = null;
		this.#activeMark = null;
		this.#detach();
		this.preview = null;
		this.label = null;
		if (!commit) {
			return;
		}
		if (active?.moved && active.lastData) {
			this.#commit(this.#element().id, active.lastData);
		} else if (activeMark?.moved && activeMark.lastData) {
			this.#commit(this.#element().id, activeMark.lastData);
		}
	}
}
