/**
 * ribbon-paragraph-controls.component.ts: the ribbon's reusable Paragraph control
 * group (bullet/numbered lists, indent/outdent, and alignment). Split out of
 * {@link RibbonComponent}'s `paragraphControls` ng-template so the Home and Text
 * tabs share one implementation. Behaviour and markup are unchanged.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { isTextElement, patchTextStyle, textStyleOf } from './ribbon-text-helpers';

@Component({
	selector: 'pptx-ribbon-paragraph-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, TranslatePipe],
	template: `
		<!-- List style: bullets + numbering -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.listType === 'bullet' ? 'bg-accent' : ''"
				[title]="'pptx.ribbon.bulletList' | translate"
				(click)="toggleList('bullet')"
			>
				•≡
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.listType === 'numbered' ? 'bg-accent' : ''"
				[title]="'pptx.notes.numberedList' | translate"
				(click)="toggleList('numbered')"
			>
				1.≡
			</button>
		</div>
		<!-- Indent: outdent + indent -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[title]="'pptx.notes.outdent' | translate"
				(click)="changeIndent(-24)"
			>
				⇤
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!isText()"
				[title]="'pptx.notes.indent' | translate"
				(click)="changeIndent(24)"
			>
				⇥
			</button>
		</div>
		<!-- Alignment -->
		<div class="pptx-rb-grp">
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.align === 'left' ? 'bg-accent' : ''"
				[title]="'pptx.ribbon.alignLeft' | translate"
				(click)="setAlign('left')"
			>
				⯇
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.align === 'center' ? 'bg-accent' : ''"
				[title]="'pptx.ribbon.alignCenter' | translate"
				(click)="setAlign('center')"
			>
				≡
			</button>
			<button
				type="button"
				class="pptx-rb-gb"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.align === 'right' ? 'bg-accent' : ''"
				[title]="'pptx.ribbon.alignRight' | translate"
				(click)="setAlign('right')"
			>
				⯈
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[disabled]="!isText()"
				[ngClass]="curStyle()?.align === 'justify' ? 'bg-accent' : ''"
				[title]="'pptx.ribbon.justify' | translate"
				(click)="setAlign('justify')"
			>
				☰
			</button>
		</div>
	`,
})
export class RibbonParagraphControlsComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);

	protected isText(): boolean {
		return isTextElement(this.selectedElement());
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => textStyleOf(this.selectedElement()));

	/** Toggle the paragraph list style (bullet / numbered) off when already set. */
	protected toggleList(kind: 'bullet' | 'numbered'): void {
		this.patch({ listType: this.curStyle()?.listType === kind ? 'none' : kind });
	}
	/** Step the paragraph left-indent by `deltaPx` (clamped at 0). */
	protected changeIndent(deltaPx: number): void {
		const current = this.curStyle()?.paragraphMarginLeft ?? 0;
		this.patch({ paragraphMarginLeft: Math.max(0, current + deltaPx) });
	}
	protected setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
		this.patch({ align });
	}

	private patch(patch: Parameters<typeof patchTextStyle>[3]): void {
		patchTextStyle(this.editor, this.slideIndex(), this.selectedElement(), patch);
	}
}
