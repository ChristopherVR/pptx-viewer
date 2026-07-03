/**
 * ribbon-design-section.component.ts: the Design ribbon tab (Browse Themes / Edit
 * Theme, Slide Size, Format Background). Split out of {@link RibbonComponent};
 * behaviour and markup are unchanged.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-ribbon-design-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
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
			(click)="info.emit()"
		>
			{{ 'pptx.ribbon.editTheme' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Customize -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.slideSizeTitle' | translate"
			(click)="info.emit()"
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
	readonly info = output<void>();
	readonly toggleInspector = output<void>();
}
