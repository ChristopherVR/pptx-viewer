import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { StyleMap } from './element-style';
import { buildModel3DContainerStyle, buildModel3DViewModel } from './model3d-renderer-helpers';
import type { Model3DViewModel } from './model3d-renderer-helpers';

/**
 * Model3DRendererComponent — Angular port of the Vue `Model3DRenderer.vue`
 * (and the React `Model3DRenderer` / `PosterFallback`), poster-only subset.
 *
 * Interactive 3D rendering (three.js) is intentionally OUT OF SCOPE for the
 * Angular port — see PORTING.md. This component always renders the
 * poster/preview image (`posterImage`, falling back to `imageData`); when
 * neither exists it draws a labelled "3D Model" placeholder, exactly like the
 * React poster fallback.
 *
 * All non-trivial pure computation lives in `model3d-renderer-helpers.ts` (no
 * Angular dependency) so it can be unit-tested without TestBed.
 */
@Component({
	selector: 'pptx-model3d-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div
			class="pptx-ng-element pptx-ng-model3d"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
		>
			@if (vm().posterSrc) {
				<img
					[src]="vm().posterSrc"
					alt="3D Model"
					draggable="false"
					style="width:100%;height:100%;object-fit:contain;pointer-events:none;user-select:none;display:block"
				/>
			} @else {
				<div
					style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;color:#9ca3af;background-color:#f9fafb;border:1px dashed #e5e7eb;border-radius:4px;box-sizing:border-box"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						style="margin-bottom:4px;color:#d1d5db"
					>
						<path
							d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
						/>
						<polyline points="3.27 6.96 12 12.01 20.73 6.96" />
						<line x1="12" y1="22.08" x2="12" y2="12" />
					</svg>
					<span>3D Model</span>
				</div>
			}
		</div>
	`,
})
export class Model3DRendererComponent {
	readonly element = input.required<PptxElement>();
	readonly zIndex = input<number>(0);
	readonly mediaDataUrls = input<Map<string, string>>(new Map());

	readonly containerStyle = computed<StyleMap>(() =>
		buildModel3DContainerStyle(this.element(), this.zIndex()),
	);

	readonly vm = computed<Model3DViewModel>(() => buildModel3DViewModel(this.element()));
}
