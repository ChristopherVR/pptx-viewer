/**
 * ribbon-design-section.component.ts: the Design ribbon tab (Browse Themes / Edit
 * Theme, Slide Size, Format Background). Split out of {@link RibbonComponent}.
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

@Component({
	selector: 'pptx-ribbon-design-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [NgClass, TranslatePipe],
	template: `
		<!-- Themes -->
		<button
			type="button"
			class="pptx-rb-pill"
			[ngClass]="themeGalleryOpen() ? 'bg-primary text-primary-foreground' : ''"
			[title]="'pptx.ribbon.browseThemesTitle' | translate"
			(click)="toggleThemeGallery.emit()"
		>
			{{ 'pptx.ribbon.browseThemes' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.editThemeTitle' | translate"
			(click)="editTheme.emit()"
		>
			{{ 'pptx.ribbon.editTheme' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Customize -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.slideSizeTitle' | translate"
			(click)="openSlideSize.emit()"
		>
			{{ 'pptx.ribbon.slideSize' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.formatBackgroundTitle' | translate"
			(click)="toggleInspector.emit()"
		>
			{{ 'pptx.ribbon.formatBackground' | translate }}
		</button>
	`,
})
export class RibbonDesignSectionComponent {
	readonly themeGalleryOpen = input<boolean>(false);

	readonly toggleThemeGallery = output<void>();
	/** "Edit Theme": open the theme gallery already in its customise mode. */
	readonly editTheme = output<void>();
	/** "Slide Size": surface the inspector deck panel that owns the size card. */
	readonly openSlideSize = output<void>();
	readonly toggleInspector = output<void>();
}
