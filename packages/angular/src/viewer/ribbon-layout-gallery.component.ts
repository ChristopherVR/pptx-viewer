import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxLayoutOption, PptxLayoutPreview } from 'pptx-viewer-core';

import { isCurrentLayout } from '../internal/shared-src/render/layout-gallery';
import { buildLayoutPreviewGeometry } from '../internal/shared-src/render/layout-preview';
import type { LayoutPreviewGeometry } from '../internal/shared-src/render/layout-preview';
import { ElementRendererComponent } from './element-renderer.component';

/** Thumbnail box size, matching PowerPoint's gallery tiles. */
const THUMB_WIDTH = 128;
const THUMB_HEIGHT = 72;

/** Cap on artwork drawn per thumbnail; layouts never legitimately exceed this. */
const MAX_PREVIEW_ELEMENTS = 100;

/** One tile: the layout, its resolved geometry, and its artwork. */
interface LayoutTile {
	option: PptxLayoutOption;
	geometry: LayoutPreviewGeometry;
	elements: PptxLayoutPreview['elements'];
	isCurrent: boolean;
}

/**
 * The grid of layout thumbnails shared by the New Slide and Layout menus.
 *
 * Both menus previously listed layout names as plain text, which is not enough
 * to tell "Title and Content" from "Two Content" in a themed deck. Angular port
 * of React's `toolbar/LayoutGalleryMenu.tsx`.
 */
@Component({
	selector: 'pptx-ribbon-layout-gallery',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, ElementRendererComponent],
	template: `
		<div
			data-testid="layout-gallery-menu"
			class="grid w-[620px] max-h-[520px] grid-cols-4 gap-2 overflow-y-auto rounded-lg border border-border bg-card p-3 shadow-2xl"
		>
			@if (tiles().length === 0) {
				<p class="col-span-4 px-2 py-3 text-xs text-muted-foreground">
					{{ 'pptx.layoutGallery.empty' | translate }}
				</p>
			}
			@for (tile of tiles(); track tile.option.path) {
				<button
					type="button"
					[disabled]="disabled()"
					[attr.aria-current]="tile.isCurrent ? 'true' : null"
					[title]="tile.option.name"
					class="relative flex min-w-0 flex-col items-center gap-1 rounded border-2 p-1 text-xs text-foreground transition-colors hover:bg-muted"
					[class.border-primary]="tile.isCurrent"
					[class.bg-primary/10]="tile.isCurrent"
					[class.border-transparent]="!tile.isCurrent"
					(click)="select.emit(tile.option)"
				>
					<div
						class="relative shrink-0 overflow-hidden rounded-sm border border-border/70 shadow-sm"
						[style.width.px]="tile.geometry.boxWidth"
						[style.height.px]="tile.geometry.boxHeight"
						[style.background-color]="tile.geometry.backgroundColor"
					>
						<div
							class="absolute left-0 top-0 origin-top-left overflow-hidden"
							[style.width.px]="tile.geometry.surfaceWidth"
							[style.height.px]="tile.geometry.surfaceHeight"
							[style.transform]="'scale(' + tile.geometry.scale + ')'"
						>
							@for (element of tile.elements; track element.id; let i = $index) {
								<pptx-element-renderer
									[element]="element"
									[zIndex]="i"
									[interactive]="false"
								></pptx-element-renderer>
							}
							<!--
								Placeholder outlines live inside the scaled surface, so their
								border width is pre-divided by the scale to stay visible.
							-->
							@for (frame of tile.geometry.frames; track frame.key) {
								<div
									class="absolute border-dashed border-muted-foreground/70 bg-background/20"
									[style.left.px]="frame.left"
									[style.top.px]="frame.top"
									[style.width.px]="frame.width"
									[style.height.px]="frame.height"
									[style.border-width.px]="tile.geometry.frameBorderWidth"
									[style.border-style]="'dashed'"
								></div>
							}
						</div>
					</div>
					<span class="w-full truncate text-center">{{ tile.option.name }}</span>
				</button>
			}
		</div>
	`,
})
export class RibbonLayoutGalleryComponent {
	readonly layoutOptions = input<readonly PptxLayoutOption[]>([]);
	/** Artwork by layout path; tiles stay name-only until it arrives. */
	readonly previews = input<ReadonlyMap<string, PptxLayoutPreview>>(new Map());
	/** Marks the active tile. Omitted by New Slide, which has no "current". */
	readonly currentLayoutPath = input<string | undefined>(undefined);
	readonly disabled = input<boolean>(false);

	readonly select = output<PptxLayoutOption>();

	protected readonly tiles = computed<LayoutTile[]>(() => {
		const previews = this.previews();
		const current = this.currentLayoutPath();
		return this.layoutOptions().map((option) => {
			const preview = previews.get(option.path);
			return {
				option,
				geometry: buildLayoutPreviewGeometry(preview, THUMB_WIDTH, THUMB_HEIGHT),
				elements: (preview?.elements ?? []).slice(0, MAX_PREVIEW_ELEMENTS),
				isCurrent: isCurrentLayout(option, current),
			};
		});
	});
}
