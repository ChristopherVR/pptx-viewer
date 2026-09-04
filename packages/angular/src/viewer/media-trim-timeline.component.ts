import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	HostListener,
	computed,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import type { MediaBookmark } from 'pptx-viewer-core';

import {
	formatMediaTime,
	mediaTimelineGeometry,
	mediaTimeFromPointer,
	mediaTrimEndSeconds,
	mediaTrimRangeForDrag,
} from '../internal/shared';
import type { MediaTrimHandle, MediaTrimRange } from '../internal/shared';

@Component({
	selector: 'pptx-media-trim-timeline',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="labels">
			<span>{{ startLabel() }}</span>
			<span>{{ endLabel() }}</span>
		</div>
		<div #bar class="bar" (click)="seekFromClick($event)">
			<div
				class="selection"
				[style.left.%]="geometry().startPercent"
				[style.width.%]="geometry().endPercent - geometry().startPercent"
			></div>
			<div class="playhead" [style.left.%]="geometry().playheadPercent"></div>
			@if (canEdit()) {
				<button
					type="button"
					class="handle start"
					data-pptx-compact
					[style.left.%]="geometry().startPercent"
					(pointerdown)="beginDrag('start', $event)"
					aria-label="Trim start"
				></button>
				<button
					type="button"
					class="handle end"
					data-pptx-compact
					[style.left.%]="geometry().endPercent"
					(pointerdown)="beginDrag('end', $event)"
					aria-label="Trim end"
				></button>
			}
			@for (bookmark of bookmarks(); track bookmark.id) {
				<button
					type="button"
					class="bookmark"
					data-pptx-compact
					[style.left.%]="bookmarkPercent(bookmark)"
					[title]="bookmark.label"
					(click)="seekBookmark(bookmark, $event)"
				></button>
			}
		</div>
	`,
	styles: `
		:host {
			display: grid;
			gap: 4px;
		}
		.labels {
			display: flex;
			justify-content: space-between;
			color: var(--pptx-inspector-muted, #aaa);
			font-size: 10px;
			font-variant-numeric: tabular-nums;
		}
		.bar {
			position: relative;
			height: 20px;
			overflow: hidden;
			border-radius: 4px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			cursor: pointer;
			user-select: none;
		}
		.selection {
			position: absolute;
			inset-block: 0;
			border-radius: 4px;
			background: color-mix(in srgb, var(--pptx-primary, #2563eb) 32%, transparent);
		}
		.playhead {
			position: absolute;
			z-index: 2;
			inset-block: 0;
			width: 2px;
			background: #fff;
			pointer-events: none;
		}
		.handle {
			position: absolute;
			z-index: 4;
			inset-block: 0;
			width: 8px;
			padding: 0;
			border: 0;
			border-radius: 3px;
			background: var(--pptx-primary, #2563eb);
			cursor: ew-resize;
			transform: translateX(-4px);
			touch-action: none;
		}
		.bookmark {
			position: absolute;
			z-index: 3;
			inset-block: 0;
			width: 4px;
			padding: 0;
			border: 0;
			background: #facc15b3;
			transform: translateX(-2px);
			cursor: pointer;
		}
	`,
})
export class MediaTrimTimelineComponent {
	readonly duration = input.required<number>();
	readonly trimStartMs = input<number>(0);
	readonly trimEndMs = input<number>(0);
	readonly currentTime = input<number>(0);
	readonly bookmarks = input<MediaBookmark[]>([]);
	readonly canEdit = input<boolean>(true);
	readonly trimChange = output<MediaTrimRange>();
	readonly seek = output<number>();

	private readonly bar = viewChild<ElementRef<HTMLDivElement>>('bar');
	private readonly dragging = signal<MediaTrimHandle | null>(null);
	protected readonly geometry = computed(() =>
		mediaTimelineGeometry(
			this.duration(),
			this.trimStartMs(),
			this.trimEndMs(),
			this.currentTime(),
		),
	);
	protected readonly startLabel = computed(() => formatMediaTime(this.trimStartMs() / 1000));
	// `trimEndMs` is p14:trim/@end's distance from the clip's tail.
	protected readonly endLabel = computed(() =>
		formatMediaTime(mediaTrimEndSeconds(this.duration(), this.trimEndMs())),
	);

	protected beginDrag(handle: MediaTrimHandle, event: PointerEvent): void {
		event.preventDefault();
		event.stopPropagation();
		this.dragging.set(handle);
	}

	@HostListener('window:pointermove', ['$event'])
	protected continueDrag(event: PointerEvent): void {
		const handle = this.dragging();
		if (!handle) {
			return;
		}
		this.trimChange.emit(
			mediaTrimRangeForDrag(
				handle,
				this.timeFromPointer(event.clientX),
				this.duration(),
				this.trimStartMs(),
				this.trimEndMs(),
			),
		);
	}

	@HostListener('window:pointerup')
	protected endDrag(): void {
		this.dragging.set(null);
	}

	protected seekFromClick(event: MouseEvent): void {
		this.seek.emit(this.timeFromPointer(event.clientX));
	}

	protected seekBookmark(bookmark: MediaBookmark, event: MouseEvent): void {
		event.stopPropagation();
		this.seek.emit(bookmark.time);
	}

	protected bookmarkPercent(bookmark: MediaBookmark): number {
		return Math.min(100, Math.max(0, (bookmark.time / Math.max(1, this.duration())) * 100));
	}

	private timeFromPointer(clientX: number): number {
		const rect = this.bar()?.nativeElement.getBoundingClientRect();
		return rect ? mediaTimeFromPointer(clientX, rect.left, rect.width, this.duration()) : 0;
	}
}
