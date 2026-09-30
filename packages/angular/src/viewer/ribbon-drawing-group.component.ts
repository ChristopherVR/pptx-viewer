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
import { RibbonIconDirective } from './ribbon-icon.directive';

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
		RibbonIconDirective,
		TranslatePipe,
		LucideChevronDown,
		RibbonColorPopoverComponent,
		RibbonGalleryComponent,
		AnchoredPopupDirective,
	],
	templateUrl: './ribbon-drawing-group.component.html',
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
