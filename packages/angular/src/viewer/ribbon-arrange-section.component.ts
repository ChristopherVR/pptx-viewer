/**
 * ribbon-arrange-section.component.ts: the Arrange ribbon tab (Order, Align,
 * Distribute, Clipboard, Format painter + flip, Group / edit). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged. Actions bind
 * straight to the shared {@link EditorStateService}.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-arrange-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
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
				(click)="editor.bringSelectedForward(slideIndex())"
			>
				{{ 'pptx.ribbon.fwd' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.sendBackward' | translate"
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
				⇤
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignCenter' | translate"
				(click)="editor.alignSelected(slideIndex(), 'centerH')"
			>
				⇔
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignRight' | translate"
				(click)="editor.alignSelected(slideIndex(), 'right')"
			>
				⇥
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignTop' | translate"
				(click)="editor.alignSelected(slideIndex(), 'top')"
			>
				⤒
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignMiddle' | translate"
				(click)="editor.alignSelected(slideIndex(), 'middle')"
			>
				⇕
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.alignBottom' | translate"
				(click)="editor.alignSelected(slideIndex(), 'bottom')"
			>
				⤓
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Distribute -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!canDistribute()"
				[title]="'pptx.ribbon.distributeHorizontally' | translate"
				(click)="editor.distributeSelected(slideIndex(), 'horizontal')"
			>
				&#x2194; H
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!canDistribute()"
				[title]="'pptx.ribbon.distributeVertically' | translate"
				(click)="editor.distributeSelected(slideIndex(), 'vertical')"
			>
				&#x2195; V
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Clipboard -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.copy' | translate"
				(click)="editor.copySelected(slideIndex())"
			>
				{{ 'pptx.arrange.copy' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.arrange.cut' | translate"
				(click)="editor.cutSelected(slideIndex())"
			>
				{{ 'pptx.arrange.cut' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[title]="'pptx.arrange.paste' | translate"
				(click)="editor.paste(slideIndex())"
			>
				{{ 'pptx.arrange.paste' | translate }}
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
				{{ 'pptx.ribbon.painter' | translate }}
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
		<!-- Group / edit -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.group' | translate"
				(click)="editor.groupSelected(slideIndex())"
			>
				{{ 'pptx.ribbon.group' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!hasSel()"
				[title]="'pptx.ribbon.ungroup' | translate"
				(click)="editor.ungroupSelected(slideIndex())"
			>
				{{ 'pptx.ribbon.ungroup' | translate }}
			</button>
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
