/**
 * ribbon-drawing-group.component.ts: Drawing group for the Home tab ribbon.
 * Provides shape insertion, layer arrangement, and shape Fill/Outline colour
 * pickers (Shape Effects stays a disabled placeholder: it is genuinely
 * unimplemented in every binding).
 *
 * The Arrange menu also carries Group / Ungroup, which is where PowerPoint
 * puts them (Home > Drawing > Arrange) and where the other bindings expose
 * them; the dedicated Arrange tab keeps its flat buttons.
 *
 * Shape picks insert straight through the shared {@link EditorStateService}
 * (like the Insert and Arrange sections do), matching React's immediate-insert
 * behaviour (DrawingGroup -> onAddShape): the element appears at a default
 * position, becomes the selection, marks the deck dirty, and is undoable.
 * The picker lists the first 12 entries of the shared preset catalogue
 * ({@link SHAPE_PRESET_DEFS}), so the geometry ids are valid OOXML
 * `a:prstGeom` values shared with every binding.
 *
 * Fill/Outline commit through `pptx-viewer-shared`'s `shapeFillChange` /
 * `shapeOutlineChange` decision functions (the same ones React's and Vue's
 * DrawingGroup use), so the two keys written (`fillColor`+`fillMode` /
 * `strokeColor`) can't drift from the other bindings a third time. The
 * buttons used to be `disabled` placeholders that did nothing when clicked.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';

import {
	RIBBON_SHAPE_SWATCHES,
	SHAPE_PRESET_DEFS,
	shapeFillChange,
	shapeOutlineChange,
} from '../internal/shared';
import type { ShapePresetDef } from '../internal/shared';
import { newPresetShapeElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { RibbonColorPopoverComponent } from './ribbon-color-popover.component';

/**
 * The quick "top shapes" row shared with React's toolbar (first 12 presets),
 * and the fallbacks the Fill/Outline swatch dots show when the selection has
 * none set (declared together: oxlint's `one-var` wants one `const` statement
 * per top-level scope).
 */
const TOP_SHAPES: readonly ShapePresetDef[] = SHAPE_PRESET_DEFS.slice(0, 12),
	DEFAULT_FILL_COLOR = '#ffffff',
	DEFAULT_OUTLINE_COLOR = '#000000';

/** Fill/Outline only apply to an editable, selected shape-like element. */
export function canFormatShapeSelection(canEdit: boolean, element: PptxElement | null): boolean {
	return canEdit && element !== null && hasShapeProperties(element);
}

/** The colour the Fill swatch dot shows for the current selection. */
export function fillColorOf(element: PptxElement | null): string {
	if (element === null || !hasShapeProperties(element)) {
		return DEFAULT_FILL_COLOR;
	}
	return element.shapeStyle?.fillColor ?? DEFAULT_FILL_COLOR;
}

/** The colour the Outline swatch dot shows for the current selection. */
export function outlineColorOf(element: PptxElement | null): string {
	if (element === null || !hasShapeProperties(element)) {
		return DEFAULT_OUTLINE_COLOR;
	}
	return element.shapeStyle?.strokeColor ?? DEFAULT_OUTLINE_COLOR;
}

/**
 * The element patch a Fill/Outline swatch pick commits, or `undefined` when
 * the selection has no shape style to patch. Merges into the EXISTING
 * `shapeStyle` (not a replace) so picking a fill colour never clears an
 * already-set outline, and vice versa.
 */
export function shapeStylePatch(
	element: PptxElement | null,
	style: Partial<ShapeStyle>,
): Partial<PptxElement> | undefined {
	if (element === null || !hasShapeProperties(element)) {
		return undefined;
	}
	return { shapeStyle: { ...element.shapeStyle, ...style } } as Partial<PptxElement>;
}

@Component({
	selector: 'pptx-ribbon-drawing-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, LucideChevronDown, RibbonColorPopoverComponent],
	template: `
		<!-- Shapes -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="pptx-rb-grp">
				<div class="relative">
					<button
						type="button"
						class="pptx-rb-gb gap-1.5"
						[disabled]="!canEdit()"
						[title]="'pptx.drawing.shapes' | translate"
						(click)="shapesOpen.set(!shapesOpen())"
					>
						{{ 'pptx.drawing.shapes' | translate }} <svg lucideChevronDown class="h-3 w-3"></svg>
					</button>
					@if (shapesOpen()) {
						<div
							class="absolute left-0 top-full z-50 mt-0.5 grid grid-cols-4 gap-0.5 rounded border border-border bg-popover p-1 shadow-md"
						>
							@for (shape of shapes; track shape.type) {
								<button
									type="button"
									class="rounded px-1.5 py-0.5 text-[10px] hover:bg-accent"
									(click)="onShapeSelect(shape)"
								>
									{{ shape.i18nKey | translate }}
								</button>
							}
						</div>
					}
				</div>
				<!-- Arrange -->
				<div class="relative">
					<button
						type="button"
						class="pptx-rb-gb gap-1.5"
						[disabled]="!canEdit() || !editor.hasSelection()"
						[title]="'pptx.ribbon.arrange' | translate"
						(click)="arrangeOpen.set(!arrangeOpen())"
					>
						{{ 'pptx.ribbon.arrange' | translate }} <svg lucideChevronDown class="h-3 w-3"></svg>
					</button>
					@if (arrangeOpen()) {
						<div
							class="absolute left-0 top-full z-50 mt-0.5 flex flex-col rounded border border-border bg-popover p-1 shadow-md"
						>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrange('up')"
							>
								{{ 'pptx.arrange.bringForward' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrange('down')"
							>
								{{ 'pptx.arrange.sendBackward' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrangeEdge('front')"
							>
								{{ 'pptx.arrange.bringToFront' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onArrangeEdge('back')"
							>
								{{ 'pptx.arrange.sendToBack' | translate }}
							</button>
							<span class="my-0.5 block h-px bg-border"></span>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onGroup(true)"
							>
								{{ 'pptx.ribbon.group' | translate }}
							</button>
							<button
								type="button"
								class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
								(click)="onGroup(false)"
							>
								{{ 'pptx.ribbon.ungroup' | translate }}
							</button>
						</div>
					}
				</div>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.groupDrawing' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Shape formatting -->
		<div class="flex flex-col items-center gap-0.5">
			<div class="flex items-center gap-1">
				<pptx-ribbon-color-popover
					[current]="fillColor()"
					[presets]="swatches"
					[disabled]="!canFormatShape()"
					titleKey="pptx.drawing.shapeFill"
					swatchAriaKey="pptx.ribbon.fillColourValue"
					(pick)="onFill($event)"
				>
					{{ 'pptx.drawing.shapeFill' | translate }}
				</pptx-ribbon-color-popover>
				<pptx-ribbon-color-popover
					[current]="outlineColor()"
					[presets]="swatches"
					[disabled]="!canFormatShape()"
					titleKey="pptx.drawing.shapeOutline"
					swatchAriaKey="pptx.ribbon.outlineColourValue"
					(pick)="onOutline($event)"
				>
					{{ 'pptx.drawing.shapeOutline' | translate }}
				</pptx-ribbon-color-popover>
				<!-- Shape Effects: genuinely unimplemented (React/Vue parity), left as a placeholder. -->
				<button
					type="button"
					class="pptx-rb-gb"
					disabled
					[title]="'pptx.drawing.shapeEffectsUnavailable' | translate"
				>
					{{ 'pptx.drawing.shapeEffectsUnavailable' | translate }}
				</button>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.groupShapeStyles' | translate }}
			</span>
		</div>
	`,
})
export class RibbonDrawingGroupComponent {
	protected readonly editor = inject(EditorStateService);

	readonly canEdit = input<boolean>(false);
	/** Index of the active slide (insertion target). */
	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);

	protected readonly shapes = TOP_SHAPES;
	protected readonly shapesOpen = signal(false);
	protected readonly arrangeOpen = signal(false);
	protected readonly swatches = RIBBON_SHAPE_SWATCHES;

	protected readonly canFormatShape = computed(() =>
		canFormatShapeSelection(this.canEdit(), this.selectedElement()),
	);
	protected readonly fillColor = computed(() => fillColorOf(this.selectedElement()));
	protected readonly outlineColor = computed(() => outlineColorOf(this.selectedElement()));

	/** Commit a picked Fill swatch through the shared decision function. */
	protected onFill(color: string): void {
		this.patchShapeStyle(shapeFillChange(color));
	}

	/** Commit a picked Outline swatch through the shared decision function. */
	protected onOutline(color: string): void {
		this.patchShapeStyle(shapeOutlineChange(color));
	}

	/** Merge a Fill/Outline patch into the selection's shape style, if it has one. */
	private patchShapeStyle(style: Partial<ShapeStyle>): void {
		const el = this.selectedElement(),
			patch = shapeStylePatch(el, style);
		if (!this.canFormatShape() || el === null || !patch) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), el.id, patch);
	}

	/** Insert the picked preset immediately (selects it and records history). */
	protected onShapeSelect(shape: ShapePresetDef): void {
		this.shapesOpen.set(false);
		this.editor.addElement(this.slideIndex(), newPresetShapeElement(shape.type, shape.label));
	}

	protected onArrange(direction: 'up' | 'down'): void {
		this.arrangeOpen.set(false);
		if (direction === 'up') {
			this.editor.bringSelectedForward(this.slideIndex());
			return;
		}
		this.editor.sendSelectedBackward(this.slideIndex());
	}

	/** Group or ungroup the selection, then close the menu. */
	protected onGroup(group: boolean): void {
		this.arrangeOpen.set(false);
		if (group) {
			this.editor.groupSelected(this.slideIndex());
			return;
		}
		this.editor.ungroupSelected(this.slideIndex());
	}

	protected onArrangeEdge(edge: 'front' | 'back'): void {
		this.arrangeOpen.set(false);
		if (edge === 'front') {
			this.editor.bringSelectedToFront(this.slideIndex());
			return;
		}
		this.editor.sendSelectedToBack(this.slideIndex());
	}
}
