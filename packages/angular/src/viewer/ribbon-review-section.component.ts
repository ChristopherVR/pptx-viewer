import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	Input,
	output,
	signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { buildReviewRibbon } from '../internal/shared';
import type { RibbonCommandRequestEvent } from '../internal/shared';

@Component({
	selector: 'pptx-ribbon-review-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-section [groups]="groups()" (command-request)="request($event)" />`,
})
export class RibbonReviewSectionComponent {
	private readonly translator = inject(TranslateService);
	private readonly state = signal({ spellCheck: false, editable: false });
	@Input() get spellCheckEnabled(): boolean {
		return this.state().spellCheck;
	}
	set spellCheckEnabled(value: boolean) {
		this.state.update((state) => ({ ...state, spellCheck: value }));
	}
	@Input() get canEdit(): boolean {
		return this.state().editable;
	}
	set canEdit(value: boolean) {
		this.state.update((state) => ({ ...state, editable: value }));
	}
	readonly comments = output<void>();
	readonly spellCheckChange = output<boolean>();
	readonly a11y = output<void>();
	readonly openCompare = output<void>();
	readonly language = output<void>();
	readonly link = output<void>();
	readonly groups = computed(() =>
		buildReviewRibbon((key) => this.translator.instant(key) as string, {
			editable: this.canEdit,
			spellCheck: this.spellCheckEnabled,
			canAccessibility: true,
			canLanguage: true,
			canCompare: true,
			canComments: true,
		}),
	);
	protected request(event: Event): void {
		switch ((event as RibbonCommandRequestEvent).detail.id) {
			case 'review.proofing.spelling':
				this.spellCheckChange.emit(!this.spellCheckEnabled);
				break;
			case 'review.accessibility.check':
				this.a11y.emit();
				break;
			case 'review.language.language':
				this.language.emit();
				break;
			case 'review.compare.compare':
				if (this.canEdit) {
					this.openCompare.emit();
				}
				break;
			case 'review.comments.newComment':
			case 'review.comments.showComments':
				this.comments.emit();
				break;
		}
	}
}
