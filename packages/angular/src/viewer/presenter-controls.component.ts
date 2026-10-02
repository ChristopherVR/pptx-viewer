/**
 * presenter-controls.component.ts
 *
 * The presenter console's controls: the shared strip
 * ({@link PresenterConsoleStripComponent}, an adapter over the shared
 * `pptx-ui-presenter-console`) and the all-slides navigator it opens. A press on
 * the strip patches the presenter snapshot through the `patch` output; the
 * navigator selects a slide through `navigate`.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	input,
	output,
	signal,
} from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize, PresentationSnapshot } from '../internal/shared';
import { PresenterConsoleStripComponent } from './presenter-console-strip.component';
import { PresenterSlideNavigatorComponent } from './presenter-slide-navigator.component';

@Component({
	selector: 'pptx-presenter-controls',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [PresenterConsoleStripComponent, PresenterSlideNavigatorComponent],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: `
		:host {
			display: block;
		}
	`,
	template: `
		<pptx-presenter-console-strip
			[snapshot]="snapshot()"
			[audienceOpen]="audienceOpen()"
			(patch)="patch.emit($event)"
			(showSlides)="showSlides.set(true)"
			(audience)="audience.emit()"
			(swapDisplays)="swapDisplays.emit()"
			(end)="end.emit()"
		/>
		@if (showSlides()) {
			<pptx-presenter-slide-navigator
				[slides]="slides()"
				[current]="current()"
				[canvasSize]="canvasSize()"
				[mediaDataUrls]="mediaDataUrls()"
				[templateElements]="templateElements()"
				(select)="select($event)"
				(close)="showSlides.set(false)"
			/>
		}
	`,
})
export class PresenterControlsComponent {
	readonly snapshot = input.required<PresentationSnapshot>();
	readonly audienceOpen = input(false);
	readonly slides = input.required<PptxSlide[]>();
	readonly current = input.required<number>();
	readonly canvasSize = input.required<CanvasSize>();
	readonly mediaDataUrls = input.required<Map<string, string>>();
	/** Master/layout elements drawn behind every navigator tile. */
	readonly templateElements = input<readonly PptxElement[]>([]);

	readonly patch = output<Partial<PresentationSnapshot>>();
	readonly navigate = output<number>();
	readonly audience = output<void>();
	readonly swapDisplays = output<void>();
	readonly end = output<void>();

	protected readonly showSlides = signal(false);

	protected select(index: number): void {
		this.navigate.emit(index);
		this.showSlides.set(false);
	}
}
