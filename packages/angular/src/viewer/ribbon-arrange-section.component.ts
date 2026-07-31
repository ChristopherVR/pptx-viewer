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
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
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

import { EditorStateService } from './editor-state.service';
import { RibbonShapeExtrasComponent } from './ribbon-shape-extras.component';

@Component({
	selector: 'pptx-ribbon-arrange-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
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
	],
	template: `
		<!-- Order -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.bringToFront' | translate"
				(click)="editor.bringSelectedToFront(slideIndex())"
			>
				{{ 'pptx.arrange.front' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.sendToBack' | translate"
				(click)="editor.sendSelectedToBack(slideIndex())"
			>
				{{ 'pptx.arrange.back' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.bringForward' | translate"
				[attr.aria-label]="'pptx.arrange.bringForward' | translate"
				(click)="editor.bringSelectedForward(slideIndex())"
			>
				{{ 'pptx.ribbon.fwd' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.sendBackward' | translate"
				[attr.aria-label]="'pptx.arrange.sendBackward' | translate"
				(click)="editor.sendSelectedBackward(slideIndex())"
			>
				{{ 'pptx.ribbon.bwd' | translate }}
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Align -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignLeft' | translate"
				(click)="editor.alignSelected(slideIndex(), 'left')"
			>
				<svg lucideTextAlignStart class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignCenter' | translate"
				(click)="editor.alignSelected(slideIndex(), 'centerH')"
			>
				<svg lucideTextAlignCenter class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignRight' | translate"
				(click)="editor.alignSelected(slideIndex(), 'right')"
			>
				<svg lucideTextAlignEnd class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignTop' | translate"
				(click)="editor.alignSelected(slideIndex(), 'top')"
			>
				<svg lucideChevronUp class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignMiddle' | translate"
				(click)="editor.alignSelected(slideIndex(), 'middle')"
			>
				<svg lucideTextAlignCenter class="h-4 w-4 rotate-90"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignBottom' | translate"
				(click)="editor.alignSelected(slideIndex(), 'bottom')"
			>
				<svg lucideChevronDown class="h-4 w-4"></svg>
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Distribute -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!canDistribute()"
				[title]="'pptx.arrange.distributeHorizontal' | translate"
				(click)="editor.distributeSelected(slideIndex(), 'horizontal')"
			>
				<svg lucideAlignHorizontalSpaceAround class="h-4 w-4"></svg>
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!canDistribute()"
				[title]="'pptx.arrange.distributeVertical' | translate"
				(click)="editor.distributeSelected(slideIndex(), 'vertical')"
			>
				<svg lucideAlignVerticalSpaceAround class="h-4 w-4"></svg>
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Format painter + flip -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				data-testid="format-painter-toggle"
				[attr.data-active]="formatPainterActive() ? 'true' : 'false'"
				[ngClass]="formatPainterActive() ? 'bg-primary text-primary-foreground' : ''"
				[disabled]="!canActivateFormatPainter() && !formatPainterActive()"
				[title]="'pptx.arrange.formatPainter' | translate"
				(click)="toggleFormatPainter.emit()"
			>
				{{ 'pptx.arrange.format' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.flipHorizontally' | translate"
				(click)="flipSelected('horizontal')"
			>
				{{ 'pptx.arrange.flipH' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.flipVertically' | translate"
				(click)="flipSelected('vertical')"
			>
				{{ 'pptx.arrange.flipV' | translate }}
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Group / ungroup / outline width -->
		<pptx-ribbon-shape-extras
			[slideIndex]="slideIndex()"
			[selectedElement]="selectedElement()"
			[canEdit]="canEdit()"
		/>
		<span class="pptx-rb-sep"></span>
		<!-- Duplicate / delete -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.duplicate' | translate"
				(click)="editor.duplicateSelected(slideIndex())"
			>
				{{ 'pptx.arrange.duplicate' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.delete' | translate"
				(click)="editor.deleteSelected(slideIndex())"
			>
				{{ 'pptx.arrange.delete' | translate }}
			</button>
		</div>
	`,
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
