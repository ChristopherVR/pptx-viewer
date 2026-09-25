/**
 * ribbon-design-section.component.ts: the Design ribbon tab (Browse Themes / Edit
 * Theme, the Variants Colors / Fonts galleries, Slide Size, Format Background).
 * Split out of {@link RibbonComponent}.
 *
 * Edit Theme and Slide Size used to emit `info`, which opens the Document
 * Properties dialog: two controls with the right label pointing at an unrelated
 * dialog. Both viewer surfaces they name already exist, so each now has its own
 * output and the host routes it to the real thing: Edit Theme opens the theme
 * gallery straight in its customise (theme-editor) mode, Slide Size opens the
 * inspector's deck panel, whose SLIDE SIZE card is the real control.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { RibbonGalleryComponent } from './ribbon-gallery.component';

@Component({
	selector: 'pptx-ribbon-design-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [NgClass, TranslatePipe, RibbonGalleryComponent],
	template: `
		<span class="contents" data-ribbon-group="design.themes">
			<!-- Themes -->
			<button
				type="button"
				class="pptx-rb-pill"
				data-ribbon-control="design.themes.browseThemes"
				[ngClass]="themeGalleryOpen() ? 'bg-primary text-primary-foreground' : ''"
				[title]="'pptx.ribbon.browseThemesTitle' | translate"
				(click)="toggleThemeGallery.emit()"
			>
				{{ 'pptx.ribbon.browseThemes' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-pill"
				data-ribbon-control="design.themes.editTheme"
				[title]="'pptx.ribbon.editThemeTitle' | translate"
				(click)="editTheme.emit()"
			>
				{{ 'pptx.ribbon.editTheme' | translate }}
			</button>
		</span>
		<span class="pptx-rb-sep"></span>
		<!-- Variants: the shared theme Colors / Fonts galleries (FIXED_TAB_GALLERIES). -->
		<div class="flex flex-col items-center gap-0.5" data-ribbon-group="design.variants">
			<div class="flex items-center gap-1">
				<pptx-ribbon-gallery
					gallery="themeColors"
					control="design.variants.colors"
					[element]="selectedElement()"
					[slideIndex]="slideIndex()"
					[canEdit]="canEdit()"
				/>
				<pptx-ribbon-gallery
					gallery="themeFonts"
					control="design.variants.fonts"
					[element]="selectedElement()"
					[slideIndex]="slideIndex()"
					[canEdit]="canEdit()"
				/>
			</div>
			<span class="text-[9px] leading-none text-muted-foreground">
				{{ 'pptx.ribbon.groupVariants' | translate }}
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<span class="contents" data-ribbon-group="design.customize">
			<!-- Customize -->
			<button
				type="button"
				class="pptx-rb-pill"
				data-ribbon-control="design.customize.slideSize"
				[title]="'pptx.ribbon.slideSizeTitle' | translate"
				(click)="openSlideSize.emit()"
			>
				{{ 'pptx.ribbon.slideSize' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-pill"
				data-ribbon-control="design.customize.formatBackground"
				[title]="'pptx.ribbon.formatBackgroundTitle' | translate"
				(click)="toggleInspector.emit()"
			>
				{{ 'pptx.ribbon.formatBackground' | translate }}
			</button>
		</span>
	`,
})
export class RibbonDesignSectionComponent {
	readonly themeGalleryOpen = input<boolean>(false);
	/** Selection + editability for the Variants galleries. */
	readonly selectedElement = input<PptxElement | null>(null);
	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(false);

	readonly toggleThemeGallery = output<void>();
	/** "Edit Theme": open the theme gallery already in its customise mode. */
	readonly editTheme = output<void>();
	/** "Slide Size": surface the inspector deck panel that owns the size card. */
	readonly openSlideSize = output<void>();
	readonly toggleInspector = output<void>();
}
