import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { ContentPartPptxElement, PptxElement } from 'pptx-viewer-core';

import type { ContentPartStrokeView } from '../internal/shared-src/render/content-part-strokes';
import {
	buildContentPartStrokes,
	contentPartViewBox,
} from '../internal/shared-src/render/content-part-strokes';
import {
	getContentPartReplayStyles,
	INK_REPLAY_KEYFRAMES,
} from '../internal/shared-src/render/ink-rendering';
import type { StyleMap } from './element-style';
import { buildInkContainerStyle } from './ink-renderer-helpers';

/**
 * ContentPartRendererComponent: renders `p:contentPart` ink (InkML strokes
 * bound through `mc:AlternateContent`).
 *
 * Angular had NO `contentPart` case in `element-renderer.component.html`, so
 * the element landed on `@default` and painted the "unsupported" placeholder.
 * That went unnoticed because real PowerPoint ink never reached the InkML
 * decoder at all (the `p14` capability set omitted `contentPart`), so nothing
 * in the corpus ever produced one.
 *
 * The per-stroke view model is the shared `buildContentPartStrokes` decision
 * function, identical in all five bindings.
 */
@Component({
	selector: 'pptx-content-part-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div
			class="pptx-ng-element pptx-ng-contentpart"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="elementIdAttr()"
			[attr.data-pptx-element]="markElement() ? 'true' : null"
		>
			@if (strokes().length > 0) {
				<svg
					class="pptx-ng-contentpart-svg"
					[attr.viewBox]="viewBox()"
					preserveAspectRatio="none"
					style="width:100%;height:100%;pointer-events:none;display:block"
				>
					@if (replay()) {
						<style [textContent]="replayKeyframes"></style>
					}
					@for (stroke of strokes(); track stroke.key) {
						@if (stroke.circles && stroke.circles.length > 0) {
							<g [attr.opacity]="stroke.opacity">
								@for (c of stroke.circles; track $index) {
									<circle
										[attr.cx]="c.cx"
										[attr.cy]="c.cy"
										[attr.r]="c.r"
										[attr.fill]="stroke.color"
									/>
								}
							</g>
						} @else {
							<path
								[attr.d]="stroke.d"
								fill="none"
								[attr.stroke]="stroke.color"
								[attr.stroke-width]="stroke.width"
								[attr.stroke-opacity]="stroke.opacity"
								stroke-linecap="round"
								stroke-linejoin="round"
								vector-effect="non-scaling-stroke"
								[style.animation]="replayStyles()[$index]?.animation ?? null"
								[style.stroke-dasharray]="replayStyles()[$index]?.strokeDasharray ?? null"
								[style.stroke-dashoffset]="replayStyles()[$index]?.strokeDashoffset ?? null"
								[style.--ink-path-length]="replayStyles()[$index]?.pathLength ?? null"
							/>
						}
					}
				</svg>
			} @else {
				<div class="pptx-ng-contentpart-fallback">
					<span class="pptx-ng-contentpart-fallback-label">{{ fallbackLabel() }}</span>
				</div>
			}
		</div>
	`,
	styles: [
		`
			.pptx-ng-contentpart-fallback {
				width: 100%;
				height: 100%;
				box-sizing: border-box;
				display: flex;
				align-items: center;
				justify-content: center;
				border: 1px dashed rgba(100, 116, 139, 0.6);
				border-radius: 4px;
				background: rgba(148, 163, 184, 0.08);
			}

			.pptx-ng-contentpart-fallback-label {
				font-size: 11px;
				font-family: system-ui, sans-serif;
				color: rgba(100, 116, 139, 0.9);
				text-transform: uppercase;
				letter-spacing: 0.08em;
			}
		`,
	],
})
export class ContentPartRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	readonly replay = input<boolean>(false);
	/**
	 * Emit the neutral element marker on this renderer's root, the node that
	 * also carries `data-element-id`. Same reasoning as `InkRendererComponent`:
	 * the root positions itself absolutely, so an outer marked box would offset
	 * the strokes twice.
	 */
	readonly markElement = input<boolean>(false);
	/**
	 * When true (default), the rendered node carries `data-element-id`. The
	 * miniature surfaces that paint every slide at once turn it off so one
	 * element id resolves to exactly one node in the document; see
	 * `ElementRendererComponent.exposeElementId`.
	 */
	readonly exposeElementId = input<boolean>(true);

	/** `data-element-id` for this element, or null on a miniature surface. */
	readonly elementIdAttr = computed<string | null>(() =>
		this.exposeElementId() ? this.element().id : null,
	);

	readonly replayKeyframes = INK_REPLAY_KEYFRAMES;

	private readonly translate = inject(TranslateService);

	readonly containerStyle = computed<StyleMap>(() =>
		buildInkContainerStyle(this.element(), this.zIndex()),
	);

	private readonly contentPart = computed<ContentPartPptxElement | undefined>(() => {
		const element = this.element();
		return element.type === 'contentPart' ? element : undefined;
	});

	readonly strokes = computed<ContentPartStrokeView[]>(() => {
		const part = this.contentPart();
		return part ? buildContentPartStrokes(part) : [];
	});

	readonly viewBox = computed<string>(() => {
		const part = this.contentPart();
		return part ? contentPartViewBox(part) : '0 0 1 1';
	});

	readonly replayStyles = computed(() => {
		const part = this.contentPart();
		return this.replay() && part ? getContentPartReplayStyles(part.inkStrokes ?? []) : [];
	});

	readonly fallbackLabel = computed<string>(() =>
		this.translate.instant('pptx.ink.contentPartFallback'),
	);
}
