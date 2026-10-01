import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	ElementRef,
	inject,
	input,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';

import type {
	PptxUiRibbonHomeElement,
	RibbonHomeRequestEvent,
	ShapePresetDef,
	ThemeColorPickerCommit,
} from '../internal/shared';
import {
	drawingHomeControls,
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
	host: { class: 'contents', '(document:mousedown)': 'onDocumentMouseDown($event)' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [
		TranslatePipe,
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
	protected readonly fillOpen = signal(false);
	protected readonly outlineOpen = signal(false);
	private readonly triggers = viewChild<ElementRef<PptxUiRibbonHomeElement>>('triggers');
	private readonly translation = inject(TranslateService, { optional: true });
	protected readonly swatches = RIBBON_SHAPE_SWATCHES;
	protected readonly arrangeCommands = ARRANGE_COMMANDS;

	protected readonly canFormatShape = computed(() =>
		canFormatShapeSelection(this.canEdit(), this.selectedElement()),
	);
	protected readonly fillColor = computed(() => fillColorOf(this.selectedElement()));
	protected readonly outlineColor = computed(() => outlineColorOf(this.selectedElement()));
	protected readonly fillColorRef = computed(() => fillColorRefOf(this.selectedElement()));
	protected readonly outlineColorRef = computed(() => outlineColorRefOf(this.selectedElement()));

	/** Shared trigger strip state; Fill/Outline additionally need a shape-capable selection. */
	protected drawingView() {
		const controls = drawingHomeControls({
			editable: this.canEdit(),
			hasSelection: this.editor.hasSelection(),
			open: {
				shapes: this.shapesOpen(),
				arrange: this.arrangeOpen(),
				fill: this.fillOpen(),
				outline: this.outlineOpen(),
			},
		});
		const noShape = !this.canFormatShape();
		return {
			controls: {
				...controls,
				'home.drawing.shapeFill': { ...controls['home.drawing.shapeFill'], disabled: noShape },
				'home.drawing.shapeOutline': {
					...controls['home.drawing.shapeOutline'],
					disabled: noShape,
				},
			},
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}

	/** Wrapper of a shared trigger, where its native popover hangs. */
	protected anchorOf(id: string): HTMLElement | null {
		return this.triggers()?.nativeElement.anchor(id) ?? null;
	}

	/** Toggle exactly one native popover per intent; the others close. */
	protected onRequest(event: Event): void {
		const id = (event as RibbonHomeRequestEvent).detail.id;
		const next = {
			'home.drawing.shapes': this.shapesOpen,
			'home.drawing.arrange': this.arrangeOpen,
			'home.drawing.shapeFill': this.fillOpen,
			'home.drawing.shapeOutline': this.outlineOpen,
		} as const;
		const target = next[id as keyof typeof next];
		if (!target) {
			return;
		}
		const open = !target();
		this.closePopups();
		target.set(open);
	}

	private closePopups(): void {
		this.shapesOpen.set(false);
		this.arrangeOpen.set(false);
		this.fillOpen.set(false);
		this.outlineOpen.set(false);
	}

	protected onDocumentMouseDown(event: MouseEvent): void {
		const target = event.target as Node | null;
		const element = target instanceof Element ? target : target?.parentElement;
		const anyOpen =
			this.shapesOpen() || this.arrangeOpen() || this.fillOpen() || this.outlineOpen();
		if (
			anyOpen &&
			!element?.closest('[data-pptx-home-popup]') &&
			!this.triggers()?.nativeElement.contains(element ?? null)
		) {
			this.closePopups();
		}
	}

	/** Commit a picked Fill swatch through the shared decision function; clears any stored ref. */
	protected onFill(color: string): void {
		this.patchShapeStyle(shapeFillChange(color));
		this.fillOpen.set(false);
	}

	/** Commit a picked Outline swatch through the shared decision function; clears any stored ref. */
	protected onOutline(color: string): void {
		this.patchShapeStyle(shapeOutlineChange(color));
		this.outlineOpen.set(false);
	}

	/** A theme-swatch Fill pick: commits BOTH the resolved hex and the ref. */
	protected onFillThemePick(commit: ThemeColorPickerCommit): void {
		this.patchShapeStyle(shapeFillChange(commit.hex, commit.ref));
		this.fillOpen.set(false);
	}

	/** A theme-swatch Outline pick: commits BOTH the resolved hex and the ref. */
	protected onOutlineThemePick(commit: ThemeColorPickerCommit): void {
		this.patchShapeStyle(shapeOutlineChange(commit.hex, commit.ref));
		this.outlineOpen.set(false);
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
