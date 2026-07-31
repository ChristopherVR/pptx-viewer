import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxElementAnimation } from 'pptx-viewer-core';

import { animationEffectLabelKey } from '../internal/shared';
import { getAnimationElementLabel } from './animation-author-view';
import { previewAngularAnimation, stopAngularAnimationPreview } from './animation-preview-player';

export function reorderAnimationTimeline(
	animations: readonly PptxElementAnimation[],
	sourceIndex: number,
	targetIndex: number,
): PptxElementAnimation[] {
	const sorted = [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	if (
		sourceIndex < 0 ||
		targetIndex < 0 ||
		sourceIndex >= sorted.length ||
		targetIndex >= sorted.length ||
		sourceIndex === targetIndex
	) {
		return sorted.map((animation, order) => ({ ...animation, order }));
	}
	const [moved] = sorted.splice(sourceIndex, 1);
	if (!moved) {
		return sorted;
	}
	sorted.splice(targetIndex, 0, moved);
	return sorted.map((animation, order) => ({ ...animation, order }));
}

export interface AnimationTimelineBar {
	elementId: string;
	leftPercent: number;
	widthPercent: number;
}

export function buildAnimationTimelineBars(
	animations: readonly PptxElementAnimation[],
): AnimationTimelineBar[] {
	const sorted = [...animations].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
	const total = Math.max(
		1,
		...sorted.map((animation) => (animation.delayMs ?? 0) + (animation.durationMs ?? 500)),
	);
	return sorted.map((animation) => ({
		elementId: animation.elementId,
		leftPercent: ((animation.delayMs ?? 0) / total) * 100,
		widthPercent: ((animation.durationMs ?? 500) / total) * 100,
	}));
}

@Component({
	selector: 'pptx-animation-timeline',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (sorted().length) {
			<section class="timeline" aria-label="Animation timeline">
				<h4>Timeline</h4>
				<div class="bar" aria-hidden="true">
					@for (item of bars(); track item.elementId) {
						<span
							[class.selected]="item.elementId === selectedElementId()"
							[style.left.%]="item.leftPercent"
							[style.width.%]="item.widthPercent"
						></span>
					}
				</div>
				<div class="list">
					@for (animation of sorted(); track animation.elementId; let index = $index) {
						<div
							class="item"
							[class.selected]="animation.elementId === selectedElementId()"
							[class.drag-over]="dragOverIndex() === index"
							[draggable]="canEdit()"
							(dragstart)="onDragStart(index, $event)"
							(dragover)="onDragOver(index, $event)"
							(drop)="onDrop(index, $event)"
							(dragend)="clearDrag()"
							(mouseenter)="preview(animation)"
							(mouseleave)="stopPreview()"
						>
							<span class="grip">⋮⋮</span><span class="order">{{ index + 1 }}.</span
							><span class="name">{{ label(animation.elementId) }}</span
							><span class="effect">{{ effect(animation) | translate }}</span>
						</div>
					}
				</div>
			</section>
		}
	`,
	styles: `
		.timeline {
			display: grid;
			gap: 6px;
			padding: 8px 0;
			border-top: 1px solid var(--pptx-inspector-border, #333);
		}
		h4 {
			margin: 0;
			color: var(--pptx-inspector-muted, #888);
			font-size: 10px;
			text-transform: uppercase;
		}
		.bar {
			position: relative;
			height: 22px;
			overflow: hidden;
			border: 1px solid var(--pptx-inspector-border, #444);
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
		}
		.bar span {
			position: absolute;
			top: 3px;
			bottom: 3px;
			min-width: 2%;
			border-radius: 2px;
			background: #6b9a68;
		}
		.bar span.selected {
			outline: 1px solid var(--pptx-primary, #4c9ffe);
		}
		.list {
			display: grid;
			gap: 3px;
			max-height: 160px;
			overflow-y: auto;
		}
		.item {
			display: flex;
			align-items: center;
			gap: 4px;
			min-width: 0;
			padding: 4px;
			border: 1px solid transparent;
			border-radius: 3px;
			background: var(--pptx-inspector-input-bg, #2d2d2d);
			cursor: grab;
			font-size: 10px;
		}
		.item.selected {
			border-color: var(--pptx-primary, #4c9ffe);
		}
		.item.drag-over {
			border-top: 2px solid var(--pptx-primary, #4c9ffe);
		}
		.grip,
		.order {
			color: var(--pptx-inspector-muted, #888);
		}
		.name {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.effect {
			color: var(--pptx-inspector-muted, #aaa);
		}
	`,
})
export class AnimationTimelineComponent {
	readonly animations = input.required<readonly PptxElementAnimation[]>();
	readonly elements = input<readonly PptxElement[]>([]);
	readonly selectedElementId = input<string>('');
	readonly canEdit = input<boolean>(true);
	readonly animationsChange = output<PptxElementAnimation[]>();
	protected readonly dragIndex = signal<number | undefined>(undefined);
	protected readonly dragOverIndex = signal<number | undefined>(undefined);
	protected readonly sorted = computed(() =>
		[...this.animations()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
	);
	protected readonly bars = computed(() => buildAnimationTimelineBars(this.animations()));

	protected label(elementId: string): string {
		const element = this.elements().find((candidate) => candidate.id === elementId);
		if (!element) {
			return elementId;
		}
		return getAnimationElementLabel(element);
	}
	/**
	 * The i18n key naming the row's effect, not finished text: resolving text in
	 * an `OnPush` getter would freeze the wording at the language that happened
	 * to be active when the view last rendered. The row used to print the raw
	 * preset token (`fadeIn`) here.
	 */
	protected effect(animation: PptxElementAnimation): string {
		return animationEffectLabelKey(animation);
	}
	protected preview(animation: PptxElementAnimation): void {
		previewAngularAnimation(animation);
	}
	protected stopPreview(): void {
		stopAngularAnimationPreview();
	}
	protected onDragStart(index: number, event: DragEvent): void {
		if (!this.canEdit()) {
			return;
		}
		this.dragIndex.set(index);
		event.dataTransfer?.setData('text/plain', String(index));
	}
	protected onDragOver(index: number, event: DragEvent): void {
		event.preventDefault();
		this.dragOverIndex.set(index);
	}
	protected onDrop(index: number, event: DragEvent): void {
		event.preventDefault();
		const source = this.dragIndex();
		if (source !== undefined) {
			this.animationsChange.emit(reorderAnimationTimeline(this.animations(), source, index));
		}
		this.clearDrag();
	}
	protected clearDrag(): void {
		this.dragIndex.set(undefined);
		this.dragOverIndex.set(undefined);
	}
}
