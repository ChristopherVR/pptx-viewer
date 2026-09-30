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
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
	LucideAlignHorizontalSpaceAround,
	LucideAlignVerticalSpaceAround,
	LucideChevronDown,
	LucideChevronUp,
	LucideTextAlignCenter,
	LucideTextAlignEnd,
	LucideTextAlignStart,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { ToolbarActionId } from '../internal/shared';
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
		LucideTextAlignStart,
		LucideTextAlignCenter,
		LucideTextAlignEnd,
		LucideChevronUp,
		LucideChevronDown,
		LucideAlignHorizontalSpaceAround,
		LucideAlignVerticalSpaceAround,
		RibbonShapeExtrasComponent,
		RibbonMergeShapesComponent,
		RibbonCropComponent,
	],
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
