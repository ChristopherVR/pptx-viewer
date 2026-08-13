/**
 * presenter-slide-navigator.component.ts
 *
 * PowerPoint's "See All Slides" overlay, reachable from the presenter console's
 * grid button. Angular port of React's `PresenterSlideNavigator`.
 *
 * Split out of {@link PresenterControlsComponent} so the strip stays a strip:
 * the overlay is a full-viewport surface with its own heading, grid and close
 * affordance, and folding it back in pushed that file past the repo's 300-line
 * ceiling.
 *
 * Its three strings used to be hard-coded English here, which made the only way
 * OUT of the overlay ("Close") unreadable in every other locale. They now
 * resolve through the shared `PRESENTER_NAVIGATOR_LABEL_KEYS`, as in the other
 * four bindings, and the grid geometry comes from the shared metrics rather
 * than a magic 220px repeated per binding.
 */
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { PRESENTER_CONSOLE_CLASSES, PRESENTER_LAYOUT_METRICS } from '../internal/shared';
import type { CanvasSize } from '../internal/shared';
import { SlideCanvasComponent } from './slide-canvas.component';

/** One navigator tile: the slide to draw plus its position in the deck. */
interface NavigatorTile {
	slide: PptxSlide;
	index: number;
	/** `@for` track key; falls back to the index for a slide with no id. */
	key: string;
}

@Component({
	selector: 'pptx-presenter-slide-navigator',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [SlideCanvasComponent, TranslatePipe],
	template: `
		<div [class]="classes.navigator + ' text-foreground'" data-pptx-presenter-navigator>
			<header class="mb-4 flex items-center justify-between border-b border-border pb-4">
				<div>
					<p class="text-xs uppercase tracking-[0.22em] text-sky-300">
						{{ 'pptx.presenter.slideNavigator' | translate }}
					</p>
					<h2 class="text-xl font-semibold">
						{{ 'pptx.presenter.seeAllSlides' | translate }}
					</h2>
				</div>
				<button
					type="button"
					class="rounded-md bg-muted px-4 py-2 hover:bg-accent"
					data-pptx-presenter-control="navigator-close"
					[attr.aria-label]="'pptx.presenter.closeNavigator' | translate"
					[title]="'pptx.presenter.closeNavigator' | translate"
					(click)="close.emit()"
				>
					{{ 'pptx.presenter.closeNavigator' | translate }}
				</button>
			</header>
			<div [class]="classes.navigatorGrid">
				@for (tile of tiles(); track tile.key) {
					<button
						type="button"
						class="group text-left"
						[class.ring-2]="tile.index === current()"
						[class.ring-sky-400]="tile.index === current()"
						[class.opacity-45]="tile.slide.hidden"
						(click)="select.emit(tile.index)"
					>
						<div class="overflow-hidden" [style.width.px]="tileWidth">
							<pptx-slide-canvas
								[slide]="tile.slide"
								[canvasSize]="canvasSize()"
								[mediaDataUrls]="mediaDataUrls()"
								[zoom]="tileZoom()"
								[autoFit]="false"
								[interactive]="false"
								[exposeElementIds]="false"
							/>
						</div>
						<span class="mt-2 block text-xs tabular-nums text-muted-foreground">
							{{ tile.index + 1 }}{{ tile.slide.hidden ? ' - hidden' : '' }}
						</span>
					</button>
				}
			</div>
		</div>
	`,
})
export class PresenterSlideNavigatorComponent {
	readonly slides = input.required<PptxSlide[]>();
	readonly current = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input.required<Map<string, string>>();
	/** Master/layout elements drawn behind every tile, as on the live stage. */
	readonly templateElements = input<readonly PptxElement[]>([]);

	readonly select = output<number>();
	readonly close = output<void>();

	protected readonly classes = PRESENTER_CONSOLE_CLASSES;
	protected readonly tileWidth = PRESENTER_LAYOUT_METRICS.navigatorTileWidth;

	/**
	 * Tile scale. `autoFit` is off (as on every other thumbnail in this package)
	 * so this zoom is the ONLY scale; with auto-fit left on, the two compound and
	 * the tiles shrink to a fraction of the 200px the grid reserves for them.
	 */
	protected readonly tileZoom = computed<number>(() => {
		const width = this.canvasSize().width;
		return width > 0 ? this.tileWidth / width : 1;
	});

	protected readonly tiles = computed<NavigatorTile[]>(() => {
		const template = this.templateElements();
		return this.slides().map((slide, index) => ({
			slide: template.length > 0 ? { ...slide, elements: [...template, ...slide.elements] } : slide,
			index,
			key: slide.id || `slide-${String(index)}`,
		}));
	});
}
