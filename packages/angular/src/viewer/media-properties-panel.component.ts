import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { MediaBookmark, MediaPptxElement, PptxElement } from 'pptx-viewer-core';

import { LoadContentService } from './load-content.service';
import { MediaPreviewComponent } from './media-preview.component';
import { appendMediaBookmark } from './media-properties-helpers';

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4] as const;

@Component({
	selector: 'pptx-media-properties-panel',
	standalone: true,
	imports: [TranslatePipe, MediaPreviewComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="pptx-ng-media-properties">
			<pptx-media-preview
				[element]="media()"
				[mediaDataUrls]="mediaDataUrls()"
				[canEdit]="canEdit()"
				(patch)="patch.emit($event)"
			/>
			<div class="grid two">
				<label>
					<span>{{ 'pptx.media.trimStartTime' | translate }}</span>
					<input
						type="number"
						min="0"
						[value]="media().trimStartMs ?? 0"
						(change)="numberPatch('trimStartMs', $event)"
					/>
				</label>
				<label>
					<span>{{ 'pptx.media.trimEndTime' | translate }}</span>
					<input
						type="number"
						min="0"
						[value]="media().trimEndMs ?? 0"
						(change)="numberPatch('trimEndMs', $event)"
					/>
				</label>
			</div>
			<label class="row">
				<span>{{ 'pptx.media.volume' | translate }}</span>
				<input
					type="range"
					min="0"
					max="100"
					[value]="volumePercent()"
					(input)="volumeChange($event)"
				/>
				<output>{{ volumePercent() }}%</output>
			</label>
			<label class="row">
				<span>{{ 'pptx.media.speed' | translate }}</span>
				<select
					[attr.aria-label]="'pptx.media.speed' | translate"
					[value]="media().playbackSpeed ?? 1"
					(change)="numberPatch('playbackSpeed', $event)"
				>
					@for (speed of speeds; track speed) {
						<option [value]="speed" [selected]="speed === (media().playbackSpeed ?? 1)">
							{{ speed }}x
						</option>
					}
				</select>
			</label>
			<div class="grid two">
				<label>
					<span>{{ 'pptx.media.fadeIn' | translate }}</span>
					<input
						type="number"
						min="0"
						step="0.1"
						[value]="media().fadeInDuration ?? 0"
						(change)="numberPatch('fadeInDuration', $event)"
					/>
				</label>
				<label>
					<span>{{ 'pptx.media.fadeOut' | translate }}</span>
					<input
						type="number"
						min="0"
						step="0.1"
						[value]="media().fadeOutDuration ?? 0"
						(change)="numberPatch('fadeOutDuration', $event)"
					/>
				</label>
			</div>
			@for (toggle of toggles(); track toggle.key) {
				<label class="row">
					<span>{{ toggle.label | translate }}</span>
					<input
						type="checkbox"
						[checked]="toggle.value"
						(change)="booleanPatch(toggle.key, $event)"
					/>
				</label>
			}
			<section class="bookmarks">
				<div class="bookmark-head">
					<strong>{{ 'pptx.media.bookmarks' | translate }}</strong>
					<button type="button" (click)="addBookmark()">+</button>
				</div>
				@for (bookmark of media().bookmarks ?? []; track $index) {
					<div class="bookmark-row">
						<input
							type="text"
							[value]="bookmark.label"
							(change)="updateBookmark($index, 'label', $event)"
						/>
						<input
							type="number"
							min="0"
							step="0.1"
							[value]="bookmark.time"
							(change)="updateBookmark($index, 'time', $event)"
						/>
						<button type="button" (click)="removeBookmark($index)">×</button>
					</div>
				}
			</section>
		</div>
	`,
	styles: `
		.pptx-ng-media-properties {
			display: grid;
			gap: 9px;
			font-size: 11px;
		}
		.grid {
			display: grid;
			gap: 6px;
		}
		.two {
			grid-template-columns: 1fr 1fr;
		}
		label {
			display: grid;
			gap: 3px;
			color: var(--pptx-inspector-muted, #aaa);
		}
		.row {
			grid-template-columns: 90px minmax(0, 1fr) auto;
			align-items: center;
		}
		input,
		select {
			box-sizing: border-box;
			min-width: 0;
			width: 100%;
			padding: 4px 6px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
		}
		input[type='range'] {
			padding: 0;
			accent-color: var(--pptx-primary, #2563eb);
		}
		input[type='checkbox'] {
			width: auto;
			justify-self: end;
		}
		output {
			width: 32px;
			text-align: right;
			font-variant-numeric: tabular-nums;
		}
		.bookmarks {
			display: grid;
			gap: 5px;
			padding-top: 5px;
			border-top: 1px solid var(--pptx-inspector-border, #444);
		}
		.bookmark-head,
		.bookmark-row {
			display: grid;
			grid-template-columns: 1fr auto;
			align-items: center;
			gap: 5px;
		}
		.bookmark-row {
			grid-template-columns: 1fr 76px auto;
		}
		button {
			padding: 3px 7px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			color: inherit;
			cursor: pointer;
		}
	`,
})
export class MediaPropertiesPanelComponent {
	readonly element = input.required<MediaPptxElement>();
	readonly canEdit = input<boolean>(true);
	readonly patch = output<Partial<PptxElement>>();

	private readonly loader = inject(LoadContentService, { optional: true });
	protected readonly media = computed(() => this.element());
	protected readonly mediaDataUrls = computed(() => this.loader?.mediaDataUrls() ?? new Map());
	protected readonly speeds = SPEEDS;
	protected readonly volumePercent = computed(() => Math.round((this.media().volume ?? 1) * 100));
	protected readonly toggles = computed(
		() =>
			[
				{
					key: 'autoPlay',
					label: 'pptx.media.startAutomatically',
					value: Boolean(this.media().autoPlay),
				},
				{ key: 'loop', label: 'pptx.media.loop', value: Boolean(this.media().loop) },
				{
					key: 'playAcrossSlides',
					label: 'pptx.media.playAcrossSlides',
					value: Boolean(this.media().playAcrossSlides),
				},
				{
					key: 'fullScreen',
					label: 'pptx.media.fullScreen',
					value: Boolean(this.media().fullScreen),
				},
				{
					key: 'hideWhenNotPlaying',
					label: 'pptx.media.hideWhenNotPlaying',
					value: Boolean(this.media().hideWhenNotPlaying),
				},
			] as const,
	);

	protected numberPatch(key: keyof MediaPptxElement, event: Event): void {
		this.patch.emit({
			[key]: Number((event.target as HTMLInputElement).value),
		} as Partial<PptxElement>);
	}

	protected volumeChange(event: Event): void {
		this.patch.emit({
			volume: Number((event.target as HTMLInputElement).value) / 100,
		} as Partial<PptxElement>);
	}

	protected booleanPatch(key: keyof MediaPptxElement, event: Event): void {
		this.patch.emit({
			[key]: (event.target as HTMLInputElement).checked || undefined,
		} as Partial<PptxElement>);
	}

	protected addBookmark(): void {
		const current = this.media().bookmarks ?? [];
		const bookmarks = appendMediaBookmark(
			current,
			this.media().trimStartMs ?? 0,
			`bookmark-${Date.now()}-${current.length}`,
		);
		this.patch.emit({ bookmarks } as Partial<PptxElement>);
	}

	protected removeBookmark(index: number): void {
		this.patch.emit({
			bookmarks: (this.media().bookmarks ?? []).filter((_, i) => i !== index),
		} as Partial<PptxElement>);
	}

	protected updateBookmark(index: number, key: keyof MediaBookmark, event: Event): void {
		const target = event.target as HTMLInputElement;
		const bookmarks = (this.media().bookmarks ?? []).map((bookmark, i) =>
			i === index
				? { ...bookmark, [key]: key === 'time' ? Number(target.value) : target.value }
				: bookmark,
		);
		this.patch.emit({ bookmarks } as Partial<PptxElement>);
	}
}
