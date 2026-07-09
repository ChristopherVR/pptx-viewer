/**
 * ChartElementViewComponent (Angular port of React's `ChartElementView.tsx`):
 * renders a chart and, while it is selected + editable, makes its data marks
 * directly manipulable. Click a mark to select that part (drop-shadow ring +
 * inspector sync via {@link ChartPartSelectionService}); drag a mark
 * vertically to change its value (local preview, floating badge, Escape
 * cancels, committed ONCE on release as one undo step); double-click the
 * title to edit it in place. Otherwise the hit-testing attributes stay inert
 * and rendering is byte-identical to the plain chart renderer.
 */
import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	HostListener,
	inject,
	Injector,
	input,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxChartData, PptxElement } from 'pptx-viewer-core';

import { findChartPartTarget, withChartTitle } from '../internal/shared';
import {
	applyChartPartHighlight,
	beginChartValueDrag,
	chartDragCommitData,
	commitChartElementData,
	ensureChartInteractionStyles,
	moveChartValueDrag,
} from './chart-element-view-helpers';
import type { ChartValueDragSession } from './chart-element-view-helpers';
import { ChartPartSelectionService } from './chart-part-selection.service';
import { buildChartViewModel, formatAxisValue } from './chart-renderer-helpers';
import { ChartRendererComponent } from './chart-renderer.component';
import { EditorStateService } from './editor-state.service';
import { SLIDE_CONTEXT } from './slide-context';

@Component({
	selector: 'pptx-chart-element-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ChartRendererComponent],
	template: `
		<div
			#wrapper
			class="pptx-ng-chart-view"
			[class.pptx-chart-interactive]="canEdit()"
			(pointerdown)="onPointerDown($event)"
			(pointermove)="onPointerMove($event)"
			(pointerup)="onPointerUp()"
			(dblclick)="onDblClick($event)"
		>
			<pptx-chart-renderer [element]="renderedElement()" />
			@if (dragValue() !== null) {
				<div class="pptx-ng-chart-drag-badge">{{ dragBadge() }}</div>
			}
			@if (titleDraft() !== null) {
				<input
					#titleEditor
					type="text"
					class="pptx-ng-chart-title-input"
					[value]="titleDraft() ?? ''"
					(input)="onTitleInput($event)"
					(keydown)="onTitleKeydown($event)"
					(blur)="commitTitle()"
					(pointerdown)="$event.stopPropagation()"
					(dblclick)="$event.stopPropagation()"
				/>
			}
		</div>
	`,
})
export class ChartElementViewComponent {
	/** The chart element to render. Must be `type === 'chart'`. */
	readonly element = input.required<PptxElement>();
	/**
	 * Whether the hosting canvas allows editing this element. Direct part
	 * editing additionally requires the element to be SELECTED ({@link canEdit}).
	 */
	readonly editable = input<boolean>(false);

	/**
	 * The editor state layer. Optional: the renderer is also used outside the
	 * editing viewer (thumbnails, export). On-canvas chart edits commit through
	 * `updateElement` here, the exact channel the inspector uses, so undo/redo
	 * and save round-trip are shared (one history snapshot per commit).
	 */
	private readonly editor = inject(EditorStateService, { optional: true });
	/** Canvas <-> inspector chart-part selection bridge (viewer-scoped). */
	private readonly partSelection = inject(ChartPartSelectionService, { optional: true });
	/** The hosting canvas's slide, for resolving template (master/layout) charts. */
	private readonly slideContext = inject(SLIDE_CONTEXT, { optional: true });
	private readonly injector = inject(Injector);

	private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');
	private readonly titleEditor = viewChild<ElementRef<HTMLInputElement>>('titleEditor');

	/** In-flight vertical value drag, or null. */
	private dragSession: ChartValueDragSession | null = null;
	/** Local drag preview: rendered instead of the committed data mid-drag. */
	private readonly previewData = signal<PptxChartData | null>(null);
	/** Live value under the pointer mid-drag (drives the floating badge). */
	protected readonly dragValue = signal<number | null>(null);
	/** Inline title editor draft, or null when the editor is closed. */
	protected readonly titleDraft = signal<string | null>(null);

	private readonly chartData = computed<PptxChartData | undefined>(() => {
		const el = this.element();
		return el.type === 'chart' ? el.chartData : undefined;
	});

	/** Whether this chart element is currently selected in the editor. */
	private readonly isSelected = computed(
		() => this.editor?.selectedIds().includes(this.element().id) ?? false,
	);

	/** Direct part editing is active: selected + editable + a commit channel. */
	protected readonly canEdit = computed(
		() => this.editable() && this.isSelected() && this.editor !== null,
	);

	/** VM of the COMMITTED data: drag geometry must not rescale mid-drag. */
	private readonly viewModel = computed(() =>
		this.canEdit() ? buildChartViewModel(this.element()) : null,
	);

	/** The element to render: committed data, or the local drag preview. */
	protected readonly renderedElement = computed<PptxElement>(() => {
		const preview = this.previewData();
		return preview ? ({ ...this.element(), chartData: preview } as PptxElement) : this.element();
	});

	protected readonly dragBadge = computed(() => {
		const value = this.dragValue();
		return value === null ? '' : formatAxisValue(value);
	});

	/** The part selected for THIS chart, or null. */
	private readonly selectedPart = computed(() => {
		const sel = this.partSelection?.selection() ?? null;
		return sel && sel.elementId === this.element().id ? sel.part : null;
	});

	constructor() {
		ensureChartInteractionStyles();

		// Drop this chart's part selection when it stops being editable
		// (deselected, mode change) so the inspector highlight does not linger.
		effect(() => {
			if (!this.canEdit()) {
				this.partSelection?.clearForElement(this.element().id);
			}
		});

		// Re-apply the selected-part highlight after each render that re-creates
		// the SVG marks (selection / data / preview changes drop DOM-only classes).
		effect(() => {
			const part = this.selectedPart();
			this.renderedElement();
			afterNextRender(
				() => {
					const root = this.wrapper()?.nativeElement;
					if (root) {
						applyChartPartHighlight(root, part);
					}
				},
				{ injector: this.injector },
			);
		});

		// Focus the inline title editor as soon as it mounts.
		effect(() => {
			if (this.titleDraft() !== null) {
				afterNextRender(() => this.titleEditor()?.nativeElement.focus(), {
					injector: this.injector,
				});
			}
		});
	}

	// ── Pointer interaction (event delegation over data-chart-* marks) ────────

	protected onPointerDown(event: PointerEvent): void {
		if (!this.canEdit()) {
			return;
		}
		const part = findChartPartTarget(event.target);
		if (!part) {
			return;
		}
		event.stopPropagation();
		this.partSelection?.select({ elementId: this.element().id, part });
		const chartData = this.chartData();
		const vm = this.viewModel();
		if (!chartData || !vm) {
			return;
		}
		const session = beginChartValueDrag(part, vm, chartData, event.clientY);
		if (!session) {
			return;
		}
		event.preventDefault();
		// Pointer capture keeps the drag alive off-mark; guarded because test
		// DOMs (and older browsers) may not implement it.
		try {
			(event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
		} catch {
			// Non-fatal: the drag still works while the pointer stays over the chart.
		}
		this.dragSession = session;
	}

	protected onPointerMove(event: PointerEvent): void {
		const session = this.dragSession;
		if (!session) {
			return;
		}
		const svg = this.wrapper()?.nativeElement.querySelector('svg');
		const rect = svg?.getBoundingClientRect();
		if (!rect || rect.height === 0) {
			return;
		}
		const result = moveChartValueDrag(session, event.clientY, rect.height);
		if (result) {
			this.previewData.set(result.data);
			this.dragValue.set(result.value);
		}
	}

	protected onPointerUp(): void {
		if (this.dragSession) {
			this.endDrag(true);
		}
	}

	/** Cancel an in-flight value drag with Escape (document-level, like React). */
	@HostListener('document:keydown.escape')
	protected onEscape(): void {
		if (this.dragSession) {
			this.endDrag(false);
		}
	}

	private endDrag(commit: boolean): void {
		const data = chartDragCommitData(this.dragSession, commit);
		this.dragSession = null;
		this.previewData.set(null);
		this.dragValue.set(null);
		if (data) {
			commitChartElementData(
				this.editor,
				this.element().id,
				data,
				this.slideContext?.slideId() ?? null,
			);
		}
	}

	// ── Inline title editing ──────────────────────────────────────────────────

	protected onDblClick(event: MouseEvent): void {
		if (!this.canEdit()) {
			return;
		}
		const target = event.target as Partial<Element>;
		if (typeof target.closest !== 'function') {
			return;
		}
		if ((target as Element).closest("[data-chart-part='title']")) {
			event.stopPropagation();
			this.titleDraft.set(this.chartData()?.title ?? '');
			return;
		}
		if (findChartPartTarget(event.target)) {
			// A mark double-click is two selects; keep it from bubbling into the
			// canvas-level inline-text-edit handler.
			event.stopPropagation();
		}
	}

	protected onTitleInput(event: Event): void {
		this.titleDraft.set((event.target as HTMLInputElement).value);
	}

	protected onTitleKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			this.commitTitle();
		} else if (event.key === 'Escape') {
			this.titleDraft.set(null);
		}
		event.stopPropagation();
	}

	protected commitTitle(): void {
		const draft = this.titleDraft();
		const chartData = this.chartData();
		if (draft !== null && chartData) {
			commitChartElementData(
				this.editor,
				this.element().id,
				withChartTitle(chartData, draft),
				this.slideContext?.slideId() ?? null,
			);
		}
		this.titleDraft.set(null);
	}
}
