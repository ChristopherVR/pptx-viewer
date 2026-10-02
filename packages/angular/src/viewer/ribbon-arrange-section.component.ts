/**
 * ribbon-arrange-section.component.ts: the Arrange ribbon group (Order, Align,
 * Distribute, Format painter + flip, Group / ungroup / outline width, Duplicate
 * / Delete). Rendered both by the dedicated Arrange tab and at the end of the
 * Home tab. Actions bind straight to the shared {@link EditorStateService}.
 *
 * It carries no Cut / Copy / Paste of its own. It used to, which made the Home
 * tab offer each of the three twice: once here and once in the Clipboard group
 * that {@link RibbonHomeSectionComponent} renders a few centimetres to the
 * left. One command, one place per tab.
 */
import { NgClass } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { RibbonHomeRequestEvent, ToolbarActionId } from '../internal/shared';
import { arrangeAlignAction, arrangeHomeControls } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { RibbonCropComponent } from './ribbon-crop.component';
import { RibbonIconDirective } from './ribbon-icon.directive';
import { RibbonMergeShapesComponent } from './ribbon-merge-shapes.component';
import { RibbonShapeExtrasComponent } from './ribbon-shape-extras.component';
import { toolbarVisibility } from './toolbar-visibility';

@Component({
	selector: 'pptx-ribbon-arrange-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		RibbonIconDirective,
		NgClass,
		TranslatePipe,
		RibbonShapeExtrasComponent,
		RibbonMergeShapesComponent,
		RibbonCropComponent,
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	templateUrl: './ribbon-arrange-section.component.html',
})
export class RibbonArrangeSectionComponent {
	protected readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	/** The active selection, which gates Ungroup and the outline-width spinner. */
	readonly selectedElement = input<PptxElement | null>(null);
	/** Whether the deck is editable; a read-only deck cannot group or restyle. */
	readonly canEdit = input<boolean>(false);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);
	/** Toolbar buttons the host hides (gates Merge Shapes and Crop). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	protected readonly toolbar = toolbarVisibility(computed(() => this.hiddenActions()));

	readonly toggleFormatPainter = output<void>();

	private readonly translation = inject(TranslateService, { optional: true });

	/** Shared strip state: one selection and edit-rights gate for align, flip, order and edit. */
	protected arrangeView() {
		return {
			controls: arrangeHomeControls({
				editable: this.canEdit(),
				hasSelection: this.hasSel(),
				canDistribute: this.canDistribute(),
			}),
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}

	protected onAlign(event: Event): void {
		const action = arrangeAlignAction((event as RibbonHomeRequestEvent).detail.part);
		if (action?.kind === 'align') {
			this.editor.alignSelected(this.slideIndex(), action.edge);
		} else if (action?.kind === 'distribute') {
			this.editor.distributeSelected(this.slideIndex(), action.axis);
		}
	}

	protected onFlip(event: Event): void {
		this.flipSelected(
			(event as RibbonHomeRequestEvent).detail.id === 'home.arrange.flipHorizontal'
				? 'horizontal'
				: 'vertical',
		);
	}

	protected onOrder(event: Event): void {
		const slide = this.slideIndex();
		switch ((event as RibbonHomeRequestEvent).detail.id) {
			case 'home.arrange.sendBackward':
				this.editor.sendSelectedBackward(slide);
				break;
			case 'home.arrange.bringForward':
				this.editor.bringSelectedForward(slide);
				break;
			case 'home.arrange.sendToBack':
				this.editor.sendSelectedToBack(slide);
				break;
			case 'home.arrange.bringToFront':
				this.editor.bringSelectedToFront(slide);
		}
	}

	protected onEdit(event: Event): void {
		if ((event as RibbonHomeRequestEvent).detail.id === 'home.arrange.duplicate') {
			this.editor.duplicateSelected(this.slideIndex());
		} else {
			this.editor.deleteSelected(this.slideIndex());
		}
	}

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	protected canDistribute(): boolean {
		return this.editor.selectedIds().length >= 3;
	}

	/** Toggle horizontal/vertical flip on each selected element. */
	protected flipSelected(axis: 'horizontal' | 'vertical'): void {
		const idx = this.slideIndex();
		const slide = this.editor.slides()[idx];
		if (!slide) {
			return;
		}
		for (const id of this.editor.selectedIds()) {
			const el = slide.elements.find((e) => e.id === id);
			if (!el) {
				continue;
			}
			const patch: Partial<PptxElement> =
				axis === 'horizontal'
					? ({ flipHorizontal: !el.flipHorizontal } as Partial<PptxElement>)
					: ({ flipVertical: !el.flipVertical } as Partial<PptxElement>);
			this.editor.updateElement(idx, id, patch);
		}
	}
}
