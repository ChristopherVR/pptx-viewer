/**
 * ribbon-layout-artwork.ts: draws a layout's real artwork into a tile of the
 * shared Home layout gallery. The gallery shell, geometry and placeholder
 * outlines are shared; element rendering is this binding's own, so the shared
 * element hands each tile's scaled surface to {@link createLayoutArtwork}.
 */
import { ChangeDetectionStrategy, Component, createComponent, input } from '@angular/core';
import type { ApplicationRef, EnvironmentInjector, Injector } from '@angular/core';
import type { PptxLayoutPreview } from 'pptx-viewer-core';

import type { HomeLayoutArtwork } from '../internal/shared';
import { ElementRendererComponent } from './element-renderer.component';

/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
const MAX_PREVIEW_ELEMENTS = 100;

@Component({
	selector: 'pptx-ribbon-layout-artwork',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ElementRendererComponent],
	template: `
		@for (element of elements(); track element.id; let i = $index) {
			<pptx-element-renderer
				[element]="element"
				[zIndex]="i"
				[interactive]="false"
				[exposeElementId]="false"
			></pptx-element-renderer>
		}
	`,
})
export class RibbonLayoutArtworkComponent {
	readonly elements = input<PptxLayoutPreview['elements']>([]);
}

/** A renderer that mounts the artwork component into each tile and releases it on dispose. */
export function createLayoutArtwork(
	appRef: ApplicationRef,
	environmentInjector: EnvironmentInjector,
	elementInjector: Injector,
): HomeLayoutArtwork {
	return (preview, _geometry, container) => {
		const mount = container.ownerDocument.createElement('div');
		container.append(mount);
		const ref = createComponent(RibbonLayoutArtworkComponent, {
			environmentInjector,
			elementInjector,
			hostElement: mount,
		});
		ref.setInput('elements', preview.elements.slice(0, MAX_PREVIEW_ELEMENTS));
		appRef.attachView(ref.hostView);
		ref.changeDetectorRef.detectChanges();
		return () => {
			appRef.detachView(ref.hostView);
			ref.destroy();
			mount.remove();
		};
	};
}
