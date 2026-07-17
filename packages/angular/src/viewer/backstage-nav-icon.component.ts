import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
	LucideArrowLeft,
	LucideDownload,
	LucideFilePlus2,
	LucideFolderOpen,
	LucideHome,
	LucideInfo,
	LucidePrinter,
	LucideSave,
	LucideSettings,
	LucideShare2,
	LucideUpload,
	LucideUserRound,
	LucideX,
} from '@lucide/angular';

import type { BackstagePage } from '../internal/shared';

@Component({
	selector: 'pptx-backstage-nav-icon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { 'aria-hidden': 'true' },
	imports: [
		LucideArrowLeft,
		LucideDownload,
		LucideFilePlus2,
		LucideFolderOpen,
		LucideHome,
		LucideInfo,
		LucidePrinter,
		LucideSave,
		LucideSettings,
		LucideShare2,
		LucideUpload,
		LucideUserRound,
		LucideX,
	],
	template: `
		@switch (page()) {
			@case ('back') {
				<svg lucideArrowLeft></svg>
			}
			@case ('home') {
				<svg lucideHome></svg>
			}
			@case ('new') {
				<svg lucideFilePlus2></svg>
			}
			@case ('open') {
				<svg lucideFolderOpen></svg>
			}
			@case ('info') {
				<svg lucideInfo></svg>
			}
			@case ('save') {
				<svg lucideSave></svg>
			}
			@case ('saveAs') {
				<svg lucideDownload></svg>
			}
			@case ('print') {
				<svg lucidePrinter></svg>
			}
			@case ('share') {
				<svg lucideShare2></svg>
			}
			@case ('export') {
				<svg lucideUpload></svg>
			}
			@case ('close') {
				<svg lucideX></svg>
			}
			@case ('account') {
				<svg lucideUserRound></svg>
			}
			@case ('options') {
				<svg lucideSettings></svg>
			}
		}
	`,
	styles:
		':host { display: inline-grid; width: 17px; place-items: center; } svg { width: 17px; height: 17px; }',
})
export class BackstageNavIconComponent {
	readonly page = input.required<BackstagePage | 'back'>();
}
