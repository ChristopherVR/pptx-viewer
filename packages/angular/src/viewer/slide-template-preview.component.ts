/**
 * slide-template-preview.component.ts: live miniature of one slide template.
 *
 * Selector: `pptx-slide-template-preview`
 *
 * Angular port of the React `SlideTemplatePreview.tsx`, mirroring the SmartArt
 * gallery pattern (`smart-art-preview.component.ts`): the exact elements
 * insertion would produce (shared `buildSlideTemplateContent`) are built at
 * full canvas size (1280x720), rendered through the REAL
 * `pptx-element-renderer`, and scaled down with a CSS transform so the preview
 * is pixel-faithful to the inserted slide.
 *
 * @module angular-viewer/slide-template-preview
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { buildSlideTemplateContent } from '../internal/shared';
import type { SlideTemplateId } from '../internal/shared';
import { ElementRendererComponent } from './element-renderer.component';

/** Full-size stage the template is built at (standard 16:9 canvas). */
const PREVIEW_CANVAS_WIDTH = 1280;
const PREVIEW_CANVAS_HEIGHT = 720;

/** The elements + background of one preview tile. */
interface TemplatePreviewContent {
	elements: PptxElement[];
	backgroundColor: string;
}

@Component({
	selector: 'pptx-slide-template-preview',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ElementRendererComponent],
	template: `
		<div
			class="pptx-tpl-preview"
			aria-hidden="true"
			[style.background-color]="content().backgroundColor"
		>
			<div class="pptx-tpl-preview__stage">
				@for (element of content().elements; track element.id; let i = $index) {
					<pptx-element-renderer
						[element]="element"
						[zIndex]="i"
						[interactive]="false"
						[canvasWidth]="canvasWidth"
						[canvasHeight]="canvasHeight"
						[slideElements]="content().elements"
					/>
				}
			</div>
		</div>
	`,
	// NOTE: values must stay in sync with the PREVIEW_* constants above; the
	// Angular AOT compiler requires `styles` to be a static string (no
	// interpolation), so the numbers are written out literally
	// (144 = 1280 * 0.1125, 81 = 720 * 0.1125).
	styles: `
		.pptx-tpl-preview {
			width: 144px;
			height: 81px;
			overflow: hidden;
			pointer-events: none;
			border-radius: 4px;
		}
		.pptx-tpl-preview__stage {
			position: relative;
			width: 1280px;
			height: 720px;
			transform: scale(0.1125);
			transform-origin: top left;
		}
	`,
})
export class SlideTemplatePreviewComponent {
	/** The slide template to draw a thumbnail for. */
	readonly templateId = input.required<SlideTemplateId>();

	/** Optional deck scheme map so the preview shows the deck's theme colours. */
	readonly scheme = input<Record<string, string> | undefined>(undefined);

	protected readonly canvasWidth = PREVIEW_CANVAS_WIDTH;
	protected readonly canvasHeight = PREVIEW_CANVAS_HEIGHT;

	/** The exact content insertion would produce, built at full canvas size. */
	protected readonly content = computed<TemplatePreviewContent>(() => {
		const templateId = this.templateId();
		const scheme = this.scheme();
		const built = buildSlideTemplateContent(templateId, {
			slideWidth: PREVIEW_CANVAS_WIDTH,
			slideHeight: PREVIEW_CANVAS_HEIGHT,
			...(scheme ? { scheme } : {}),
			idFor: (index) => `tpl-preview-${templateId}-${index}`,
		});
		return {
			elements: built.elements,
			backgroundColor: built.backgroundColor ?? '#FFFFFF',
		};
	});
}
