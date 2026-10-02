import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';

import type { RibbonHomeRequestEvent } from '../internal/shared';
import {
	drawingHomeControls,
	homeGalleryApply,
	homeGalleryControls,
	SHAPE_PRESET_DEFS,
	shapeFillChange,
	shapeOutlineChange,
	withHomeGalleries,
} from '../internal/shared';
import { newPresetShapeElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { RecentColorsService } from './recent-colors.service';
import {
	canFormatShapeSelection,
	fillColorOf,
	fillColorRefOf,
	outlineColorOf,
	outlineColorRefOf,
	shapeStylePatch,
} from './ribbon-drawing-group-helpers';
import { dispatchGalleryResult, galleryContextFor } from './ribbon-gallery-helpers';
import { homeLanguage, homeTranslator } from './ribbon-home-lang';
import { ViewerThemeGalleryService } from './viewer-theme-gallery.service';
/**
 * ribbon-drawing-group.component.ts: Drawing group for the Home tab ribbon, a
 * thin adapter around `pptx-ui-ribbon-home-drawing`, which renders the Shapes
 * and Arrange menus, the Fill/Outline colour popovers and the Quick Styles
 * and Shape Effects galleries. This component reflects the selection into it
 * and runs each typed intent through the editor.
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

@Component({
	selector: 'pptx-ribbon-drawing-group',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [TranslatePipe],
	templateUrl: './ribbon-drawing-group.component.html',
})
export class RibbonDrawingGroupComponent {
	protected readonly editor = inject(EditorStateService);
	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly themes = inject(ViewerThemeGalleryService, { optional: true });
	private readonly recentColors = inject(RecentColorsService, { optional: true });
	private readonly translation = inject(TranslateService, { optional: true });
	private readonly language = homeLanguage(this.translation);

	readonly canEdit = input<boolean>(false);
	/** Index of the active slide (insertion target). */
	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);

	protected readonly canFormatShape = computed(() =>
		canFormatShapeSelection(this.canEdit(), this.selectedElement()),
	);
	protected readonly fillColor = computed(() => fillColorOf(this.selectedElement()));
	protected readonly outlineColor = computed(() => outlineColorOf(this.selectedElement()));
	protected readonly fillColorRef = computed(() => fillColorRefOf(this.selectedElement()));
	protected readonly outlineColorRef = computed(() => outlineColorRefOf(this.selectedElement()));

	/** Shared state; Fill/Outline additionally need a shape-capable selection. */
	protected drawingView() {
		const themeColors = this.loader?.themeColorMap();
		const recent = this.recentColors?.recent();
		const base = drawingHomeControls({
			editable: this.canEdit(),
			hasSelection: this.editor.hasSelection(),
			fill: { value: this.fillColor(), ref: this.fillColorRef(), themeColors, recent },
			outline: { value: this.outlineColor(), ref: this.outlineColorRef(), themeColors, recent },
		});
		const noShape = !this.canFormatShape();
		const gated = {
			...base,
			'home.drawing.shapeFill': { ...base['home.drawing.shapeFill'], disabled: noShape },
			'home.drawing.shapeOutline': { ...base['home.drawing.shapeOutline'], disabled: noShape },
		};
		return {
			controls: withHomeGalleries(
				gated,
				homeGalleryControls('drawing', this.galleryContext(), this.canEdit()),
				this.canEdit(),
			),
			translate: homeTranslator(this.translation, this.language, ['drawing']),
		};
	}

	private galleryContext() {
		return galleryContextFor(this.selectedElement(), this.loader);
	}

	protected onRequest(event: Event): void {
		const { id, value, ref } = (event as RibbonHomeRequestEvent).detail;
		switch (id) {
			case 'home.drawing.shapes':
				this.onShapeSelect(String(value));
				break;
			case 'home.drawing.arrange':
				this.onArrangeCommand(String(value));
				break;
			case 'home.drawing.shapeFill':
				this.patchShapeStyle(shapeFillChange(String(value), ref));
				this.recentColors?.push(String(value));
				break;
			case 'home.drawing.shapeOutline':
				this.patchShapeStyle(shapeOutlineChange(String(value), ref));
				this.recentColors?.push(String(value));
				break;
			default:
				dispatchGalleryResult(
					homeGalleryApply('drawing', id, String(value), this.galleryContext()) ?? null,
					{ editor: this.editor, slideIndex: this.slideIndex(), themes: this.themes },
				);
		}
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
	protected onShapeSelect(type: string): void {
		const shape = SHAPE_PRESET_DEFS.find((preset) => preset.type === type);
		if (shape) {
			this.editor.addElement(this.slideIndex(), newPresetShapeElement(shape.type, shape.label));
		}
	}

	protected onArrangeCommand(command: string): void {
		const slide = this.slideIndex();
		switch (command) {
			case 'forward':
				this.editor.bringSelectedForward(slide);
				break;
			case 'backward':
				this.editor.sendSelectedBackward(slide);
				break;
			case 'front':
				this.editor.bringSelectedToFront(slide);
				break;
			case 'back':
				this.editor.sendSelectedToBack(slide);
		}
	}
}
