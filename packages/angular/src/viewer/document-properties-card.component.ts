/**
 * document-properties-card.component.ts: DOCUMENT card of the default
 * (no-selection) inspector, mirroring React's `DocumentPropertiesCard`
 * (DocumentPropertiesCards.tsx): title / author / company / application text
 * fields plus the editable custom-properties list.
 *
 * Edits patch the loader's `coreProperties` / `appProperties` /
 * `customProperties` signals and mark the editor dirty.
 */
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxAppProperties, PptxCoreProperties, PptxCustomProperty } from 'pptx-viewer-core';

import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';

@Component({
	selector: 'pptx-document-properties-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<section class="icard">
			<h3 class="icard__heading">{{ 'pptx.documentProperties.documentHeading' | translate }}</h3>
			<label class="icard__col">
				<span class="icard__label">{{ 'pptx.properties.titleLabel' | translate }}</span>
				<input
					type="text"
					class="icard__input"
					[disabled]="!canEdit()"
					[value]="core()?.title ?? ''"
					(change)="onCoreChange($event, 'title')"
				/>
			</label>
			<label class="icard__col">
				<span class="icard__label">{{ 'pptx.properties.author' | translate }}</span>
				<input
					type="text"
					class="icard__input"
					[disabled]="!canEdit()"
					[value]="core()?.creator ?? ''"
					(change)="onCoreChange($event, 'creator')"
				/>
			</label>
			<label class="icard__col">
				<span class="icard__label">{{
					'pptx.documentProperties.summary.company' | translate
				}}</span>
				<input
					type="text"
					class="icard__input"
					[disabled]="!canEdit()"
					[value]="app()?.company ?? ''"
					(change)="onAppChange($event, 'company')"
				/>
			</label>
			<label class="icard__col">
				<span class="icard__label">
					{{ 'pptx.documentProperties.statistics.application' | translate }}
				</span>
				<input
					type="text"
					class="icard__input"
					[disabled]="!canEdit()"
					[value]="app()?.application ?? ''"
					(change)="onAppChange($event, 'application')"
				/>
			</label>
			<div class="icard__row">
				<span class="icard__label">{{ 'pptx.documentProperties.custom.heading' | translate }}</span>
				@if (canEdit()) {
					<button type="button" class="icard__btn" style="flex: 0 0 auto" (click)="onAddCustom()">
						{{ 'pptx.documentProperties.custom.add' | translate }}
					</button>
				}
			</div>
			@if (custom().length === 0) {
				<span class="icard__label">{{ 'pptx.documentProperties.custom.empty' | translate }}</span>
			} @else {
				@for (entry of custom(); track $index) {
					<div class="icard__row">
						<input
							type="text"
							class="icard__input"
							[disabled]="!canEdit()"
							[value]="entry.name"
							(change)="onCustomChange($event, $index, 'name')"
						/>
						<input
							type="text"
							class="icard__input"
							[disabled]="!canEdit()"
							[value]="entry.value"
							(change)="onCustomChange($event, $index, 'value')"
						/>
						@if (canEdit()) {
							<button
								type="button"
								class="icard__btn icard__btn--danger"
								[title]="'pptx.documentProperties.custom.deleteProperty' | translate"
								(click)="onRemoveCustom($index)"
							>
								&#215;
							</button>
						}
					</div>
				}
			}
		</section>
	`,
	styles: [INSPECTOR_CARD_STYLES],
})
export class DocumentPropertiesCardComponent {
	/** Whether the fields are editable. */
	readonly canEdit = input<boolean>(true);

	private readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);

	protected readonly core = this.loader.coreProperties;
	protected readonly app = this.loader.appProperties;
	protected readonly custom = this.loader.customProperties;

	private markDirty(): void {
		this.editor.dirty.set(true);
	}

	protected onCoreChange(event: Event, key: 'title' | 'creator'): void {
		const value = (event.target as HTMLInputElement).value;
		this.loader.coreProperties.update((current): PptxCoreProperties => ({
			...(current ?? {}),
			[key]: value,
		}));
		this.markDirty();
	}

	protected onAppChange(event: Event, key: 'company' | 'application'): void {
		const value = (event.target as HTMLInputElement).value;
		this.loader.appProperties.update((current): PptxAppProperties => ({
			...(current ?? {}),
			[key]: value,
		}));
		this.markDirty();
	}

	protected onAddCustom(): void {
		const next: PptxCustomProperty[] = [
			...this.custom(),
			{ name: `Property ${this.custom().length + 1}`, value: '', type: 'lpwstr' },
		];
		this.loader.customProperties.set(next);
		this.markDirty();
	}

	protected onCustomChange(event: Event, index: number, key: 'name' | 'value'): void {
		const value = (event.target as HTMLInputElement).value;
		this.loader.customProperties.update((current) =>
			current.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
		);
		this.markDirty();
	}

	protected onRemoveCustom(index: number): void {
		this.loader.customProperties.update((current) => current.filter((_, i) => i !== index));
		this.markDirty();
	}
}
