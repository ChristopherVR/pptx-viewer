/**
 * smart-art-preview.component.ts: a single SmartArt gallery preview thumbnail.
 *
 * Selector: `pptx-smart-art-preview`
 *
 * Thin presentational SVG shell: it renders the framework-free primitives from
 * {@link previewShapesForLayout} for a given layout into a `0 0 60 40` viewBox.
 * Ported from the React `SmartArtPreviews.tsx` thumbnails; the geometry lives in
 * `smart-art-preview-geometry.ts` so it stays unit-testable without TestBed.
 *
 * @module angular-viewer/smart-art-preview
 */

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SmartArtLayout } from 'pptx-viewer-core';

import { previewShapesForLayout } from './smart-art-preview-geometry';
import type {
	PreviewCircle,
	PreviewLine,
	PreviewPolygon,
	PreviewRect,
	PreviewShape,
} from './smart-art-preview-geometry';

@Component({
	selector: 'pptx-smart-art-preview',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<svg viewBox="0 0 60 40" class="pptx-sa-preview" aria-hidden="true" focusable="false">
			@for (shape of shapes(); track $index) {
				@if (asRect(shape); as r) {
					<rect
						[attr.x]="r.x"
						[attr.y]="r.y"
						[attr.width]="r.width"
						[attr.height]="r.height"
						[attr.rx]="r.rx"
						[attr.fill]="r.fill"
						[attr.opacity]="r.opacity"
					/>
				} @else if (asCircle(shape); as c) {
					<circle
						[attr.cx]="c.cx"
						[attr.cy]="c.cy"
						[attr.r]="c.r"
						[attr.fill]="c.fill"
						[attr.opacity]="c.opacity"
					/>
				} @else if (asPolygon(shape); as p) {
					<polygon [attr.points]="p.points" [attr.fill]="p.fill" [attr.opacity]="p.opacity" />
				} @else if (asLine(shape); as l) {
					<line
						[attr.x1]="l.x1"
						[attr.y1]="l.y1"
						[attr.x2]="l.x2"
						[attr.y2]="l.y2"
						stroke="#94a3b8"
						stroke-width="1"
						[attr.opacity]="l.opacity"
					/>
				}
			}
		</svg>
	`,
	styles: `
		.pptx-sa-preview {
			width: 100%;
			height: 100%;
			display: block;
		}
	`,
})
export class SmartArtPreviewComponent {
	/** The SmartArt layout to draw a thumbnail for. */
	readonly layout = input.required<SmartArtLayout>();

	/** The primitive view-models for the current layout. */
	protected readonly shapes = computed<PreviewShape[]>(() => previewShapesForLayout(this.layout()));

	/** Narrow a preview shape to a rect, or `undefined`. */
	protected asRect(shape: PreviewShape): PreviewRect | undefined {
		return shape.kind === 'rect' ? shape : undefined;
	}

	/** Narrow a preview shape to a circle, or `undefined`. */
	protected asCircle(shape: PreviewShape): PreviewCircle | undefined {
		return shape.kind === 'circle' ? shape : undefined;
	}

	/** Narrow a preview shape to a polygon, or `undefined`. */
	protected asPolygon(shape: PreviewShape): PreviewPolygon | undefined {
		return shape.kind === 'polygon' ? shape : undefined;
	}

	/** Narrow a preview shape to a line, or `undefined`. */
	protected asLine(shape: PreviewShape): PreviewLine | undefined {
		return shape.kind === 'line' ? shape : undefined;
	}
}
