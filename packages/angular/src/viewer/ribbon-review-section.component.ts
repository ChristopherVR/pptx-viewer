/**
 * ribbon-review-section.component.ts: the Review ribbon tab (Comments,
 * Accessibility, Compare, and the selection-gated Link action). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-review-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
		<button type="button" class="pptx-rb-pill" (click)="comments.emit()">
			{{ 'pptx.toolbar.comments' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[class.is-active]="spellCheckEnabled()"
			[attr.aria-pressed]="spellCheckEnabled()"
			[title]="'pptx.review.toggleSpellCheck' | translate"
			(click)="spellCheckChange.emit(!spellCheckEnabled())"
		>
			{{ 'pptx.review.spelling' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canEdit()"
			[title]="'pptx.ribbon.compareTitle' | translate"
			(click)="openCompare.emit()"
		>
			{{ 'pptx.ribbon.compare' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.review.languageTooltip' | translate"
			(click)="language.emit()"
		>
			{{ 'pptx.review.language' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.review.accessibilityCheckTooltip' | translate"
			(click)="a11y.emit()"
		>
			{{ 'pptx.review.accessibilityCheck' | translate }}
		</button>
		@if (hasSel()) {
			<button type="button" class="pptx-rb-pill" (click)="link.emit()">
				{{ 'pptx.ribbon.link' | translate }}
			</button>
		}
	`,
})
export class RibbonReviewSectionComponent {
	private readonly editor = inject(EditorStateService);

	readonly spellCheckEnabled = input(false);
	readonly canEdit = input(false);
	readonly comments = output<void>();
	readonly spellCheckChange = output<boolean>();
	readonly a11y = output<void>();
	readonly openCompare = output<void>();
	readonly language = output<void>();
	readonly link = output<void>();

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}
}
