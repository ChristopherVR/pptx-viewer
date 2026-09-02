/**
 * activex-controls-overlay.component.ts: ActiveX control fallback overlay.
 *
 * Selector: `pptx-activex-controls-overlay`
 *
 * ActiveX controls (`p:controls > p:control`, `slide.activeXControls`) cannot
 * run inside a viewer. This overlay draws each control's static fallback
 * picture when core resolved one, otherwise a labelled placeholder badge, so
 * the slide shows where the control lives instead of a blank gap.
 *
 * The geometry/label/fallback-image decision lives in shared's
 * `getActiveXControlOverlayView` (extracted from React's
 * `ActiveXControlOverlay.tsx`, the only binding that drew anything for these
 * before); this component only maps the returned view onto a template,
 * mirroring Vanilla's `activex-controls-overlay.ts`.
 *
 * @module viewer/activex-controls-overlay
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxActiveXControl } from 'pptx-viewer-core';

import { getActiveXControlOverlayView } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';

interface ActiveXControlRow {
	readonly key: string;
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
	readonly label: string;
	readonly imageUrl: string | undefined;
	readonly isImage: boolean;
}

@Component({
	selector: 'pptx-activex-controls-overlay',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (rows().length > 0) {
			<div class="pptx-ng-activex-overlay" data-testid="pptx-activex-overlay">
				@for (row of rows(); track row.key) {
					@if (row.isImage && row.imageUrl) {
						<img
							class="pptx-ng-activex-overlay__image"
							[src]="row.imageUrl"
							[alt]="row.label"
							[title]="'ActiveX control: ' + row.label"
							[style.left.px]="row.left"
							[style.top.px]="row.top"
							[style.width.px]="row.width"
							[style.height.px]="row.height"
						/>
					} @else {
						<div
							class="pptx-ng-activex-overlay__badge"
							[title]="
								'ActiveX control: ' +
								row.label +
								' (interactive controls are not supported in the viewer)'
							"
							[style.left.px]="row.left"
							[style.top.px]="row.top"
							[style.width.px]="row.width"
							[style.height.px]="row.height"
						>
							<span aria-hidden="true">&#9881;</span>
							<span class="pptx-ng-activex-overlay__label">{{ row.label }}</span>
						</div>
					}
				}
			</div>
		}
	`,
	styles: `
		.pptx-ng-activex-overlay {
			position: absolute;
			inset: 0;
			pointer-events: none;
			z-index: 40;
		}
		.pptx-ng-activex-overlay__image {
			position: absolute;
		}
		.pptx-ng-activex-overlay__badge {
			position: absolute;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			padding: 2px 6px;
			box-sizing: border-box;
			border: 1px dashed rgba(100, 116, 139, 0.8);
			border-radius: 4px;
			background: rgba(148, 163, 184, 0.14);
			color: rgb(51, 65, 85);
			font-size: 11px;
			font-weight: 600;
			line-height: 1.2;
			overflow: hidden;
		}
		.pptx-ng-activex-overlay__label {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	`,
})
export class ActiveXControlsOverlayComponent {
	/** `slide.activeXControls`; the component renders nothing when empty. */
	readonly controls = input<readonly PptxActiveXControl[]>([]);
	readonly canvasSize = input.required<CanvasSize>();

	protected readonly rows = computed<ActiveXControlRow[]>(() =>
		this.controls().map((control, index) => {
			const view = getActiveXControlOverlayView(control, this.canvasSize(), index);
			return {
				key: `${control.relId ?? 'activex'}-${index}`,
				left: view.left,
				top: view.top,
				width: view.width,
				height: view.height,
				label: view.label,
				imageUrl: view.imageUrl,
				isImage: view.className === 'image',
			};
		}),
	);
}
