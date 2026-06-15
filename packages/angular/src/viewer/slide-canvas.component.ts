import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	HostListener,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import type { CanvasSize } from '../internal/shared';
import { applyMove, applyResize, handleAnchor, handleCursor, RESIZE_HANDLES } from './drag-resize';
import type { Box, ResizeHandle } from './drag-resize';
import { ElementRendererComponent } from './element-renderer.component';
import type { StyleMap } from './element-style';
import { getSlideBackgroundStyle } from './slide-background';

/** Pixels (screen-space) a pointer must move before a click becomes a drag. */
const DRAG_THRESHOLD = 3;
/** Handle size in screen pixels (scaled to stage units via the zoom). */
const HANDLE_SCREEN_PX = 9;

interface DragState {
	id: string;
	mode: 'move' | 'resize' | 'rotate';
	handle: ResizeHandle | null;
	startBox: Box;
	startX: number;
	startY: number;
	started: boolean;
	/** Rotation-gesture state (stage coords + degrees). */
	centerX?: number;
	centerY?: number;
	startAngle?: number;
	startRotation?: number;
}

/** Best-effort plain text of a text-bearing element for inline editing. */
function plainText(el: PptxElement): string {
	if (!hasTextProperties(el)) {
		return '';
	}
	const segments = el.textSegments;
	if (segments && segments.length > 0) {
		return segments.map((s) => (s.isParagraphBreak || s.isLineBreak ? '\n' : s.text)).join('');
	}
	return el.text ?? '';
}

/**
 * SlideCanvasComponent — Angular port of the React `SlideCanvas.tsx` and Vue
 * `SlideCanvas.vue`.
 *
 * Renders the active slide as a fixed-size stage scaled by `zoom`, with each
 * element absolutely positioned. When `editable`, supports click-to-select
 * (event delegation), selection outlines, and pointer drag-to-move / resize
 * handles. Rulers, grid, guides, marquee, and collaboration overlays are
 * tracked in PORTING.md.
 */
@Component({
	selector: 'pptx-slide-canvas',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ElementRendererComponent],
	template: `
		<div class="pptx-ng-canvas-viewport">
			<div class="pptx-ng-canvas-wrapper" [ngStyle]="wrapperStyle()">
				<div
					#stage
					class="pptx-ng-canvas-stage"
					[class.is-editable]="editable()"
					role="region"
					aria-roledescription="slide"
					[ngStyle]="stageStyle()"
					(pointerdown)="onStagePointerDown($event)"
					(contextmenu)="onContextMenu($event)"
					(dblclick)="onDblClick($event)"
				>
					@for (element of elements(); track element.id; let i = $index) {
						<pptx-element-renderer
							[element]="element"
							[mediaDataUrls]="mediaDataUrls()"
							[zIndex]="i"
						/>
					}
					@for (box of selectionBoxes(); track box.id) {
						<div
							class="pptx-ng-selection"
							[style.left.px]="box.x"
							[style.top.px]="box.y"
							[style.width.px]="box.width"
							[style.height.px]="box.height"
						></div>
					}
					@for (h of handleBoxes(); track h.handle) {
						<div
							class="pptx-ng-handle"
							[style.left.px]="h.left"
							[style.top.px]="h.top"
							[style.width.px]="h.size"
							[style.height.px]="h.size"
							[style.cursor]="h.cursor"
							(pointerdown)="onHandlePointerDown($event, h.handle)"
						></div>
					}
					@if (marqueeRect(); as mr) {
						<div
							class="pptx-ng-marquee"
							[style.left.px]="mr.x"
							[style.top.px]="mr.y"
							[style.width.px]="mr.width"
							[style.height.px]="mr.height"
						></div>
					}
					@if (rotateHandle(); as rh) {
						<div
							class="pptx-ng-rotate-handle"
							[style.left.px]="rh.left"
							[style.top.px]="rh.top"
							[style.width.px]="rh.size"
							[style.height.px]="rh.size"
							(pointerdown)="onRotatePointerDown($event)"
						></div>
					}
					@if (editingBox(); as eb) {
						<textarea
							#textEditor
							class="pptx-ng-text-editor"
							[style.left.px]="eb.x"
							[style.top.px]="eb.y"
							[style.width.px]="eb.width"
							[style.height.px]="eb.height"
							[value]="eb.text"
							(pointerdown)="$event.stopPropagation()"
							(blur)="commitText($event, eb.id)"
							(keydown)="onEditorKeydown($event)"
						></textarea>
					}
				</div>
			</div>
		</div>
	`,
})
export class SlideCanvasComponent {
	readonly slide = input<PptxSlide | undefined>(undefined);
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zoom = input<number>(1);
	/** When true, elements are selectable and drag/resize handles are shown. */
	readonly editable = input<boolean>(false);
	/** Ids of currently-selected elements (drawn with a selection outline). */
	readonly selectedIds = input<readonly string[]>([]);
	/** Id of the element currently being text-edited inline (or null). */
	readonly editingId = input<string | null>(null);

	/** Emitted when an element is pointer-pressed (with the additive modifier). */
	readonly elementSelect = output<{ id: string; additive: boolean }>();
	/** Emitted when empty stage space is pressed (deselect). */
	readonly backgroundClick = output<void>();
	/** Emitted once when a drag/resize gesture actually starts moving. */
	readonly transformStart = output<{ id: string; label: string }>();
	/** Emitted on each pointer move during a gesture with the new box. */
	readonly transformUpdate = output<{ id: string; box: Box }>();
	/** Emitted on right-click with the element under the cursor (or null). */
	readonly contextMenu = output<{ id: string | null; x: number; y: number }>();
	/** Emitted on double-click of a text-bearing element to begin inline edit. */
	readonly textEditStart = output<{ id: string }>();
	/** Emitted with the new text when an inline edit commits. */
	readonly textCommit = output<{ id: string; text: string }>();
	/** Emitted when an inline edit is cancelled (Escape). */
	readonly textCancel = output<void>();
	/** Emitted during a rotate gesture with the new rotation (degrees). */
	readonly rotateUpdate = output<{ id: string; rotation: number }>();
	/** Emitted on marquee release with the ids of enclosed/overlapping elements. */
	readonly marqueeSelect = output<string[]>();

	private drag: DragState | null = null;
	private editCancelled = false;
	private marquee: {
		startX: number;
		startY: number;
		startScreenX: number;
		startScreenY: number;
		started: boolean;
	} | null = null;
	/** Live marquee rectangle (stage coords) while rubber-band selecting. */
	readonly marqueeRect = signal<{ x: number; y: number; width: number; height: number } | null>(
		null,
	);

	private readonly textEditor = viewChild<ElementRef<HTMLTextAreaElement>>('textEditor');
	private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');

	constructor() {
		// Focus + select the inline editor whenever it appears.
		effect(() => {
			const editor = this.textEditor();
			if (editor) {
				editor.nativeElement.focus();
				editor.nativeElement.select();
			}
		});
	}

	readonly elements = computed(() => this.slide()?.elements ?? []);

	/** Bounding boxes (stage coords) for the selected elements. */
	readonly selectionBoxes = computed(() => {
		const selected = new Set(this.selectedIds());
		if (selected.size === 0) {
			return [];
		}
		return this.elements()
			.filter((el) => selected.has(el.id))
			.map((el) => ({ id: el.id, x: el.x, y: el.y, width: el.width, height: el.height }));
	});

	/** The single selected element's box, or null when 0 or >1 are selected. */
	readonly singleSelected = computed<(Box & { id: string }) | null>(() => {
		const ids = this.selectedIds();
		if (ids.length !== 1) {
			return null;
		}
		const el = this.elements().find((e) => e.id === ids[0]);
		return el ? { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height } : null;
	});

	/** Resize-handle render boxes (stage coords) for the single selection. */
	readonly handleBoxes = computed(() => {
		if (!this.editable()) {
			return [];
		}
		const box = this.singleSelected();
		if (!box) {
			return [];
		}
		const size = HANDLE_SCREEN_PX / (this.zoom() || 1);
		return RESIZE_HANDLES.map((handle) => {
			const { fx, fy } = handleAnchor(handle);
			return {
				handle,
				left: box.x + fx * box.width - size / 2,
				top: box.y + fy * box.height - size / 2,
				size,
				cursor: handleCursor(handle),
			};
		});
	});

	/** Rotation-handle box (stage coords) above the single selection, or null. */
	readonly rotateHandle = computed(() => {
		if (!this.editable()) {
			return null;
		}
		const box = this.singleSelected();
		if (!box) {
			return null;
		}
		const zoom = this.zoom() || 1;
		const size = HANDLE_SCREEN_PX / zoom;
		const offset = 24 / zoom;
		return { left: box.x + box.width / 2 - size / 2, top: box.y - offset - size / 2, size };
	});

	onStagePointerDown(event: PointerEvent): void {
		if (!this.editable()) {
			return;
		}
		const target = event.target as HTMLElement | null;
		const host = target?.closest('[data-element-id]') as HTMLElement | null;
		const id = host?.getAttribute('data-element-id');
		if (!id) {
			// Empty space: begin a marquee (rubber-band) selection.
			const stage = this.stageRef()?.nativeElement;
			if (stage) {
				const rect = stage.getBoundingClientRect();
				const zoom = this.zoom() || 1;
				this.marquee = {
					startX: (event.clientX - rect.left) / zoom,
					startY: (event.clientY - rect.top) / zoom,
					startScreenX: event.clientX,
					startScreenY: event.clientY,
					started: false,
				};
			} else {
				this.backgroundClick.emit();
			}
			return;
		}
		this.elementSelect.emit({ id, additive: event.shiftKey || event.ctrlKey || event.metaKey });
		const el = this.elements().find((e) => e.id === id);
		if (!el) {
			return;
		}
		this.drag = {
			id,
			mode: 'move',
			handle: null,
			startBox: { x: el.x, y: el.y, width: el.width, height: el.height },
			startX: event.clientX,
			startY: event.clientY,
			started: false,
		};
	}

	/** Box + current plain text for the element under inline edit, or null. */
	readonly editingBox = computed(() => {
		const id = this.editingId();
		if (!id || !this.editable()) {
			return null;
		}
		const el = this.elements().find((e) => e.id === id);
		if (!el) {
			return null;
		}
		return { id: el.id, x: el.x, y: el.y, width: el.width, height: el.height, text: plainText(el) };
	});

	onDblClick(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		const target = event.target as HTMLElement | null;
		const host = target?.closest('[data-element-id]') as HTMLElement | null;
		const id = host?.getAttribute('data-element-id');
		if (id) {
			event.preventDefault();
			this.textEditStart.emit({ id });
		}
	}

	onEditorKeydown(event: KeyboardEvent): void {
		const editor = event.target as HTMLTextAreaElement;
		if (event.key === 'Escape') {
			event.preventDefault();
			this.editCancelled = true;
			editor.blur();
		} else if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			editor.blur();
		}
	}

	commitText(event: Event, id: string): void {
		if (this.editCancelled) {
			this.editCancelled = false;
			this.textCancel.emit();
			return;
		}
		const editor = event.target as HTMLTextAreaElement;
		this.textCommit.emit({ id, text: editor.value });
	}

	onContextMenu(event: MouseEvent): void {
		if (!this.editable()) {
			return;
		}
		event.preventDefault();
		const target = event.target as HTMLElement | null;
		const host = target?.closest('[data-element-id]') as HTMLElement | null;
		const id = host?.getAttribute('data-element-id') ?? null;
		this.contextMenu.emit({ id, x: event.clientX, y: event.clientY });
	}

	onHandlePointerDown(event: PointerEvent, handle: ResizeHandle): void {
		event.stopPropagation();
		const box = this.singleSelected();
		if (!box) {
			return;
		}
		this.drag = {
			id: box.id,
			mode: 'resize',
			handle,
			startBox: { x: box.x, y: box.y, width: box.width, height: box.height },
			startX: event.clientX,
			startY: event.clientY,
			started: false,
		};
	}

	onRotatePointerDown(event: PointerEvent): void {
		event.stopPropagation();
		const box = this.singleSelected();
		const stage = this.stageRef()?.nativeElement;
		if (!box || !stage) {
			return;
		}
		const el = this.elements().find((e) => e.id === box.id);
		const zoom = this.zoom() || 1;
		const rect = stage.getBoundingClientRect();
		const centerX = box.x + box.width / 2;
		const centerY = box.y + box.height / 2;
		const px = (event.clientX - rect.left) / zoom;
		const py = (event.clientY - rect.top) / zoom;
		this.drag = {
			id: box.id,
			mode: 'rotate',
			handle: null,
			startBox: box,
			startX: event.clientX,
			startY: event.clientY,
			started: false,
			centerX,
			centerY,
			startAngle: Math.atan2(py - centerY, px - centerX),
			startRotation: el?.rotation ?? 0,
		};
	}

	@HostListener('document:pointermove', ['$event'])
	onPointerMove(event: PointerEvent): void {
		const marquee = this.marquee;
		if (marquee) {
			const stage = this.stageRef()?.nativeElement;
			if (!stage) {
				return;
			}
			if (
				!marquee.started &&
				Math.abs(event.clientX - marquee.startScreenX) < DRAG_THRESHOLD &&
				Math.abs(event.clientY - marquee.startScreenY) < DRAG_THRESHOLD
			) {
				return;
			}
			marquee.started = true;
			const rect = stage.getBoundingClientRect();
			const z = this.zoom() || 1;
			const curX = (event.clientX - rect.left) / z;
			const curY = (event.clientY - rect.top) / z;
			this.marqueeRect.set({
				x: Math.min(marquee.startX, curX),
				y: Math.min(marquee.startY, curY),
				width: Math.abs(curX - marquee.startX),
				height: Math.abs(curY - marquee.startY),
			});
			return;
		}

		const drag = this.drag;
		if (!drag) {
			return;
		}
		const zoom = this.zoom() || 1;

		if (!drag.started) {
			if (
				Math.abs(event.clientX - drag.startX) < DRAG_THRESHOLD &&
				Math.abs(event.clientY - drag.startY) < DRAG_THRESHOLD
			) {
				return;
			}
			drag.started = true;
			const label = drag.mode === 'move' ? 'Move' : drag.mode === 'resize' ? 'Resize' : 'Rotate';
			this.transformStart.emit({ id: drag.id, label });
		}

		if (drag.mode === 'rotate') {
			const stage = this.stageRef()?.nativeElement;
			if (
				!stage ||
				drag.centerX === undefined ||
				drag.centerY === undefined ||
				drag.startAngle === undefined ||
				drag.startRotation === undefined
			) {
				return;
			}
			const rect = stage.getBoundingClientRect();
			const px = (event.clientX - rect.left) / zoom;
			const py = (event.clientY - rect.top) / zoom;
			const angle = Math.atan2(py - drag.centerY, px - drag.centerX);
			const deltaDeg = ((angle - drag.startAngle) * 180) / Math.PI;
			const rotation = (((drag.startRotation + deltaDeg) % 360) + 360) % 360;
			this.rotateUpdate.emit({ id: drag.id, rotation: Math.round(rotation) });
			return;
		}

		const dx = (event.clientX - drag.startX) / zoom;
		const dy = (event.clientY - drag.startY) / zoom;
		const box =
			drag.mode === 'move' || drag.handle === null
				? applyMove(drag.startBox, dx, dy)
				: applyResize(drag.startBox, drag.handle, dx, dy);
		this.transformUpdate.emit({ id: drag.id, box });
	}

	@HostListener('document:pointerup')
	onPointerUp(): void {
		const marquee = this.marquee;
		if (marquee) {
			const rect = this.marqueeRect();
			if (marquee.started && rect) {
				const ids = this.elements()
					.filter(
						(el) =>
							rect.x < el.x + el.width &&
							rect.x + rect.width > el.x &&
							rect.y < el.y + el.height &&
							rect.y + rect.height > el.y,
					)
					.map((el) => el.id);
				this.marqueeSelect.emit(ids);
			} else {
				this.backgroundClick.emit();
			}
			this.marquee = null;
			this.marqueeRect.set(null);
		}
		this.drag = null;
	}

	readonly wrapperStyle = computed<StyleMap>(() => {
		const scale = this.zoom();
		const size = this.canvasSize();
		return {
			width: `${size.width * scale}px`,
			height: `${size.height * scale}px`,
			position: 'relative',
			margin: '1rem auto',
		};
	});

	readonly stageStyle = computed<StyleMap>(() => {
		const scale = this.zoom();
		const size = this.canvasSize();
		const slide = this.slide();
		const style: StyleMap = {
			width: `${size.width}px`,
			height: `${size.height}px`,
			transform: `scale(${scale})`,
			'transform-origin': 'top left',
			position: 'relative',
			overflow: 'hidden',
			'box-shadow': '0 10px 40px rgba(0, 0, 0, 0.35)',
			// Resolved slide background: image → gradient → pattern → solid colour.
			...getSlideBackgroundStyle(slide),
		};
		return style;
	});
}
