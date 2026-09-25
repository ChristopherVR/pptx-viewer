/**
 * ribbon-gallery-popup.component.ts: the dropped-down panel of a
 * {@link RibbonGalleryComponent}: every descriptor section (optional heading,
 * then a `section.columns`-wide grid of preview tiles), pinned under the
 * gallery with `[pptxAnchoredPopup]`. Emits the picked tile; the parent
 * applies it and closes. Split out only to keep both files inside the repo's
 * 300-LOC budget. Classic `@Input`s so it also binds under the JIT test runner.
 */
import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	inject,
	Input,
	Output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { galleryItemLabel } from '../internal/shared';
import type {
	RibbonGalleryDescriptor,
	RibbonGalleryItem,
	RibbonGallerySection,
} from '../internal/shared';
import { AnchoredPopupDirective } from './anchored-popup.directive';
import { RibbonGallerySvgPipe } from './ribbon-gallery-svg.pipe';

@Component({
	selector: 'pptx-ribbon-gallery-popup',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [AnchoredPopupDirective, RibbonGallerySvgPipe],
	template: `
		<div
			class="pptx-rb-gallery-popup"
			role="dialog"
			[attr.aria-label]="name"
			[attr.data-ribbon-gallery-popup]="descriptor.id"
			[pptxAnchoredPopup]="anchor"
		>
			@for (section of descriptor.sections; track section.id) {
				@if (sectionTitle(section); as heading) {
					<div class="pptx-rb-gallery-heading">{{ heading }}</div>
				}
				<div
					class="grid gap-1"
					[style.grid-template-columns]="'repeat(' + section.columns + ', max-content)'"
				>
					@for (item of section.items; track item.id) {
						<button
							type="button"
							class="pptx-rb-gallery-tile"
							[class.pptx-rb-gallery-tile-applied]="item.applied"
							[attr.data-gallery-item]="item.id"
							[attr.aria-pressed]="item.applied ? 'true' : 'false'"
							[attr.aria-label]="label(item)"
							[title]="label(item)"
							[innerHTML]="item.previewSvg | pptxGallerySvg"
							(mousedown)="$event.preventDefault()"
							(click)="pick.emit(item)"
						></button>
					}
				</div>
			}
		</div>
	`,
})
export class RibbonGalleryPopupComponent {
	private readonly translateService = inject(TranslateService, { optional: true });

	@Input({ required: true }) descriptor!: RibbonGalleryDescriptor;
	/** The translated gallery name (the panel's accessible name). */
	@Input() name = '';
	/** The element the panel hangs below. */
	@Input() anchor: HTMLElement | null = null;
	@Output() readonly pick = new EventEmitter<RibbonGalleryItem>();

	protected label(item: RibbonGalleryItem): string {
		return galleryItemLabel(item, (key, params) => this.t(key, params));
	}

	protected sectionTitle(section: RibbonGallerySection): string | null {
		if (!section.titleKey) {
			return section.title ?? null;
		}
		const out = this.t(section.titleKey);
		return out && out !== section.titleKey ? out : (section.title ?? section.titleKey);
	}

	private t(key: string, params?: Readonly<Record<string, string | number>>): string {
		return this.translateService ? (this.translateService.instant(key, params) as string) : key;
	}
}
