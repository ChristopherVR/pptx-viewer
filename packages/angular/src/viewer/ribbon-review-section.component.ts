/**
 * ribbon-review-section.component.ts: the Review ribbon tab (Proofing,
 * Accessibility, Language, Changes, Comments and Protect groups). Split out of
 * {@link RibbonComponent}.
 *
 * Several entries are rendered disabled rather than left out: Thesaurus,
 * Translate, Mark All Read, comment Delete/Previous/Next, and the three
 * Protect commands. None of them has a backend in this viewer yet, but a user
 * looking for "Restrict Permission" should find where it will be instead of
 * concluding the tab is broken, and every other binding lists them.
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
		<!-- Proofing -->
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
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.review.thesaurus' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Accessibility -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.review.accessibilityCheckTooltip' | translate"
			(click)="a11y.emit()"
		>
			{{ 'pptx.review.accessibilityCheck' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Language -->
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.review.translate' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.review.languageTooltip' | translate"
			(click)="language.emit()"
		>
			{{ 'pptx.review.language' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Changes -->
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.review.markAllRead' | translate }}
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
		<!-- Comments -->
		<button type="button" class="pptx-rb-pill" (click)="comments.emit()">
			{{ 'pptx.toolbar.comments' | translate }}
		</button>
		<div class="flex flex-col justify-center gap-0.5">
			<button type="button" class="pptx-rb-toggle" disabled>
				{{ 'pptx.common.delete' | translate }}
			</button>
			<button type="button" class="pptx-rb-toggle" disabled>
				{{ 'pptx.common.previous' | translate }}
			</button>
		</div>
		<div class="flex flex-col justify-center gap-0.5">
			<button type="button" class="pptx-rb-toggle" disabled>
				{{ 'pptx.common.next' | translate }}
			</button>
			<button type="button" class="pptx-rb-toggle hover:bg-accent" (click)="comments.emit()">
				{{ 'pptx.review.showComments' | translate }}
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Protect -->
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.review.readOnly' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.review.restrictPermission' | translate }}
		</button>
		<button type="button" class="pptx-rb-pill" disabled>
			{{ 'pptx.review.hideInk' | translate }}
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
