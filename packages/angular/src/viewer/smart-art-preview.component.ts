/**
 * smart-art-preview.component.ts: a single SmartArt gallery preview thumbnail.
 *
 * Selector: `pptx-smart-art-preview`
 *
 * Renders the real `pptx-smart-art-renderer` output for the exact element the
 * preset inserts (same layout, default items, colour scheme, and style) scaled
 * down to gallery size, so the preview always matches the chart that appears on
 * the slide after inserting.
 *
 * @module angular-viewer/smart-art-preview
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement, SmartArtLayout } from 'pptx-viewer-core';

import { buildSmartArtPreviewElement } from '../internal/shared';
import { SmartArtRendererComponent } from './smart-art-renderer.component';

@Component({
	selector: 'pptx-smart-art-preview',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SmartArtRendererComponent],
	template: `
		<div class="pptx-sa-preview" aria-hidden="true">
			<div class="pptx-sa-preview__stage">
				<pptx-smart-art-renderer [element]="previewElement()" />
			</div>
		</div>
	`,
	// NOTE: values must stay in sync with shared's SMARTART_PREVIEW_ELEMENT_*
	// constants; the Angular AOT compiler requires `styles` to be a static
	// string (no interpolation), so the numbers are written out literally.
	styles: `
		.pptx-sa-preview {
			width: 64px;
			height: 36px;
			overflow: hidden;
			pointer-events: none;
		}
		.pptx-sa-preview__stage {
			position: relative;
			width: 600px;
			height: 340px;
			transform: scale(0.10667);
			transform-origin: top left;
		}
	`,
})
export class SmartArtPreviewComponent {
	/** The SmartArt layout to draw a thumbnail for. */
	readonly layout = input.required<SmartArtLayout>();

	/** The element this preset would insert, rendered at full size then scaled. */
	protected readonly previewElement = computed<PptxElement>(() =>
		buildSmartArtPreviewElement(this.layout()),
	);
}
