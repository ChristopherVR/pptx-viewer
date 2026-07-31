/**
 * tags-card.component.ts: the TAGS card of the default (no-selection)
 * inspector, mirroring React's `inspector/TagsSection.tsx`: a collapsed
 * disclosure showing the tag count, expanding to editable name/value rows.
 *
 * Selector: `pptx-tags-card`
 *
 * WHY this matters: `ppt/tags/*.xml` is how add-ins and automation stamp
 * machine-readable data onto a deck. Core already round-trips the part, and
 * `LoadContentService` now passes it back through save, so this card is the
 * surface that makes those values editable instead of merely preserved.
 *
 * All the list surgery lives in the shared `tag-collections` module: a tag has
 * a two-level address (which collection, then which tag inside it) while the UI
 * shows one flat list, and that mapping must not be retyped per binding.
 *
 * @module viewer/tags-card
 */
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxTagCollection } from 'pptx-viewer-core';

import {
	addTagToCollections,
	deleteTagFromCollections,
	flattenTagCollections,
	updateTagInCollections,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-tags-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<button
				type="button"
				class="tags__toggle"
				[attr.aria-expanded]="!collapsed()"
				(click)="toggle()"
			>
				<span aria-hidden="true">{{ collapsed() ? '&#9656;' : '&#9662;' }}</span>
				<h3 class="icard__heading">{{ 'pptx.tags.title' | translate }}</h3>
				<span class="icard__value">{{ rows().length }}</span>
			</button>

			@if (!collapsed()) {
				@if (rows().length === 0) {
					<span class="icard__label">{{ 'pptx.tags.noTags' | translate }}</span>
				}
				@for (row of rows(); track row.colIdx + ':' + row.tagIdx) {
					<div class="tags__row">
						<input
							type="text"
							class="icard__input"
							[disabled]="!canEdit()"
							[attr.aria-label]="'pptx.tags.name' | translate"
							[attr.placeholder]="'pptx.tags.name' | translate"
							[value]="row.name"
							(change)="onFieldChange($event, row.colIdx, row.tagIdx, 'name')"
						/>
						<input
							type="text"
							class="icard__input"
							[disabled]="!canEdit()"
							[attr.aria-label]="'pptx.tags.value' | translate"
							[attr.placeholder]="'pptx.tags.value' | translate"
							[value]="row.value"
							(change)="onFieldChange($event, row.colIdx, row.tagIdx, 'value')"
						/>
						@if (canEdit()) {
							<button
								type="button"
								class="icard__btn icard__btn--danger"
								[title]="'pptx.tags.deleteTag' | translate"
								[attr.aria-label]="'pptx.tags.deleteTag' | translate"
								(click)="onDelete(row.colIdx, row.tagIdx)"
							>
								&times;
							</button>
						}
					</div>
				}
				@if (canEdit()) {
					<button type="button" class="icard__btn" (click)="onAdd()">
						{{ 'pptx.tags.addTag' | translate }}
					</button>
				}
			}
		</section>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.tags__toggle {
				display: flex;
				align-items: center;
				gap: 6px;
				width: 100%;
				padding: 0;
				border: none;
				background: transparent;
				color: inherit;
				font: inherit;
				text-align: left;
				cursor: pointer;
			}
			.tags__toggle .icard__value {
				margin-left: auto;
			}
			.tags__row {
				display: grid;
				grid-template-columns: 1fr 1fr auto;
				gap: 4px;
			}
		`,
		INSPECTOR_CARD_STYLES,
	],
})
export class TagsCardComponent {
	/** Whether mutation controls are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);

	/** Collapsed by default, matching React's TagsSection initial state. */
	protected readonly collapsed = signal(true);

	protected readonly rows = computed(() => flattenTagCollections(this.loader.tagCollections()));

	protected toggle(): void {
		this.collapsed.update((value) => !value);
	}

	protected onFieldChange(
		event: Event,
		colIdx: number,
		tagIdx: number,
		field: 'name' | 'value',
	): void {
		const next = (event.target as HTMLInputElement).value;
		this.commit(updateTagInCollections(this.loader.tagCollections(), colIdx, tagIdx, field, next));
	}

	protected onDelete(colIdx: number, tagIdx: number): void {
		this.commit(deleteTagFromCollections(this.loader.tagCollections(), colIdx, tagIdx));
	}

	protected onAdd(): void {
		this.commit(addTagToCollections(this.loader.tagCollections()));
	}

	/**
	 * Tags live outside the slide list, so they are not part of the slide undo
	 * stack; writing the loader signal and flagging the deck dirty is the same
	 * path the DOCUMENT properties card uses.
	 */
	private commit(next: PptxTagCollection[]): void {
		this.loader.tagCollections.set(next);
		this.editor.dirty.set(true);
	}
}
