/**
 * ribbon.component.ts: Office-style tabbed ribbon for the Angular editor chrome,
 * 1:1 port of React's `viewer/components/Toolbar.tsx`. A thin orchestrator: owns
 * `activeTab` (shared state) and renders the siblings this file was split into
 * to get under the repo's 300-LOC cap: {@link RibbonPrimaryRowComponent} (quick
 * -access row), {@link RibbonTabListComponent} (tab strip + Record/Share +
 * collapse), and {@link RibbonContentComponent}/{@link RibbonContentSecondaryComponent}
 * (the active tab's controls, split across two files since the combined
 * `@switch` for all fourteen tabs was itself over the cap). Every input/output
 * here is unchanged from before the split, so `PowerPointViewerComponent`'s
 * bindings to `<pptx-ribbon>` did not need to change.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import type { AccountAuthConfig, ToolbarActionId } from '../internal/shared';
import { RibbonContentSecondaryComponent } from './ribbon-content-secondary.component';
import { RibbonContentComponent } from './ribbon-content.component';
import type { DrawToolState } from './ribbon-draw-section.component';
import { RibbonPrimaryRowComponent } from './ribbon-primary-row.component';
import { RibbonTabListComponent } from './ribbon-tab-list.component';
import type { RibbonTab } from './ribbon-types';

@Component({
	selector: 'pptx-ribbon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		TranslatePipe,
		RibbonPrimaryRowComponent,
		RibbonTabListComponent,
		RibbonContentComponent,
		RibbonContentSecondaryComponent,
	],
	template: `
		<div
			role="toolbar"
			[attr.aria-label]="'pptx.toolbar.presentationToolbarAria' | translate"
			class="relative z-20 overflow-visible border-b border-border bg-secondary/50"
		>
			<pptx-ribbon-primary-row
				[slideCount]="slideCount()"
				[sidebarCollapsed]="sidebarCollapsed()"
				[inspectorOpen]="inspectorOpen()"
				[commentsOpen]="commentsOpen()"
				[commentCount]="commentCount()"
				[hiddenActions]="hiddenActions()"
				(toggleSidebar)="toggleSidebar.emit()"
				(toggleComments)="comments.emit()"
				(present)="present.emit()"
				(presenter)="presenter.emit()"
				(broadcast)="broadcast.emit()"
				(openCustomShows)="openCustomShows.emit()"
				(toggleInspector)="toggleInspector.emit()"
				(exportPng)="exportPng.emit()"
				(exportPdf)="exportPdf.emit()"
				(exportGif)="exportGif.emit()"
				(exportVideo)="exportVideo.emit()"
				(print)="print.emit()"
				(info)="info.emit()"
				(a11y)="a11y.emit()"
				(save)="save.emit()"
			/>

			<pptx-ribbon-tab-list
				[activeTab]="activeTab()"
				[canEdit]="canEdit()"
				[collabConnected]="collabConnected()"
				[connectedCount]="connectedCount()"
				[ribbonExpanded]="ribbonExpanded()"
				[hiddenActions]="hiddenActions()"
				(selectTab)="activeTab.set($event)"
				(record)="record.emit()"
				(share)="share.emit()"
				(toggleRibbonExpanded)="ribbonExpanded.set(!ribbonExpanded())"
			/>

			<div
				class="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-2 py-1"
				[style.display]="ribbonExpanded() ? null : 'none'"
			>
				<pptx-ribbon-content
					[activeTab]="activeTab()"
					[slideIndex]="slideIndex()"
					[slideCount]="slideCount()"
					[canEdit]="canEdit()"
					[selectedElement]="selectedElement()"
					[formatPainterActive]="formatPainterActive()"
					[canActivateFormatPainter]="canActivateFormatPainter()"
					[exporting]="exporting()"
					[hasMacros]="hasMacros()"
					[hiddenActions]="hiddenActions()"
					[accountAuth]="accountAuth()"
					(selectTab)="activeTab.set($event)"
					(find)="find.emit()"
					(share)="share.emit()"
					(openFile)="openFile.emit()"
					(openRecentFile)="openRecentFile.emit($event)"
					(createPresentation)="createPresentation.emit($event)"
					(save)="save.emit()"
					(savePpsx)="savePpsx.emit()"
					(savePptm)="savePptm.emit()"
					(packageForSharing)="packageForSharing.emit()"
					(signatures)="signatures.emit()"
					(info)="info.emit()"
					(print)="print.emit()"
					(toggleFormatPainter)="toggleFormatPainter.emit()"
					(exportPng)="exportPng.emit()"
					(exportPdf)="exportPdf.emit()"
					(exportGif)="exportGif.emit()"
					(exportVideo)="exportVideo.emit()"
					(copySlideAsImage)="copySlideAsImage.emit()"
					(replace)="replace.emit()"
					(openSmartArtDialog)="openSmartArtDialog.emit()"
					(openEquationDialog)="openEquationDialog.emit()"
					(openPassword)="openPassword.emit()"
					(openFontEmbedding)="openFontEmbedding.emit()"
					(openVersionHistory)="openVersionHistory.emit()"
					(openSettings)="requestSettings()"
					(shapeInsert)="shapeInsert.emit($event)"
					(moveLayer)="moveLayer.emit($event)"
					(moveLayerToEdge)="moveLayerToEdge.emit($event)"
				/>
				<pptx-ribbon-content-secondary
					[activeTab]="activeTab()"
					[slideIndex]="slideIndex()"
					[slideCount]="slideCount()"
					[canEdit]="canEdit()"
					[selectedElement]="selectedElement()"
					[showGrid]="showGrid()"
					[showRulers]="showRulers()"
					[showGuides]="showGuides()"
					[snapToGrid]="snapToGrid()"
					[snapToShape]="snapToShape()"
					[eyedropperActive]="eyedropperActive()"
					[themeGalleryOpen]="themeGalleryOpen()"
					[spellCheckEnabled]="spellCheckEnabled()"
					[showSubtitles]="showSubtitles()"
					[hiddenActions]="hiddenActions()"
					(present)="present.emit()"
					(presenter)="presenter.emit()"
					(record)="record.emit()"
					(presentFromBeginning)="presentFromBeginning.emit()"
					(rehearseTimings)="rehearseTimings.emit()"
					(toggleSubtitles)="toggleSubtitles.emit()"
					(openSubtitleSettings)="openSubtitleSettings.emit()"
					(recordFromBeginning)="recordFromBeginning.emit()"
					(recordFromCurrent)="recordFromCurrent.emit()"
					(spellCheckChange)="setSpellCheck($event)"
					(broadcast)="broadcast.emit()"
					(info)="info.emit()"
					(print)="print.emit()"
					(comments)="comments.emit()"
					(a11y)="a11y.emit()"
					(link)="link.emit()"
					(openSorter)="openSorter.emit()"
					(openMasterView)="openMasterView.emit()"
					(toggleNotes)="toggleNotes.emit()"
					(toggleInspector)="toggleInspector.emit()"
					(drawToolChange)="drawToolChange.emit($event)"
					(toggleThemeGallery)="toggleThemeGallery.emit()"
					(toggleGrid)="toggleGrid.emit()"
					(toggleRulers)="toggleRulers.emit()"
					(toggleGuides)="toggleGuides.emit()"
					(toggleSelectionPane)="toggleSelectionPane.emit()"
					(openCustomShows)="openCustomShows.emit()"
					(toggleSnapToGrid)="toggleSnapToGrid.emit()"
					(toggleSnapToShape)="toggleSnapToShape.emit()"
					(addGuide)="addGuide.emit($event)"
					(zoomToFit)="zoomToFit.emit()"
					(toggleEyedropper)="toggleEyedropper.emit()"
					(openSetUpSlideShow)="openSetUpSlideShow.emit()"
					(openCompare)="openCompare.emit()"
					(openShortcuts)="openShortcuts.emit()"
					(openSettings)="requestSettings()"
				/>
			</div>
		</div>
	`,
})
export class RibbonComponent {
	readonly slideIndex = input<number>(0);
	readonly slideCount = input<number>(0);
	/** Whether the deck is editable (gates the template-editing toggle). */
	readonly canEdit = input<boolean>(false);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly zoomPercent = input<number>(100);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);
	readonly exporting = input<boolean>(false);
	readonly hasMacros = input<boolean>(false);
	/** Current visibility state of the grid overlay (for active-state styling). */
	readonly showGrid = input<boolean>(false);
	/** Current visibility state of rulers (for active-state styling). */
	readonly showRulers = input<boolean>(false);
	/** Current visibility state of center guide lines (for active-state styling). */
	readonly showGuides = input<boolean>(false);
	/** Current state of snap-to-grid (for active-state styling). */
	readonly snapToGrid = input<boolean>(false);
	readonly snapToShape = input<boolean>(true);
	/** Current state of eyedropper tool (for active-state styling). */
	readonly eyedropperActive = input<boolean>(false);
	/** Current visibility state of the theme gallery overlay (for active-state styling). */
	readonly themeGalleryOpen = input<boolean>(false);
	/** Whether the slides panel is collapsed (drives the top-bar toggle state). */
	readonly sidebarCollapsed = input<boolean>(false);
	/** Whether the right-docked inspector is open (top-bar toggle state). */
	readonly inspectorOpen = input<boolean>(false);
	/** Whether the comments panel is open (top-bar comments toggle state). */
	readonly commentsOpen = input<boolean>(false);
	/** Comment count on the active slide (top-bar comments badge). */
	readonly commentCount = input<number>(0);
	/** Whether the find/replace bar is open (top-bar find toggle state). */
	readonly findOpen = input<boolean>(false);
	/** Whether a collaboration session is connected (Share button styling). */
	readonly collabConnected = input<boolean>(false);
	/** Connected collaborator count (Share button label). */
	readonly connectedCount = input<number>(0);
	/** Current live proofing state shown by the Review ribbon command. */
	readonly spellCheckEnabled = input<boolean>(false);
	readonly showSubtitles = input<boolean>(false);
	/** Toolbar buttons/tabs the host wants hidden. Default `[]` hides nothing. */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	/** Optional sign-in hook point for File > Account. Absent/disabled by default. */
	readonly accountAuth = input<AccountAuthConfig | undefined>(undefined);

	readonly prev = output<void>();
	readonly next = output<void>();
	readonly zoomIn = output<void>();
	readonly zoomOut = output<void>();
	readonly zoomReset = output<void>();
	readonly find = output<void>();
	readonly present = output<void>();
	readonly presenter = output<void>();
	/** Emitted by the tab-row Record button (starts a slide-show run-through). */
	readonly record = output<void>();
	readonly presentFromBeginning = output<void>();
	readonly rehearseTimings = output<void>();
	readonly toggleSubtitles = output<void>();
	readonly openSubtitleSettings = output<void>();
	readonly recordFromBeginning = output<void>();
	readonly recordFromCurrent = output<void>();
	readonly spellCheckChange = output<boolean>();
	readonly share = output<void>();
	readonly broadcast = output<void>();
	readonly openFile = output<void>();
	readonly openRecentFile = output<string>();
	readonly createPresentation = output<string>();
	/** Emitted when the user clicks "Save" in the File tab (saves as .pptx). */
	readonly save = output<void>();
	readonly savePpsx = output<void>();
	readonly savePptm = output<void>();
	readonly packageForSharing = output<void>();
	/** Emitted when the user toggles the slides panel from the top bar. */
	readonly toggleSidebar = output<void>();
	/** Emitted when the user opens the Digital Signatures panel from the File tab. */
	readonly signatures = output<void>();
	readonly info = output<void>();
	readonly print = output<void>();
	readonly comments = output<void>();
	readonly a11y = output<void>();
	readonly link = output<void>();
	readonly openSorter = output<void>();
	readonly openMasterView = output<void>();
	readonly toggleNotes = output<void>();
	readonly toggleFormatPainter = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly copySlideAsImage = output<void>();
	readonly replace = output<void>();
	/** Design/Transitions/Animations tabs want the right-docked Inspector panel opened. */
	readonly toggleInspector = output<void>();
	/** Draw tab tool state changed (tool/colour/width); UI-only, no ink back-end yet. */
	readonly drawToolChange = output<DrawToolState>();
	/** Emitted when the user clicks "Browse Themes" in the Design tab. */
	readonly toggleThemeGallery = output<void>();
	/** Emitted when the user toggles the grid overlay in the View tab. */
	readonly toggleGrid = output<void>();
	/** Emitted when the user toggles rulers in the View tab. */
	readonly toggleRulers = output<void>();
	/** Emitted when the user toggles center guide lines in the View tab. */
	readonly toggleGuides = output<void>();
	/** Emitted when the user clicks "Selection Pane" in the View tab. */
	readonly toggleSelectionPane = output<void>();
	/** Emitted when the user clicks "Custom Shows" in the Slide Show tab. */
	readonly openCustomShows = output<void>();
	/** Emitted when the user toggles snap-to-grid in the View tab. */
	readonly toggleSnapToGrid = output<void>();
	readonly toggleSnapToShape = output<void>();
	readonly addGuide = output<'x' | 'y'>();
	readonly zoomToFit = output<void>();
	/** Emitted when the user activates the eyedropper in the View tab. */
	readonly toggleEyedropper = output<void>();
	/** "SmartArt" in the Insert tab; the host opens the gallery dialog and does the insert. */
	readonly openSmartArtDialog = output<void>();
	/** Emitted when the user clicks "Equation" in the Insert tab (opens the editor). */
	readonly openEquationDialog = output<void>();
	/** Emitted when the user clicks "Set Up Show" in the Slide Show tab. */
	readonly openSetUpSlideShow = output<void>();
	/** Emitted when the user clicks "Compare" in the Review tab. */
	readonly openCompare = output<void>();
	/** Emitted when the user clicks "Password" in the Review tab. */
	readonly openPassword = output<void>();
	/** Emitted when the user clicks "Fonts" in the Review tab. */
	readonly openFontEmbedding = output<void>();
	/** Emitted when the user clicks "Version History" in the Review tab. */
	readonly openVersionHistory = output<void>();
	/** Emitted when the user clicks "Shortcuts" in the Help tab. */
	readonly openShortcuts = output<void>();
	/** Emitted when the user opens viewer preferences from the Help tab. */
	readonly openSettings = output<void>();
	/** Emitted when a shape is inserted from the Drawing group. */
	readonly shapeInsert = output<string>();
	/** Emitted when the user reorders an element layer (up/down). */
	readonly moveLayer = output<string>();
	/** Emitted when the user moves an element to front/back. */
	readonly moveLayerToEdge = output<string>();

	protected readonly activeTab = signal<RibbonTab>('home');

	/** Ribbon content expanded (true) vs collapsed to just the tab bar (false). */
	protected readonly ribbonExpanded = signal(true);

	/** Route both File Options and Review Language to the real Settings dialog. */
	protected requestSettings(): void {
		this.openSettings.emit();
	}

	/** Forward the Review proofing toggle to the viewer-owned live state. */
	protected setSpellCheck(enabled: boolean): void {
		this.spellCheckChange.emit(enabled);
	}
}
