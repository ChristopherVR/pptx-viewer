/**
 * presentation-properties-panel.component.ts: the Properties tab body of the
 * default (no-selection) inspector, mirroring React's
 * `PresentationPropertiesPanel` section order: PRESENTATION, THEME, THEME
 * OVERRIDE, SLIDE SIZE, NOTES & HANDOUT, DOCUMENT.
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { DocumentPropertiesCardComponent } from './document-properties-card.component';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';
import { LoadContentService } from './load-content.service';
import { NotesHandoutCardComponent } from './notes-handout-card.component';
import { PresentationSettingsCardComponent } from './presentation-settings-card.component';
import { SlideSizeCardComponent } from './slide-size-card.component';
import { SlideThemeOverridePanelComponent } from './slide-theme-override-panel.component';
import { ThemeSelectorCardComponent } from './theme-selector-card.component';

@Component({
	selector: 'pptx-presentation-properties-panel',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		PresentationSettingsCardComponent,
		ThemeSelectorCardComponent,
		SlideThemeOverridePanelComponent,
		SlideSizeCardComponent,
		NotesHandoutCardComponent,
		DocumentPropertiesCardComponent,
	],
	template: `
		<pptx-presentation-settings-card [canEdit]="canEdit()" />
		<pptx-theme-selector-card [canEdit]="canEdit()" />
		@if (activeSlide(); as sl) {
			<section class="icard">
				<h3 class="icard__heading">{{ 'pptx.themeOverride.heading' | translate }}</h3>
				<pptx-slide-theme-override-panel
					[slide]="sl"
					[theme]="loader.theme()"
					(patch)="onSlidePatch($event)"
				/>
			</section>
		}
		<pptx-slide-size-card [canEdit]="canEdit()" />
		<pptx-notes-handout-card />
		<pptx-document-properties-card [canEdit]="canEdit()" />
	`,
	styles: [
		`
			:host {
				display: grid;
				gap: 8px;
			}
		`,
		INSPECTOR_CARD_STYLES,
	],
})
export class PresentationPropertiesPanelComponent {
	/** Whether mutation controls are enabled. */
	readonly canEdit = input<boolean>(true);
	/** Zero-based index of the active slide (for the theme-override panel). */
	readonly slideIndex = input.required<number>();

	protected readonly loader = inject(LoadContentService);
	private readonly editor = inject(EditorStateService);

	protected readonly activeSlide = computed<PptxSlide | undefined>(
		() => this.editor.slides()[this.slideIndex()],
	);

	protected onSlidePatch(patch: Partial<PptxSlide>): void {
		this.editor.updateSlide(this.slideIndex(), patch);
	}
}
