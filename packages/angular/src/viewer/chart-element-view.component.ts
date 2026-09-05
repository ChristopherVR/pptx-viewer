/* oxlint-disable eslint/one-var -- pervasive pre-existing pattern in this file:
   independent handler-local `const`s, not one statement */
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

import {
	advanceChartValueDrag,
	applyChartPartHighlight,
	beginChartValueDrag,
	findChartPartTarget,
	resolveRevealedChartData,
	withChartTitle,
} from '../internal/shared';
import type { ChartValueDragState, ElementAnimationState } from '../internal/shared';
import { AreaChart3DRendererComponent } from './area-chart-3d-renderer.component';
import { AreaChart3DService } from './area-chart-3d.service';
import { BarChart3DRendererComponent } from './bar-chart-3d-renderer.component';
import { BarChart3DService } from './bar-chart-3d.service';
import {
	chartCanEditParts,
	chartDragCommitData,
	commitChartElementData,
	ensureChartInteractionStyles,
} from './chart-element-view-helpers';
import { ChartPartSelectionService } from './chart-part-selection.service';
import { buildChartViewModel, formatAxisValue, resolveChartKind } from './chart-renderer-helpers';
import { ChartRendererComponent } from './chart-renderer.component';
import { EditorStateService } from './editor-state.service';
import { LineChart3DRendererComponent } from './line-chart-3d-renderer.component';
import { LineChart3DService } from './line-chart-3d.service';
import { PieChart3DRendererComponent } from './pie-chart-3d-renderer.component';
import { PieChart3DService } from './pie-chart-3d.service';
import { SLIDE_CONTEXT } from './slide-context';
import { SurfaceChart3DRendererComponent } from './surface-chart-3d-renderer.component';
import { SurfaceChart3DService } from './surface-chart-3d.service';

@Component({
	selector: 'pptx-chart-element-view',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ChartRendererComponent,
		SurfaceChart3DRendererComponent,
		BarChart3DRendererComponent,
		LineChart3DRendererComponent,
		AreaChart3DRendererComponent,
		PieChart3DRendererComponent,
	],
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
			@if (use3D() && isSurfaceKind()) {
				<pptx-surface-chart-3d-renderer [element]="renderedElement()" />
			} @else if (use3DBar() && isBar3DKind()) {
				<pptx-bar-chart-3d-renderer [element]="renderedElement()" />
			} @else if (use3DLine() && isLine3DKind()) {
				<pptx-line-chart-3d-renderer [element]="renderedElement()" />
			} @else if (use3DArea() && isArea3DKind()) {
				<pptx-area-chart-3d-renderer [element]="renderedElement()" />
			} @else if (use3DPie() && isPie3DKind()) {
				<pptx-pie-chart-3d-renderer [element]="renderedElement()" />
			} @else {
				<pptx-chart-renderer [element]="renderedElement()" />
			}
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
	 * Native-animation playback state. When it carries a staged chart build
	 * (`build.kind === 'chart'`, or the authored-index `chartReveal`) the chart
	 * reveals its series / categories / cells progressively via the shared
	 * `resolveRevealedChartData`. Absent outside a running presentation, so
	 * ordinary rendering is unaffected.
	 */
	readonly animationState = input<ElementAnimationState | undefined>(undefined);

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
	/** Viewer-scoped opt-in flag for the interactive 3D surface-chart renderer. */
	private readonly surfaceChart3DSvc = inject(SurfaceChart3DService, { optional: true });
	/** Viewer-scoped opt-in flag for the interactive 3D bar3D-chart renderer. */
	private readonly barChart3DSvc = inject(BarChart3DService, { optional: true });
	/** Viewer-scoped opt-in flag for the interactive 3D line3D-chart renderer. */
	private readonly lineChart3DSvc = inject(LineChart3DService, { optional: true });
	/** Viewer-scoped opt-in flag for the interactive 3D area3D-chart renderer. */
	private readonly areaChart3DSvc = inject(AreaChart3DService, { optional: true });
	/** Viewer-scoped opt-in flag for the interactive 3D pie3D-chart renderer. */
	private readonly pieChart3DSvc = inject(PieChart3DService, { optional: true });
	private readonly injector = inject(Injector);

	private readonly wrapper = viewChild<ElementRef<HTMLElement>>('wrapper');
	private readonly titleEditor = viewChild<ElementRef<HTMLInputElement>>('titleEditor');

	/** In-flight vertical value drag, or null. */
	private dragSession: ChartValueDragState | null = null;
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

	/**
	 * Opt-in interactive 3D surface scene (camera orbit/zoom via OrbitControls).
	 * Marks are not selectable/draggable in this mode: a mesh facet has no 2D
	 * screen geometry to hit-test against, so value-drag editing stays SVG-only.
	 */
	protected readonly use3D = computed(() => this.surfaceChart3DSvc?.enabled() ?? false);
	protected readonly isSurfaceKind = computed(
		() => resolveChartKind(this.chartData()?.chartType ?? 'bar') === 'surface',
	);

	/**
	 * Opt-in interactive 3D bar scene (real box meshes, camera orbit/zoom via
	 * OrbitControls). Same "marks are not selectable/draggable" caveat as the
	 * surface scene above. `chartType` is checked directly (NOT via
	 * `resolveChartKind`, which folds `bar`/`bar3D` onto the same 'bar' kind),
	 * so a plain 2-D bar chart never mounts the 3D scene.
	 */
	protected readonly use3DBar = computed(() => this.barChart3DSvc?.enabled() ?? false);
	protected readonly isBar3DKind = computed(() => this.chartData()?.chartType === 'bar3D');

	/**
	 * Opt-in interactive 3D line/area scenes (tube path / ribbon meshes, camera
	 * orbit/zoom via OrbitControls). Same "marks are not selectable/draggable"
	 * caveat as the surface/bar scenes above.
	 */
	protected readonly use3DLine = computed(() => this.lineChart3DSvc?.enabled() ?? false);
	protected readonly isLine3DKind = computed(() => this.chartData()?.chartType === 'line3D');
	protected readonly use3DArea = computed(() => this.areaChart3DSvc?.enabled() ?? false);
	protected readonly isArea3DKind = computed(() => this.chartData()?.chartType === 'area3D');

	/**
	 * Opt-in interactive 3D pie scene (real wedge meshes, camera orbit/zoom via
	 * OrbitControls). Same "marks are not selectable/draggable" caveat as the
	 * bar scene above. `chartType` is checked directly (NOT via
	 * `resolveChartKind`, which folds `pie`/`pie3D`/`doughnut` onto the same
	 * 'pie' kind), so a plain 2-D pie or doughnut chart never mounts the 3D
	 * scene.
	 */
	protected readonly use3DPie = computed(() => this.pieChart3DSvc?.enabled() ?? false);
	protected readonly isPie3DKind = computed(() => this.chartData()?.chartType === 'pie3D');

	/** Whether this chart element is currently selected in the editor. */
	private readonly isSelected = computed(
		() => this.editor?.selectedIds().includes(this.element().id) ?? false,
	);

	/** Direct part editing is active: selected + editable + a commit channel. */
	protected readonly canEdit = computed(() =>
		chartCanEditParts(this.editable(), this.isSelected(), this.editor !== null, this.element()),
	);

	/** VM of the COMMITTED data: drag geometry must not rescale mid-drag. */
	private readonly viewModel = computed(() =>
		this.canEdit() ? buildChartViewModel(this.element()) : null,
	);

	/**
	 * The element to render: committed data, or the local drag preview, with its
	 * data trimmed to the stages revealed at the current staged-build progress (the
	 * drag preview wins first). Whole-chart / no-build renders return the element
	 * unchanged. Mirrors the Vue `ChartRenderer`'s `revealedElement`.
	 */
	protected readonly renderedElement = computed<PptxElement>(() => {
		const preview = this.previewData();
		const base: PptxElement = preview
			? ({ ...this.element(), chartData: preview } as PptxElement)
			: this.element();
		if (base.type !== 'chart' || !base.chartData) {
			return base;
		}
		const revealed = resolveRevealedChartData(base.chartData, this.animationState());
		return revealed === base.chartData ? base : ({ ...base, chartData: revealed } as PptxElement);
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
		//
		// Guarded on `editable()`, and that guard is load-bearing: the SAME chart
		// element is mounted several times over (the thumbnail rail alone renders
		// one copy per slide), every copy shares this element id, and only the
		// canvas copy is on an editable surface. Without the guard the read-only
		// copies raced the canvas on every mark click - the canvas set the
		// selection, a rail copy saw `!canEdit()` and cleared it a tick later, so
		// the highlight class was applied and stripped within ~100ms and no mark
		// ever stayed selected. Note the discriminator has to be the `editable`
		// INPUT, not the editor service: that is `inject(..., {optional: true})`,
		// so every mount in the tree shares one non-null instance and testing it
		// excludes nothing. Deselecting still clears, because `editable()` stays
		// true while `isSelected()` goes false. React's `ChartElementView` carried
		// the identical defect (there the read-only mounts are told apart by the
		// absence of an `onUpdateElement` prop).
		effect(() => {
			if (!this.editable()) {
				return;
			}
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
		const session = beginChartValueDrag({
			part,
			viewModel: vm,
			chartData,
			clientY: event.clientY,
		});
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
		const height = svg?.getBoundingClientRect().height ?? 0;
		const step = advanceChartValueDrag(session, event.clientY, height);
		if (step) {
			this.previewData.set(step.chartData);
			this.dragValue.set(step.value);
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
