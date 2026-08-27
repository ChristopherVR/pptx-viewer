/* oxlint-disable eslint/one-var -- the component's own field/method
   declarations below are independent, not adjacent initializations of
   related values; merging them would hurt readability far more than it
   helps. */
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type {
	PptxAnimationTimelineAnchor,
	PptxElement,
	PptxElementAnimation,
} from 'pptx-viewer-core';

import {
	animationEffectLabelKey,
	applyAnimationTimelineOrder,
	buildAnimationTimelineBars,
	buildAnimationTimelineRows,
	reorderAnimationTimelineRows,
} from '../internal/shared';
import type { AnimationTimelineBar, AnimationTimelineRow } from '../internal/shared';
import { getAnimationElementLabel } from './animation-author-view';
import { previewAngularAnimation, stopAngularAnimationPreview } from './animation-preview-player';

export type { AnimationTimelineBar };
export { buildAnimationTimelineBars };

@Component({
	selector: 'pptx-animation-timeline',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (rows().length) {
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
					@for (row of rows(); track row.key; let index = $index) {
						@if (row.kind === 'native') {
							<div
								class="item native"
								[class.drag-over]="dragOverIndex() === index"
								[title]="'pptx.animation.nativeEffectHint' | translate"
								(dragover)="onDragOver(index, $event)"
								(drop)="onDrop(index, $event)"
							>
								<span class="grip"></span><span class="order">{{ index + 1 }}.</span
								><span class="name"
									>{{ 'pptx.animation.nativeEffect' | translate }}: {{ nativeLabel(row) }}</span
								>
							</div>
						} @else {
							<div
								class="item"
								[class.selected]="row.elementId === selectedElementId()"
								[class.drag-over]="dragOverIndex() === index"
								[draggable]="canEdit()"
								(dragstart)="onDragStart(index, $event)"
								(dragover)="onDragOver(index, $event)"
								(drop)="onDrop(index, $event)"
								(dragend)="clearDrag()"
								(mouseenter)="previewByElementId(row.elementId)"
								(mouseleave)="stopPreview()"
							>
								<span class="grip">⋮⋮</span><span class="order">{{ index + 1 }}.</span
								><span class="name">{{ label(row.elementId) }}</span
								><span class="effect">{{ effectByElementId(row.elementId) | translate }}</span>
							</div>
						}
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
		.item.native {
			cursor: default;
			font-style: italic;
			opacity: 0.7;
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
	/** Read-only anchors for the deck's own effect groups; see {@link PptxAnimationTimelineAnchor}. */
	readonly animationTimelineAnchors = input<readonly PptxAnimationTimelineAnchor[]>([]);
	readonly selectedElementId = input<string>('');
	readonly canEdit = input<boolean>(true);
	readonly animationsChange = output<PptxElementAnimation[]>();
	protected readonly dragIndex = signal<number | undefined>(undefined);
	protected readonly dragOverIndex = signal<number | undefined>(undefined);
	// Merges the editor's own animations with the deck's read-only native
	// anchors into one full-sequence drag-and-drop timeline.
	protected readonly rows = computed(() =>
		buildAnimationTimelineRows(this.animations(), this.animationTimelineAnchors()),
	);
	protected readonly bars = computed(() => buildAnimationTimelineBars(this.animations()));
	private readonly animationByElementId = computed(
		() => new Map(this.animations().map((animation) => [animation.elementId, animation])),
	);

	protected label(elementId: string): string {
		const element = this.elements().find((candidate) => candidate.id === elementId);
		if (!element) {
			return elementId;
		}
		return getAnimationElementLabel(element);
	}
	protected nativeLabel(row: Extract<AnimationTimelineRow, { kind: 'native' }>): string {
		return row.targetIds.map((id) => this.label(id)).join(', ');
	}
	/**
	 * The i18n key naming the row's effect, not finished text: resolving text in
	 * an `OnPush` getter would freeze the wording at the language that happened
	 * to be active when the view last rendered. The row used to print the raw
	 * preset token (`fadeIn`) here.
	 */
	protected effectByElementId(elementId: string): string {
		const animation = this.animationByElementId().get(elementId);
		return animation ? animationEffectLabelKey(animation) : '';
	}
	protected previewByElementId(elementId: string): void {
		const animation = this.animationByElementId().get(elementId);
		if (animation) {
			previewAngularAnimation(animation);
		}
	}
	protected stopPreview(): void {
		stopAngularAnimationPreview();
	}
	protected onDragStart(index: number, event: DragEvent): void {
		// Only an editor-authored row may be a drag SOURCE: the deck's own
		// effect groups are read-only, though they remain valid drop targets.
		if (!this.canEdit() || this.rows()[index]?.kind !== 'editor') {
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
			const rows = this.rows();
			const sourceRow = rows[source];
			if (sourceRow?.kind === 'editor') {
				const nextRows = reorderAnimationTimelineRows(rows, sourceRow.key, index);
				this.animationsChange.emit(applyAnimationTimelineOrder(this.animations(), nextRows));
			}
		}
		this.clearDrag();
	}
	protected clearDrag(): void {
		this.dragIndex.set(undefined);
		this.dragOverIndex.set(undefined);
	}
}
