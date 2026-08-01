/**
 * presenter-console-icon.component.ts
 *
 * Renders one presenter-console glyph from the kebab-case icon NAME the shared
 * inventory publishes (`PresenterControl.icon` / `.activeIcon`).
 *
 * WHY a component and not an inline `@switch` in the strip: `@lucide/angular`
 * ships one standalone directive per icon (`svg[lucideZoomIn]`) and no
 * name-driven host, so the mapping is necessarily sixteen static template arms.
 * Keeping them here leaves `presenter-controls.component.ts` a thin strip and
 * keeps both files inside the repo's 300-line ceiling. React does the same
 * mapping with a `Record<string, IconType>`; this is its Angular half.
 *
 * An unknown name renders nothing rather than a fallback glyph: the button
 * still carries its translated `aria-label`, so a slot added to the shared
 * inventory before its icon is wired here degrades to an empty (but named and
 * usable) control instead of a wrong picture.
 */
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
	LucideArrowLeftRight,
	LucideCaptions,
	LucideCirclePause,
	LucideCirclePlay,
	LucideEraser,
	LucideGrid2x2,
	LucideHighlighter,
	LucideMonitor,
	LucideMonitorOff,
	LucideMousePointer2,
	LucidePenTool,
	LucideRotateCcw,
	LucideScan,
	LucideX,
	LucideZoomIn,
	LucideZoomOut,
} from '@lucide/angular';

@Component({
	selector: 'pptx-presenter-console-icon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		LucideArrowLeftRight,
		LucideCaptions,
		LucideCirclePause,
		LucideCirclePlay,
		LucideEraser,
		LucideGrid2x2,
		LucideHighlighter,
		LucideMonitor,
		LucideMonitorOff,
		LucideMousePointer2,
		LucidePenTool,
		LucideRotateCcw,
		LucideScan,
		LucideX,
		LucideZoomIn,
		LucideZoomOut,
	],
	template: `
		@switch (name()) {
			@case ('arrow-left-right') {
				<svg lucideArrowLeftRight class="h-4 w-4"></svg>
			}
			@case ('captions') {
				<svg lucideCaptions class="h-4 w-4"></svg>
			}
			@case ('circle-pause') {
				<svg lucideCirclePause class="h-4 w-4"></svg>
			}
			@case ('circle-play') {
				<svg lucideCirclePlay class="h-4 w-4"></svg>
			}
			@case ('eraser') {
				<svg lucideEraser class="h-4 w-4"></svg>
			}
			@case ('grid-2x2') {
				<svg lucideGrid2x2 class="h-4 w-4"></svg>
			}
			@case ('highlighter') {
				<svg lucideHighlighter class="h-4 w-4"></svg>
			}
			@case ('monitor') {
				<svg lucideMonitor class="h-4 w-4"></svg>
			}
			@case ('monitor-off') {
				<svg lucideMonitorOff class="h-4 w-4"></svg>
			}
			@case ('mouse-pointer-2') {
				<svg lucideMousePointer2 class="h-4 w-4"></svg>
			}
			@case ('pen-tool') {
				<svg lucidePenTool class="h-4 w-4"></svg>
			}
			@case ('rotate-ccw') {
				<svg lucideRotateCcw class="h-4 w-4"></svg>
			}
			@case ('scan') {
				<svg lucideScan class="h-4 w-4"></svg>
			}
			@case ('x') {
				<svg lucideX class="h-4 w-4"></svg>
			}
			@case ('zoom-in') {
				<svg lucideZoomIn class="h-4 w-4"></svg>
			}
			@case ('zoom-out') {
				<svg lucideZoomOut class="h-4 w-4"></svg>
			}
		}
	`,
})
export class PresenterConsoleIconComponent {
	/** kebab-case Lucide icon name, straight from the shared inventory. */
	readonly name = input<string | undefined>(undefined);
}
