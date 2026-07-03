/**
 * ribbon.component.ts: Office-style tabbed ribbon for the Angular editor chrome.
 *
 * 1:1 port of React's `viewer/components/Toolbar.tsx` + its `toolbar/*Section`
 * components, built with the Tailwind 4 utility classes shared across the
 * React/Vue/Angular packages (see `styles/theme.css`). Replaces the previous
 * flat button-row header.
 *
 * Layout (mirrors React):
 *   - Primary quick-access row: undo/redo, find, zoom · spacer · present/share/
 *     export/info/print/a11y/comments/link
 *   - Tab bar: File/Home/Insert/Text/Draw/Arrange/Design/Transitions/Animations/
 *     Slide Show/Review/View/Help
 *   - Ribbon content: the active tab's grouped controls
 *
 * This component is a thin shell: the tab bar plus a `@switch` that dispatches to
 * one standalone section component per tab (`ribbon-*-section.component.ts`),
 * mirroring Vue's `ribbon/*Section.vue` split. Tab-local state that must survive
 * tab switches (draw tool, transition preset/duration, insert chart type) lives
 * here and is passed to the sections as inputs, so switching tabs never resets
 * it. Everything else is wired through the shared {@link EditorStateService}
 * (injected by each section) or bubbled up as `output()` events the
 * {@link PowerPointViewerComponent} already handles.
 */
import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxChartType, PptxElement, PptxTransitionType } from 'pptx-viewer-core';

import { DEFAULT_INSERT_CHART_TYPE } from '../internal/shared';
import { RibbonAnimationsSectionComponent } from './ribbon-animations-section.component';
import { RibbonArrangeSectionComponent } from './ribbon-arrange-section.component';
import { RibbonDesignSectionComponent } from './ribbon-design-section.component';
import type { DrawTool, DrawToolState } from './ribbon-draw-section.component';
import { RibbonDrawSectionComponent } from './ribbon-draw-section.component';
import { RibbonFileSectionComponent } from './ribbon-file-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { RibbonHomeSectionComponent } from './ribbon-home-section.component';
import { RibbonInsertSectionComponent } from './ribbon-insert-section.component';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';
import { RibbonPrimaryRowComponent } from './ribbon-primary-row.component';
import { RibbonReviewSectionComponent } from './ribbon-review-section.component';
import { RibbonSlideshowSectionComponent } from './ribbon-slideshow-section.component';
import { RibbonTransitionsSectionComponent } from './ribbon-transitions-section.component';
import { RibbonViewSectionComponent } from './ribbon-view-section.component';

/** Ribbon tab identifiers (mirrors React `TOOLBAR_SECTIONS`). */
type RibbonTab =
	| 'file'
	| 'home'
	| 'insert'
	| 'text'
	| 'draw'
	| 'arrange'
	| 'design'
	| 'transitions'
	| 'animations'
	| 'slideShow'
	| 'review'
	| 'view'
	| 'help';

interface TabDef {
	id: RibbonTab;
	labelKey: string;
}

const TABS: readonly TabDef[] = [
	{ id: 'file', labelKey: 'pptx.ribbon.tab.file' },
	{ id: 'home', labelKey: 'pptx.ribbon.tab.home' },
	{ id: 'insert', labelKey: 'pptx.ribbon.tab.insert' },
	{ id: 'text', labelKey: 'pptx.ribbon.tab.text' },
	{ id: 'draw', labelKey: 'pptx.ribbon.tab.draw' },
	{ id: 'arrange', labelKey: 'pptx.ribbon.tab.arrange' },
	{ id: 'design', labelKey: 'pptx.ribbon.tab.design' },
	{ id: 'transitions', labelKey: 'pptx.ribbon.tab.transitions' },
	{ id: 'animations', labelKey: 'pptx.ribbon.tab.animations' },
	{ id: 'slideShow', labelKey: 'pptx.ribbon.tab.slideShow' },
	{ id: 'review', labelKey: 'pptx.ribbon.tab.review' },
	{ id: 'view', labelKey: 'pptx.ribbon.tab.view' },
	{ id: 'help', labelKey: 'pptx.ribbon.tab.help' },
];

@Component({
	selector: 'pptx-ribbon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		NgClass,
		TranslatePipe,
		RibbonPrimaryRowComponent,
		RibbonFileSectionComponent,
		RibbonHomeSectionComponent,
		RibbonInsertSectionComponent,
		RibbonFontControlsComponent,
		RibbonParagraphControlsComponent,
		RibbonArrangeSectionComponent,
		RibbonSlideshowSectionComponent,
		RibbonReviewSectionComponent,
		RibbonViewSectionComponent,
		RibbonDrawSectionComponent,
		RibbonDesignSectionComponent,
		RibbonTransitionsSectionComponent,
		RibbonAnimationsSectionComponent,
	],
	template: `
		<div
			role="toolbar"
			aria-label="Presentation toolbar"
			class="relative z-20 overflow-visible border-b border-border bg-secondary/50"
		>
			<!-- ── Primary quick-access row (ToolbarPrimaryRow parity) ──── -->
			<pptx-ribbon-primary-row
				[slideCount]="slideCount()"
				[canEdit]="canEdit()"
				[sidebarCollapsed]="sidebarCollapsed()"
				[inspectorOpen]="inspectorOpen()"
				[commentsOpen]="commentsOpen()"
				[commentCount]="commentCount()"
				[findOpen]="findOpen()"
				[collabConnected]="collabConnected()"
				[connectedCount]="connectedCount()"
				(toggleSidebar)="toggleSidebar.emit()"
				(toggleFind)="replace.emit()"
				(toggleComments)="comments.emit()"
				(present)="present.emit()"
				(presenter)="presenter.emit()"
				(broadcast)="broadcast.emit()"
				(openCustomShows)="openCustomShows.emit()"
				(share)="share.emit()"
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

			<!-- ── Tab bar ───────────────────────────────────────────────────── -->
			<div class="flex items-center border-b border-border/60 px-1">
				@for (t of tabs; track t.id) {
					<button
						type="button"
						(click)="activeTab.set(t.id)"
						class="relative whitespace-nowrap px-3.5 py-2 text-[12px] font-medium transition-colors"
						[ngClass]="
							activeTab() === t.id
								? 'text-foreground after:absolute after:-bottom-px after:left-0 after:right-0 after:h-[2.5px] after:bg-primary'
								: 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
						"
					>
						{{ t.labelKey | translate }}
					</button>
				}
				<div class="flex-1"></div>
				<button
					type="button"
					class="mr-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
					[attr.aria-pressed]="!ribbonExpanded()"
					[title]="
						(ribbonExpanded() ? 'pptx.ribbon.collapseRibbon' : 'pptx.ribbon.expandRibbon')
							| translate
					"
					(click)="ribbonExpanded.set(!ribbonExpanded())"
				>
					{{ ribbonExpanded() ? '▴' : '▾' }}
				</button>
			</div>

			<!-- ── Ribbon content (collapsible via the ribbon toggle) ──────────── -->
			<div
				class="flex flex-nowrap items-stretch gap-1.5 overflow-x-auto px-2 py-1.5"
				[style.display]="ribbonExpanded() ? null : 'none'"
			>
				@switch (activeTab()) {
					@case ('file') {
						<pptx-ribbon-file-section
							[slideCount]="slideCount()"
							[exporting]="exporting()"
							(openFile)="openFile.emit()"
							(save)="save.emit()"
							(exportPng)="exportPng.emit()"
							(exportPdf)="exportPdf.emit()"
							(exportGif)="exportGif.emit()"
							(exportVideo)="exportVideo.emit()"
							(print)="print.emit()"
							(info)="info.emit()"
							(signatures)="signatures.emit()"
							(replace)="replace.emit()"
							(openPassword)="openPassword.emit()"
							(openFontEmbedding)="openFontEmbedding.emit()"
							(openVersionHistory)="openVersionHistory.emit()"
						/>
					}
					@case ('home') {
						<pptx-ribbon-home-section
							[slideIndex]="slideIndex()"
							[selectedElement]="selectedElement()"
							[formatPainterActive]="formatPainterActive()"
							[canActivateFormatPainter]="canActivateFormatPainter()"
							(toggleFormatPainter)="toggleFormatPainter.emit()"
						/>
					}
					@case ('insert') {
						<pptx-ribbon-insert-section
							[slideIndex]="slideIndex()"
							[newChartType]="newChartType()"
							(chartTypeChange)="newChartType.set($event)"
							(openSmartArtDialog)="openSmartArtDialog.emit()"
							(openEquationDialog)="openEquationDialog.emit()"
						/>
					}
					@case ('text') {
						<pptx-ribbon-font-controls
							[slideIndex]="slideIndex()"
							[selectedElement]="selectedElement()"
						/>
						<span class="pptx-rb-sep"></span>
						<pptx-ribbon-paragraph-controls
							[slideIndex]="slideIndex()"
							[selectedElement]="selectedElement()"
						/>
					}
					@case ('arrange') {
						<pptx-ribbon-arrange-section
							[slideIndex]="slideIndex()"
							[formatPainterActive]="formatPainterActive()"
							[canActivateFormatPainter]="canActivateFormatPainter()"
							(toggleFormatPainter)="toggleFormatPainter.emit()"
						/>
					}
					@case ('slideShow') {
						<pptx-ribbon-slideshow-section
							[slideCount]="slideCount()"
							(present)="present.emit()"
							(presenter)="presenter.emit()"
							(broadcast)="broadcast.emit()"
							(openCustomShows)="openCustomShows.emit()"
							(openSetUpSlideShow)="openSetUpSlideShow.emit()"
						/>
					}
					@case ('review') {
						<pptx-ribbon-review-section
							(comments)="comments.emit()"
							(a11y)="a11y.emit()"
							(openCompare)="openCompare.emit()"
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
							[eyedropperActive]="eyedropperActive()"
							(openSorter)="openSorter.emit()"
							(toggleNotes)="toggleNotes.emit()"
							(print)="print.emit()"
							(openShortcuts)="openShortcuts.emit()"
							(toggleGrid)="toggleGrid.emit()"
							(toggleRulers)="toggleRulers.emit()"
							(toggleGuides)="toggleGuides.emit()"
							(toggleSelectionPane)="toggleSelectionPane.emit()"
							(toggleSnapToGrid)="toggleSnapToGrid.emit()"
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
							(info)="info.emit()"
							(toggleInspector)="toggleInspector.emit()"
						/>
					}
					@case ('transitions') {
						<pptx-ribbon-transitions-section
							[slideIndex]="slideIndex()"
							[selectedTransition]="selectedTransition()"
							[transitionDurationSec]="transitionDurationSec()"
							(transitionChange)="selectedTransition.set($event)"
							(durationChange)="transitionDurationSec.set($event)"
							(present)="present.emit()"
							(toggleInspector)="toggleInspector.emit()"
						/>
					}
					@case ('animations') {
						<pptx-ribbon-animations-section
							[slideIndex]="slideIndex()"
							[selectedElement]="selectedElement()"
							(present)="present.emit()"
							(toggleInspector)="toggleInspector.emit()"
						/>
					}
					@case ('help') {
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">
							{{ 'pptx.ribbon.accessibility' | translate }}
						</button>
					}
				}
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
	/** Current visibility state of the grid overlay (for active-state styling). */
	readonly showGrid = input<boolean>(false);
	/** Current visibility state of rulers (for active-state styling). */
	readonly showRulers = input<boolean>(false);
	/** Current visibility state of center guide lines (for active-state styling). */
	readonly showGuides = input<boolean>(false);
	/** Current state of snap-to-grid (for active-state styling). */
	readonly snapToGrid = input<boolean>(false);
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

	readonly prev = output<void>();
	readonly next = output<void>();
	readonly zoomIn = output<void>();
	readonly zoomOut = output<void>();
	readonly zoomReset = output<void>();
	readonly find = output<void>();
	readonly present = output<void>();
	readonly presenter = output<void>();
	readonly share = output<void>();
	readonly broadcast = output<void>();
	readonly openFile = output<void>();
	/** Emitted when the user clicks "Save" in the File tab (saves as .pptx). */
	readonly save = output<void>();
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
	readonly toggleNotes = output<void>();
	readonly toggleFormatPainter = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly replace = output<void>();
	/**
	 * Emitted by Design / Transitions / Animations tabs when the user wants to
	 * open the right-docked Inspector panel (Format Background, Transitions full
	 * options, Animation Panel). The parent component decides what to show.
	 */
	readonly toggleInspector = output<void>();
	/**
	 * Emitted whenever the Draw tab tool state changes (tool / colour / width).
	 * The parent may connect this to an annotation / ink layer when available.
	 * Currently UI-only; no freehand-draw back-end exists in the Angular port.
	 */
	readonly drawToolChange = output<DrawToolState>();
	/**
	 * Emitted when the user clicks "Browse Themes" in the Design tab.
	 * The parent toggles the theme-gallery overlay.
	 */
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
	/** Emitted when the user activates the eyedropper in the View tab. */
	readonly toggleEyedropper = output<void>();
	/**
	 * Emitted when the user clicks "SmartArt" in the Insert tab. The host opens
	 * the Insert SmartArt gallery dialog and performs the actual insert, so the
	 * ribbon stays free of the dialog state and node-building logic.
	 */
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

	protected readonly tabs = TABS;

	protected readonly activeTab = signal<RibbonTab>('home');

	/** Ribbon content expanded (true) vs collapsed to just the tab bar (false). */
	protected readonly ribbonExpanded = signal(true);

	// ── Tab-local state (owned here so it survives tab switches) ────────────────
	/** The chart type currently chosen in the Insert tab dropdown. */
	protected readonly newChartType = signal<PptxChartType>(DEFAULT_INSERT_CHART_TYPE);

	/** Active drawing tool (UI state only; no ink back-end yet). */
	protected readonly activeTool = signal<DrawTool>('select');
	/** Drawing pen colour (UI state only). */
	protected readonly drawingColor = signal<string>('#000000');
	/** Drawing stroke width in pixels (UI state only). */
	protected readonly drawingWidth = signal<number>(3);

	/** The transition type currently selected in the ribbon gallery. */
	protected readonly selectedTransition = signal<PptxTransitionType>('none');
	/** Transition duration in seconds (round-trips through the UI input). */
	protected readonly transitionDurationSec = signal<number>(0.5);

	/** Sync the draw-tool signals with a Draw-tab change and re-broadcast it. */
	protected onDrawChange(state: DrawToolState): void {
		this.activeTool.set(state.tool);
		this.drawingColor.set(state.color);
		this.drawingWidth.set(state.width);
		this.drawToolChange.emit(state);
	}
}
