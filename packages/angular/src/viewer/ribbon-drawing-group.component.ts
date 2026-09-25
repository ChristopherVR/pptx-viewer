/**
 * ribbon-drawing-group.component.ts: Drawing group for the Home tab ribbon.
 * Shape insertion, the Arrange menu (incl. Group / Ungroup, where PowerPoint
 * puts them), Fill/Outline colour pickers, and the shared Quick Styles (Shape
 * Styles) and Shape Effects galleries (`FIXED_TAB_GALLERIES`), which replaced
 * the old disabled Shape Effects placeholder.
 *
 * Shape picks insert straight through {@link EditorStateService} (selected,
 * dirty, undoable), from the first 12 entries of the shared
 * {@link SHAPE_PRESET_DEFS}. Fill/Outline commit through shared
 * `shapeFillChange` / `shapeOutlineChange` (also for theme swatches, which
 * carry the `PptxThemeColorRef` so the colour follows later theme changes),
 * so the keys written cannot drift from the other bindings.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { LucideChevronDown } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';

import type { ShapePresetDef, ThemeColorPickerCommit } from '../internal/shared';
import {
	RIBBON_SHAPE_SWATCHES,
	SHAPE_PRESET_DEFS,
	shapeFillChange,
	shapeOutlineChange,
} from '../internal/shared';
import { AnchoredPopupDirective } from './anchored-popup.directive';
import { newPresetShapeElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { RibbonColorPopoverComponent } from './ribbon-color-popover.component';
import {
	canFormatShapeSelection,
	fillColorOf,
	fillColorRefOf,
	outlineColorOf,
	outlineColorRefOf,
	shapeStylePatch,
} from './ribbon-drawing-group-helpers';
import { RibbonGalleryComponent } from './ribbon-gallery.component';

// Re-exported for the existing test import surface (`./ribbon-drawing-group.component`).
export {
	canFormatShapeSelection,
	fillColorOf,
	fillColorRefOf,
	outlineColorOf,
	outlineColorRefOf,
	shapeStylePatch,
} from './ribbon-drawing-group-helpers';

type ArrangeCommandId = 'up' | 'down' | 'front' | 'back' | 'group' | 'ungroup';

/** Home > Drawing > Arrange menu entries, in PowerPoint's order. */
const ARRANGE_COMMANDS: ReadonlyArray<{ id: ArrangeCommandId; key: string }> = [
	{ id: 'up', key: 'pptx.arrange.bringForward' },
	{ id: 'down', key: 'pptx.arrange.sendBackward' },
	{ id: 'front', key: 'pptx.arrange.bringToFront' },
	{ id: 'back', key: 'pptx.arrange.sendToBack' },
	{ id: 'group', key: 'pptx.ribbon.group' },
	{ id: 'ungroup', key: 'pptx.ribbon.ungroup' },
];

/** The quick "top shapes" row shared with React's toolbar (first 12 presets). */
const TOP_SHAPES: readonly ShapePresetDef[] = SHAPE_PRESET_DEFS.slice(0, 12);

@Component({
	selector: 'pptx-ribbon-drawing-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		TranslatePipe,
		LucideChevronDown,
		RibbonColorPopoverComponent,
		RibbonGalleryComponent,
		AnchoredPopupDirective,
	],
	template: `
		<div class="contents" data-ribbon-group="home.drawing">
			<!-- Shapes -->
			<div class="flex flex-col items-center gap-0.5">
				<div class="pptx-rb-grp">
					<div class="relative" data-ribbon-control="home.drawing.shapes">
						<button
							#shapesTrigger
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
								class="z-50 mt-0.5 grid grid-cols-4 gap-0.5 rounded border border-border bg-popover p-1 shadow-md"
								[pptxAnchoredPopup]="shapesTrigger"
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
					<div class="relative" data-ribbon-control="home.drawing.arrange">
						<button
							#arrangeTrigger
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
								class="z-50 mt-0.5 flex flex-col rounded border border-border bg-popover p-1 shadow-md"
								[pptxAnchoredPopup]="arrangeTrigger"
							>
								@for (cmd of arrangeCommands; track cmd.key) {
									@if (cmd.id === 'group') {
										<span class="my-0.5 block h-px bg-border"></span>
									}
									<button
										type="button"
										class="whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent"
										(click)="onArrangeCommand(cmd.id)"
									>
										{{ cmd.key | translate }}
									</button>
								}
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
					<pptx-ribbon-gallery
						gallery="shapeStyles"
						control="home.drawing.quickStyles"
						[element]="selectedElement()"
						[slideIndex]="slideIndex()"
						[canEdit]="canEdit()"
					/>
					<pptx-ribbon-color-popover
						data-ribbon-control="home.drawing.shapeFill"
						[current]="fillColor()"
						[currentRef]="fillColorRef()"
						[showThemeColors]="true"
						[presets]="swatches"
						[disabled]="!canFormatShape()"
						titleKey="pptx.drawing.shapeFill"
						swatchAriaKey="pptx.ribbon.fillColourValue"
						(pick)="onFill($event)"
						(pickThemeColor)="onFillThemePick($event)"
					>
						{{ 'pptx.drawing.shapeFill' | translate }}
					</pptx-ribbon-color-popover>
					<pptx-ribbon-color-popover
						data-ribbon-control="home.drawing.shapeOutline"
						[current]="outlineColor()"
						[currentRef]="outlineColorRef()"
						[showThemeColors]="true"
						[presets]="swatches"
						[disabled]="!canFormatShape()"
						titleKey="pptx.drawing.shapeOutline"
						swatchAriaKey="pptx.ribbon.outlineColourValue"
						(pick)="onOutline($event)"
						(pickThemeColor)="onOutlineThemePick($event)"
					>
						{{ 'pptx.drawing.shapeOutline' | translate }}
					</pptx-ribbon-color-popover>
					<pptx-ribbon-gallery
						gallery="shapeEffects"
						control="home.drawing.shapeEffects"
						[element]="selectedElement()"
						[slideIndex]="slideIndex()"
						[canEdit]="canEdit()"
					/>
				</div>
				<span class="text-[9px] leading-none text-muted-foreground">
					{{ 'pptx.ribbon.groupShapeStyles' | translate }}
				</span>
			</div>
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
	protected readonly arrangeCommands = ARRANGE_COMMANDS;

	protected readonly canFormatShape = computed(() =>
		canFormatShapeSelection(this.canEdit(), this.selectedElement()),
	);
	protected readonly fillColor = computed(() => fillColorOf(this.selectedElement()));
	protected readonly outlineColor = computed(() => outlineColorOf(this.selectedElement()));
	protected readonly fillColorRef = computed(() => fillColorRefOf(this.selectedElement()));
	protected readonly outlineColorRef = computed(() => outlineColorRefOf(this.selectedElement()));

	/** Commit a picked Fill swatch through the shared decision function; clears any stored ref. */
	protected onFill(color: string): void {
		this.patchShapeStyle(shapeFillChange(color));
	}

	/** Commit a picked Outline swatch through the shared decision function; clears any stored ref. */
	protected onOutline(color: string): void {
		this.patchShapeStyle(shapeOutlineChange(color));
	}

	/** A theme-swatch Fill pick: commits BOTH the resolved hex and the ref. */
	protected onFillThemePick(commit: ThemeColorPickerCommit): void {
		this.patchShapeStyle(shapeFillChange(commit.hex, commit.ref));
	}

	/** A theme-swatch Outline pick: commits BOTH the resolved hex and the ref. */
	protected onOutlineThemePick(commit: ThemeColorPickerCommit): void {
		this.patchShapeStyle(shapeOutlineChange(commit.hex, commit.ref));
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

	protected onArrangeCommand(id: ArrangeCommandId): void {
		if (id === 'up' || id === 'down') {
			this.onArrange(id);
		} else if (id === 'front' || id === 'back') {
			this.onArrangeEdge(id);
		} else {
			this.onGroup(id === 'group');
		}
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
