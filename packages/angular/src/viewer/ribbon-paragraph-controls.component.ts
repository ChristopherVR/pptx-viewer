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

/** Line spacing multiplier presets. */
const LINE_SPACING_OPTIONS = [1.0, 1.15, 1.5, 2.0, 2.5, 3.0];

/** Text direction presets (mirrors React/Vue). */
const TEXT_DIRECTION_OPTIONS = [
	{ label: 'Horizontal', value: 'horizontal' },
	{ label: 'Rotate 90\u00B0', value: 'vertical' },
	{ label: 'Rotate 270\u00B0', value: 'vertical270' },
	{ label: 'Stacked', value: 'wordArtVert' },
] as const;

/** Column count presets. */
const COLUMN_OPTIONS = [1, 2, 3];

@Component({
	selector: 'pptx-ribbon-paragraph-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
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
		<!-- Line Spacing -->
		<select
			class="pptx-rb-select w-14"
			[attr.aria-label]="'pptx.ribbon.lineSpacing' | translate"
			[disabled]="!isText()"
			(change)="setLineSpacing($event)"
		>
			@for (ls of lineSpacingOptions; track ls) {
				<option [value]="ls" [selected]="ls === curLineSpacing()">{{ ls }}</option>
			}
		</select>
		<!-- Text Direction -->
		<select
			class="pptx-rb-select w-24"
			[attr.aria-label]="'pptx.ribbon.textDirection' | translate"
			[disabled]="!isText()"
			(change)="setTextDirection($event)"
		>
			@for (dir of textDirectionOptions; track dir.value) {
				<option [value]="dir.value" [selected]="dir.value === curTextDirection()">
					{{ dir.label }}
				</option>
			}
		</select>
		<!-- Columns -->
		<select
			class="pptx-rb-select w-12"
			[attr.aria-label]="'pptx.ribbon.columns' | translate"
			[disabled]="!isText()"
			(change)="setColumns($event)"
		>
			@for (c of columnOptions; track c) {
				<option [value]="c" [selected]="c === curColumns()">{{ c }}</option>
			}
		</select>
	`,
})
export class RibbonParagraphControlsComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);

	protected readonly lineSpacingOptions = LINE_SPACING_OPTIONS;
	protected readonly textDirectionOptions = TEXT_DIRECTION_OPTIONS;
	protected readonly columnOptions = COLUMN_OPTIONS;

	protected isText(): boolean {
		return isTextElement(this.selectedElement());
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => textStyleOf(this.selectedElement()));

	/** Current line spacing multiplier. */
	protected curLineSpacing(): number {
		return this.curStyle()?.lineSpacing ?? 1.0;
	}
	/** Current text direction. */
	protected curTextDirection(): string {
		return this.curStyle()?.textDirection ?? 'horizontal';
	}
	/** Current column count. */
	protected curColumns(): number {
		return this.curStyle()?.columnCount ?? 1;
	}

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
	protected setLineSpacing(event: Event): void {
		this.patch({ lineSpacing: Number((event.target as HTMLSelectElement).value) });
	}
	protected setTextDirection(event: Event): void {
		this.patch({ textDirection: (event.target as HTMLSelectElement).value as 'horizontal' });
	}
	protected setColumns(event: Event): void {
		this.patch({ columnCount: Number((event.target as HTMLSelectElement).value) });
	}

	private patch(patch: Parameters<typeof patchTextStyle>[3]): void {
		patchTextStyle(this.editor, this.slideIndex(), this.selectedElement(), patch);
	}
}
