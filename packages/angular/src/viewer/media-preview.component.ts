import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { MediaPptxElement, PptxElement } from 'pptx-viewer-core';

import { formatMediaTime } from '../internal/shared';
import { resolveMediaSrc } from './media-renderer-helpers';
import { MediaTrimTimelineComponent } from './media-trim-timeline.component';

@Component({
	selector: 'pptx-media-preview',
	standalone: true,
	imports: [TranslatePipe, MediaTrimTimelineComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="card">
			<strong>{{ 'pptx.media.title' | translate }}</strong>
			<span class="kind">
				{{
					(element().mediaType === 'video' ? 'pptx.media.videoClip' : 'pptx.media.audioClip')
						| translate
				}}
			</span>
			@if (source(); as src) {
				@if (element().mediaType === 'video') {
					<video
						#mediaEl
						[src]="src"
						[poster]="element().posterFrameData ?? null"
						preload="metadata"
						(timeupdate)="syncTime()"
						(durationchange)="syncDuration()"
						(loadedmetadata)="syncDuration()"
						(play)="isPlaying.set(true)"
						(pause)="isPlaying.set(false)"
						(ended)="isPlaying.set(false)"
					></video>
				} @else {
					<audio
						#mediaEl
						[src]="src"
						preload="metadata"
						(timeupdate)="syncTime()"
						(durationchange)="syncDuration()"
						(loadedmetadata)="syncDuration()"
						(play)="isPlaying.set(true)"
						(pause)="isPlaying.set(false)"
						(ended)="isPlaying.set(false)"
					></audio>
				}
				<div class="controls">
					<button type="button" (click)="togglePlay()">
						{{ (isPlaying() ? 'pptx.media.pause' : 'pptx.media.play') | translate }}
					</button>
					<span>{{ timeLabel() }} / {{ durationLabel() }}</span>
				</div>
			}
			@if (duration() > 0) {
				<pptx-media-trim-timeline
					[duration]="duration()"
					[trimStartMs]="element().trimStartMs ?? 0"
					[trimEndMs]="element().trimEndMs ?? 0"
					[currentTime]="currentTime()"
					[bookmarks]="element().bookmarks ?? []"
					[canEdit]="canEdit()"
					(trimChange)="patch.emit($event)"
					(seek)="seekTo($event)"
				/>
			}
			@if (element().posterFrameData || duration() > 0 || element().mediaPath) {
				<div class="info">
					<strong>{{ 'pptx.media.info' | translate }}</strong>
					@if (element().posterFrameData; as poster) {
						<img [src]="poster" [alt]="'pptx.media.posterFrame' | translate" />
					}
					@if (duration() > 0) {
						<div>
							<span>{{ 'pptx.media.duration' | translate }}</span
							><span>{{ durationLabel() }}</span>
						</div>
					}
					@if (resolution(); as size) {
						<div>
							<span>{{ 'pptx.media.resolution' | translate }}</span
							><span>{{ size }}</span>
						</div>
					}
					@if (element().metadata?.codecInfo; as codec) {
						<div>
							<span>{{ 'pptx.media.format' | translate }}</span
							><span [title]="codec">{{ codec }}</span>
						</div>
					}
					@if (element().mediaPath; as path) {
						<div>
							<span>{{ 'pptx.media.filePath' | translate }}</span
							><span [title]="path">{{ fileName() }}</span>
						</div>
					}
				</div>
			}
		</section>
	`,
	styles: `
		.card {
			display: grid;
			gap: 6px;
			padding: 8px;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 4px;
		}
		strong {
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.04em;
		}
		.kind {
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 11px;
		}
		video {
			width: 100%;
			max-height: 128px;
			border-radius: 4px;
			background: #000;
			object-fit: contain;
		}
		audio {
			width: 100%;
		}
		.controls {
			display: flex;
			align-items: center;
			gap: 6px;
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 10px;
			font-variant-numeric: tabular-nums;
		}
		.info {
			display: grid;
			gap: 5px;
			padding-top: 7px;
			border-top: 1px solid var(--pptx-inspector-border, #444);
		}
		.info img {
			width: 100%;
			max-height: 80px;
			border-radius: 4px;
			object-fit: contain;
			background: #0003;
		}
		.info div {
			display: flex;
			justify-content: space-between;
			gap: 8px;
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 10px;
		}
		.info div span:last-child {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
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
export class MediaPreviewComponent {
	readonly element = input.required<MediaPptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly canEdit = input<boolean>(true);
	readonly patch = output<Partial<PptxElement>>();

	private readonly mediaEl = viewChild<ElementRef<HTMLMediaElement>>('mediaEl');
	protected readonly currentTime = signal(0);
	protected readonly liveDuration = signal(0);
	protected readonly isPlaying = signal(false);
	protected readonly source = computed(() => resolveMediaSrc(this.element(), this.mediaDataUrls()));
	protected readonly duration = computed(
		() => this.liveDuration() || this.element().metadata?.duration || 0,
	);
	protected readonly timeLabel = computed(() => formatMediaTime(this.currentTime()));
	protected readonly durationLabel = computed(() => formatMediaTime(this.duration()));
	private readonly liveWidth = signal(0);
	private readonly liveHeight = signal(0);
	protected readonly resolution = computed(() => {
		const metadata = this.element().metadata;
		const width = this.liveWidth() || metadata?.videoWidth;
		const height = this.liveHeight() || metadata?.videoHeight;
		return width && height ? `${width} x ${height}` : undefined;
	});
	protected readonly fileName = computed(() => this.element().mediaPath?.split('/').pop() ?? '');

	protected syncTime(): void {
		this.currentTime.set(this.mediaEl()?.nativeElement.currentTime ?? 0);
	}

	protected syncDuration(): void {
		const duration = this.mediaEl()?.nativeElement.duration;
		if (duration !== undefined && Number.isFinite(duration)) {
			this.liveDuration.set(duration);
		}
		const media = this.mediaEl()?.nativeElement;
		if (media instanceof HTMLVideoElement) {
			this.liveWidth.set(media.videoWidth);
			this.liveHeight.set(media.videoHeight);
		}
	}

	protected togglePlay(): void {
		const media = this.mediaEl()?.nativeElement;
		if (!media) {
			return;
		}
		if (media.paused) {
			void media.play();
		} else {
			media.pause();
		}
	}

	protected seekTo(time: number): void {
		this.currentTime.set(time);
		const media = this.mediaEl()?.nativeElement;
		if (media) {
			media.currentTime = time;
		}
	}
}
