/**
 * AiFocusHighlightOverlayComponent: draws animated rings around the element(s)
 * the AI assistant is focused on, rendered INSIDE the (already-scaled) slide
 * stage so element canvas coordinates map 1:1. Two variants share the overlay:
 *   - `pick`  : a persistent, subtle ring for an element the user handed to the
 *     assistant in pick mode (with a brief entry pulse).
 *   - `active`: a livelier pulsing ring for the element a running tool is
 *     touching right now ("the AI is looking at / working on this").
 *
 * Purely presentational; mirrors React's `AiFocusHighlightOverlay`. Uses
 * `ViewEncapsulation.None` so the keyframes + the "tween colour while the AI is
 * active" rule are global (the React version injects a `<style>` tag), which is
 * what lets a slide element fade its colour edit even when it is a child
 * renderer component with its own encapsulation id.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	ViewEncapsulation,
} from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { AiCanvasHighlight } from '../../internal/shared-ai';

interface HighlightBox extends AiCanvasHighlight {
	x: number;
	y: number;
	width: number;
	height: number;
}

@Component({
	selector: 'pptx-ai-focus-highlight-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	template: `
		@for (hl of boxes(); track hl.variant + '-' + hl.elementId) {
			<div
				class="pptx-ng-ai-ring"
				[class.pptx-ng-ai-ring--active]="hl.variant === 'active'"
				[attr.data-testid]="'ai-focus-highlight-' + hl.elementId"
				[attr.data-ai-highlight]="hl.variant"
				data-export-ignore="true"
				[style.left.px]="hl.x - 3"
				[style.top.px]="hl.y - 3"
				[style.width.px]="hl.width + 6"
				[style.height.px]="hl.height + 6"
			></div>
		}
	`,
	styles: [
		`
			@keyframes pptx-ng-ai-ring-pulse {
				0% {
					box-shadow:
						0 0 0 0 rgba(59, 130, 246, 0.55),
						0 0 0 0 rgba(59, 130, 246, 0.35);
				}
				70% {
					box-shadow:
						0 0 0 6px rgba(59, 130, 246, 0),
						0 0 14px 4px rgba(59, 130, 246, 0.28);
				}
				100% {
					box-shadow:
						0 0 0 0 rgba(59, 130, 246, 0),
						0 0 10px 2px rgba(59, 130, 246, 0.22);
				}
			}
			@keyframes pptx-ng-ai-ring-in {
				0% {
					opacity: 0;
					transform: scale(1.04);
				}
				100% {
					opacity: 1;
					transform: scale(1);
				}
			}
			.pptx-ng-ai-ring {
				position: absolute;
				pointer-events: none;
				border-radius: 3px;
				z-index: 9998;
				border: 2px solid rgba(59, 130, 246, 0.55);
				box-shadow: 0 0 10px 2px rgba(59, 130, 246, 0.18);
				animation: pptx-ng-ai-ring-in 0.9s ease-out;
			}
			.pptx-ng-ai-ring--active {
				border-color: rgba(59, 130, 246, 0.9);
				box-shadow: none;
				animation:
					pptx-ng-ai-ring-in 0.18s ease-out,
					pptx-ng-ai-ring-pulse 1s ease-out infinite;
			}
			/* While the AI is active, tween colour changes on slide elements so an
			   edit fades from its old value to the new one instead of snapping. */
			[data-pptx-ai-active='true'] [data-pptx-element],
			[data-pptx-ai-active='true'] [data-pptx-element] * {
				transition:
					color 0.5s ease,
					fill 0.5s ease,
					stroke 0.5s ease,
					background-color 0.5s ease,
					border-color 0.5s ease;
			}
		`,
	],
})
export class AiFocusHighlightOverlayComponent {
	readonly highlights = input<readonly AiCanvasHighlight[]>([]);
	/** Elements of the currently visible slide, for bounds lookup. */
	readonly elements = input<readonly PptxElement[]>([]);
	readonly activeSlideIndex = input<number>(0);

	/** Resolve each highlight to a positioned box on the active slide. */
	protected readonly boxes = computed<HighlightBox[]>(() => {
		const byId = new Map(this.elements().map((el) => [el.id, el]));
		const active = this.activeSlideIndex();
		const out: HighlightBox[] = [];
		for (const hl of this.highlights()) {
			if (hl.slideIndex !== active) {
				continue;
			}
			const el = byId.get(hl.elementId);
			if (!el) {
				continue;
			}
			out.push({ ...hl, x: el.x, y: el.y, width: el.width, height: el.height });
		}
		return out;
	});
}
