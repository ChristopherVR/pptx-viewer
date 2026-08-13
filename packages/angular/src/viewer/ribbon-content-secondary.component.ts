/**
 * ribbon-content-secondary.component.ts: the ribbon's Slide Show/Review/View/
 * Draw/Design/Transitions/Animations/Help/Record tab content, split out of
 * {@link RibbonComponent} (which was well over this repo's 300-LOC file cap).
 * The remaining tabs (File/Home/Insert/Text/Arrange) live in the sibling
 * {@link RibbonContentComponent} for the same reason.
 *
 * A `@switch` on `activeTab` that dispatches to one standalone section
 * component per tab, exactly as it did inline in `ribbon.component.ts`. Also
 * owns the Draw and Transitions tabs' state (draw tool/colour/width,
 * transition preset/duration): since this component stays mounted for as
 * long as the ribbon is (it isn't behind an `@if`), that state persists
 * across `activeTab` changes the same way it did on `RibbonComponent`.
 *
 * Every output here is re-emitted 1:1 by {@link RibbonComponent}, which keeps
 * the public `<pptx-ribbon>` API (and `PowerPointViewerComponent`'s bindings
 * to it) unchanged.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { ToolbarActionId } from '../internal/shared';
import { RibbonAnimationsSectionComponent } from './ribbon-animations-section.component';
import { RibbonDesignSectionComponent } from './ribbon-design-section.component';
import type { DrawTool, DrawToolState } from './ribbon-draw-section.component';
import { RibbonDrawSectionComponent } from './ribbon-draw-section.component';
import { RibbonRecordSectionComponent } from './ribbon-record-section.component';
import { RibbonReviewSectionComponent } from './ribbon-review-section.component';
import { RibbonSlideshowSectionComponent } from './ribbon-slideshow-section.component';
import { RibbonTransitionsSectionComponent } from './ribbon-transitions-section.component';
import type { RibbonTab } from './ribbon-types';
import { RibbonViewSectionComponent } from './ribbon-view-section.component';

@Component({
	selector: 'pptx-ribbon-content-secondary',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		TranslatePipe,
		RibbonSlideshowSectionComponent,
		RibbonReviewSectionComponent,
		RibbonViewSectionComponent,
		RibbonDrawSectionComponent,
		RibbonDesignSectionComponent,
		RibbonTransitionsSectionComponent,
		RibbonAnimationsSectionComponent,
		RibbonRecordSectionComponent,
	],
	template: `
		@switch (activeTab()) {
			@case ('slideShow') {
				<pptx-ribbon-slideshow-section
					[slideCount]="slideCount()"
					[showSubtitles]="showSubtitles()"
					[hiddenActions]="hiddenActions()"
					(presentFromBeginning)="presentFromBeginning.emit()"
					(presentFromCurrent)="present.emit()"
					(presenter)="presenter.emit()"
					(rehearseTimings)="rehearseTimings.emit()"
					(record)="record.emit()"
					(toggleSubtitles)="toggleSubtitles.emit()"
					(openSubtitleSettings)="openSubtitleSettings.emit()"
					(broadcast)="broadcast.emit()"
					(openCustomShows)="openCustomShows.emit()"
					(openSetUpSlideShow)="openSetUpSlideShow.emit()"
					[activeSlideHidden]="activeSlideHidden()"
					(toggleHideSlide)="toggleHideSlide.emit()"
				/>
			}
			@case ('review') {
				<pptx-ribbon-review-section
					[canEdit]="canEdit()"
					[spellCheckEnabled]="spellCheckEnabled()"
					(spellCheckChange)="spellCheckChange.emit($event)"
					(comments)="comments.emit()"
					(a11y)="a11y.emit()"
					(openCompare)="openCompare.emit()"
					(language)="openSettings.emit()"
					(link)="link.emit()"
				/>
			}
			@case ('view') {
				<pptx-ribbon-view-section
					[canEdit]="canEdit()"
					[showGrid]="showGrid()"
					[showRulers]="showRulers()"
					[showGuides]="showGuides()"
					[snapToGrid]="snapToGrid()"
					[snapToShape]="snapToShape()"
					[eyedropperActive]="eyedropperActive()"
					(openSorter)="openSorter.emit()"
					(openReadingView)="openReadingView.emit()"
					(openOutlineView)="openOutlineView.emit()"
					(openMasterView)="openMasterView.emit()"
					(toggleGrid)="toggleGrid.emit()"
					(toggleRulers)="toggleRulers.emit()"
					(toggleGuides)="toggleGuides.emit()"
					(toggleSelectionPane)="toggleSelectionPane.emit()"
					(toggleSnapToGrid)="toggleSnapToGrid.emit()"
					(toggleSnapToShape)="toggleSnapToShape.emit()"
					(addGuide)="addGuide.emit($event)"
					(zoomToFit)="zoomToFit.emit()"
					(toggleEyedropper)="toggleEyedropper.emit()"
				/>
			}
			@case ('draw') {
				<pptx-ribbon-draw-section
					[activeTool]="activeTool()"
					[drawingColor]="drawingColor()"
					[drawingWidth]="drawingWidth()"
					(drawToolChange)="onDrawChange($event)"
				/>
			}
			@case ('design') {
				<pptx-ribbon-design-section
					[themeGalleryOpen]="themeGalleryOpen()"
					(toggleThemeGallery)="toggleThemeGallery.emit()"
					(editTheme)="editTheme.emit()"
					(openSlideSize)="openSlideSize.emit()"
					(toggleInspector)="toggleInspector.emit()"
				/>
			}
			@case ('transitions') {
				<pptx-ribbon-transitions-section
					[slideIndex]="slideIndex()"
					(present)="present.emit()"
					(toggleInspector)="toggleInspector.emit()"
				/>
			}
			@case ('animations') {
				<pptx-ribbon-animations-section
					[slideIndex]="slideIndex()"
					[selectedElement]="selectedElement()"
					[canEdit]="canEdit()"
					(present)="present.emit()"
					(toggleInspector)="toggleInspector.emit()"
				/>
			}
			@case ('help') {
				<button type="button" class="pptx-rb-pill" (click)="openSettings.emit()">
					{{ 'pptx.settings.title' | translate }}
				</button>
				<button type="button" class="pptx-rb-pill" (click)="openShortcuts.emit()">
					{{ 'pptx.settings.keyboardShortcuts' | translate }}
				</button>
				<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">
					{{ 'pptx.ribbon.accessibilityCheck' | translate }}
				</button>
			}
			@case ('record') {
				<pptx-ribbon-record-section
					(recordFromBeginning)="recordFromBeginning.emit()"
					(recordFromCurrent)="recordFromCurrent.emit()"
				/>
			}
		}
	`,
})
export class RibbonContentSecondaryComponent {
	readonly activeTab = input.required<RibbonTab>();
	readonly slideIndex = input<number>(0);
	readonly slideCount = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly showGrid = input<boolean>(false);
	readonly showRulers = input<boolean>(false);
	readonly showGuides = input<boolean>(false);
	readonly snapToGrid = input<boolean>(false);
	readonly snapToShape = input<boolean>(true);
	readonly eyedropperActive = input<boolean>(false);
	readonly themeGalleryOpen = input<boolean>(false);
	readonly spellCheckEnabled = input<boolean>(false);
	readonly showSubtitles = input<boolean>(false);
	/** Whether the active slide is hidden, for Hide Slide's pressed state. */
	readonly activeSlideHidden = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (threaded to the Slide Show section). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	readonly present = output<void>();
	readonly presenter = output<void>();
	readonly record = output<void>();
	readonly presentFromBeginning = output<void>();
	readonly rehearseTimings = output<void>();
	readonly toggleSubtitles = output<void>();
	readonly openSubtitleSettings = output<void>();
	readonly recordFromBeginning = output<void>();
	readonly recordFromCurrent = output<void>();
	readonly spellCheckChange = output<boolean>();
	readonly broadcast = output<void>();
	readonly print = output<void>();
	readonly comments = output<void>();
	readonly a11y = output<void>();
	readonly link = output<void>();
	readonly openSorter = output<void>();
	/** View tab > Reading View: the deck full-window, not the slide show. */
	readonly openReadingView = output<void>();
	readonly openOutlineView = output<void>();
	readonly openMasterView = output<void>();
	readonly toggleNotes = output<void>();
	readonly toggleInspector = output<void>();
	readonly drawToolChange = output<DrawToolState>();
	readonly toggleThemeGallery = output<void>();
	/** Design > Edit Theme: open the theme gallery in its customise mode. */
	readonly editTheme = output<void>();
	/** Design > Slide Size: surface the inspector card that owns the size. */
	readonly openSlideSize = output<void>();
	readonly toggleGrid = output<void>();
	readonly toggleRulers = output<void>();
	readonly toggleGuides = output<void>();
	readonly toggleSelectionPane = output<void>();
	readonly openCustomShows = output<void>();
	readonly toggleSnapToGrid = output<void>();
	readonly toggleSnapToShape = output<void>();
	readonly addGuide = output<'x' | 'y'>();
	readonly zoomToFit = output<void>();
	readonly toggleEyedropper = output<void>();
	readonly openSetUpSlideShow = output<void>();
	/** PowerPoint's Hide Slide toggle for the active slide. */
	readonly toggleHideSlide = output<void>();
	readonly openCompare = output<void>();
	readonly openShortcuts = output<void>();
	readonly openSettings = output<void>();

	// ── Tab-local state (owned here so it survives tab switches) ────────────────
	// The Transitions tab keeps no state here any more: its draft is read back
	// from the active slide's own `transition`, which survives a tab switch
	// because it lives in the deck rather than in a component.
	protected readonly activeTool = signal<DrawTool>('select');
	protected readonly drawingColor = signal<string>('#000000');
	protected readonly drawingWidth = signal<number>(3);

	/** Sync the draw-tool signals with a Draw-tab change and re-broadcast it. */
	protected onDrawChange(state: DrawToolState): void {
		this.activeTool.set(state.tool);
		this.drawingColor.set(state.color);
		this.drawingWidth.set(state.width);
		this.drawToolChange.emit(state);
	}
}
