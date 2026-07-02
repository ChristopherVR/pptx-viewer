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
 * Editing actions are wired straight to the shared {@link EditorStateService}
 * (provided at the viewer root, so this child injects the same instance).
 * Cross-cutting viewer actions (zoom/find/present/export/panels) come in as
 * `output()` events the {@link PowerPointViewerComponent} already has handlers for.
 */
import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import type {
	PptxAnimationPreset,
	PptxChartType,
	PptxElement,
	PptxSlide,
	PptxTransitionType,
} from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import { INSERT_CHART_TYPES, DEFAULT_INSERT_CHART_TYPE } from '../internal/shared';
import {
	EMPHASIS_PRESETS,
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	removeAnimation,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
} from './animation-author-helpers';
import { newChartElement, newShapeElement, newTableElement, newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { RibbonInsertFieldsComponent } from './ribbon-insert-fields.component';
import { RibbonPrimaryRowComponent } from './ribbon-primary-row.component';

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
	label: string;
}

const TABS: readonly TabDef[] = [
	{ id: 'file', label: 'File' },
	{ id: 'home', label: 'Home' },
	{ id: 'insert', label: 'Insert' },
	{ id: 'text', label: 'Text' },
	{ id: 'draw', label: 'Draw' },
	{ id: 'arrange', label: 'Arrange' },
	{ id: 'design', label: 'Design' },
	{ id: 'transitions', label: 'Transitions' },
	{ id: 'animations', label: 'Animations' },
	{ id: 'slideShow', label: 'Slide Show' },
	{ id: 'review', label: 'Review' },
	{ id: 'view', label: 'View' },
	{ id: 'help', label: 'Help' },
];

/** Drawing tool IDs (mirrors React DRAW_TOOLS). */
type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

interface DrawToolDef {
	id: DrawTool;
	label: string;
	icon: string;
}

const DRAW_TOOLS: readonly DrawToolDef[] = [
	{ id: 'select', label: 'Select', icon: '↖' },
	{ id: 'pen', label: 'Pen', icon: '✏' },
	{ id: 'highlighter', label: 'Highlighter', icon: 'Hl' },
	{ id: 'eraser', label: 'Eraser', icon: '⌫' },
	{ id: 'freeform', label: 'Freeform', icon: '∿' },
];

/**
 * Transition presets shown in the Transitions ribbon tab (mirrors React
 * `TRANSITION_PRESETS` in `DesignTransitionsReviewSection.tsx`).
 */
const TRANSITION_PRESETS: ReadonlyArray<{ value: PptxTransitionType; label: string }> = [
	{ value: 'none', label: 'None' },
	{ value: 'fade', label: 'Fade' },
	{ value: 'push', label: 'Push' },
	{ value: 'wipe', label: 'Wipe' },
	{ value: 'split', label: 'Split' },
	{ value: 'reveal', label: 'Reveal' },
	{ value: 'cut', label: 'Cut' },
	{ value: 'cover', label: 'Cover' },
	{ value: 'uncover', label: 'Uncover' },
];

/** Font families offered in the Home tab (mirrors React). */
const FONT_FAMILIES = [
	'Segoe UI',
	'Arial',
	'Calibri',
	'Times New Roman',
	'Georgia',
	'Courier New',
	'Verdana',
	'Tahoma',
];
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 54, 66, 80, 96];
/** Font-colour swatches in the Home/Text colour popover (mirrors React/Vue). */
const FONT_COLOR_PRESETS = [
	'#000000',
	'#ffffff',
	'#ff0000',
	'#00aa00',
	'#0000ff',
	'#ff8800',
	'#8800cc',
	'#00cccc',
	'#ff69b4',
	'#808080',
];

/** Text-highlight swatches in the Home/Text highlight popover (mirrors React/Vue). */
const HIGHLIGHT_COLOR_PRESETS = [
	'#ffff00',
	'#00ff00',
	'#00ffff',
	'#ff00ff',
	'#0000ff',
	'#ff0000',
	'#000080',
	'#008080',
	'#008000',
	'#800080',
];

/** Read a File as a base64 data URL, resolving to '' on failure. */
function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
		reader.onerror = () => resolve('');
		reader.readAsDataURL(file);
	});
}

/** Resolve an image data URL's natural dimensions (falls back to 400x300). */
function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () =>
			resolve({ width: img.naturalWidth || 400, height: img.naturalHeight || 300 });
		img.onerror = () => resolve({ width: 400, height: 300 });
		img.src = dataUrl;
	});
}

@Component({
	selector: 'pptx-ribbon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, NgTemplateOutlet, RibbonPrimaryRowComponent, RibbonInsertFieldsComponent],
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
						{{ t.label }}
					</button>
				}
				<div class="flex-1"></div>
				<button
					type="button"
					class="mr-1 rounded px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
					[attr.aria-pressed]="!ribbonExpanded()"
					[title]="ribbonExpanded() ? 'Collapse the ribbon' : 'Expand the ribbon'"
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
						<button
							type="button"
							class="pptx-rb-pill"
							(click)="openFile.emit()"
							title="Open another presentation"
						>
							Open
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="save.emit()"
							title="Save as .pptx"
						>
							Save
						</button>
						<span class="pptx-rb-sep"></span>
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportPng.emit()"
								title="Export current slide as PNG"
							>
								PNG
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportPdf.emit()"
								title="Export deck as PDF"
							>
								{{ exporting() ? 'Exporting…' : 'PDF' }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportGif.emit()"
								title="Export as GIF"
							>
								GIF
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportVideo.emit()"
								title="Export as WebM video"
							>
								Video
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<button type="button" class="pptx-rb-pill" (click)="print.emit()">Print</button>
						<button type="button" class="pptx-rb-pill" (click)="info.emit()">Properties</button>
						<button type="button" class="pptx-rb-pill" (click)="signatures.emit()">
							Signatures
						</button>
						<button type="button" class="pptx-rb-pill" (click)="replace.emit()">Replace</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Protect with a password"
							(click)="openPassword.emit()"
						>
							Protect
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Manage embedded fonts"
							(click)="openFontEmbedding.emit()"
						>
							Embed Fonts
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Browse saved versions"
							(click)="openVersionHistory.emit()"
						>
							Version History
						</button>
					}
					@case ('home') {
						<!-- Clipboard -->
						<div class="flex flex-col items-center gap-0.5">
							<div class="pptx-rb-grp">
								<button type="button" class="pptx-rb-gb" title="Paste" (click)="paste()">
									Paste
								</button>
								<button
									type="button"
									class="pptx-rb-gb"
									title="Cut"
									[disabled]="!hasSel()"
									(click)="cut()"
								>
									Cut
								</button>
								<button
									type="button"
									class="pptx-rb-gb"
									title="Copy"
									[disabled]="!hasSel()"
									(click)="copy()"
								>
									Copy
								</button>
								<button
									type="button"
									class="pptx-rb-gl"
									data-testid="format-painter-toggle"
									[attr.data-active]="formatPainterActive() ? 'true' : 'false'"
									[ngClass]="formatPainterActive() ? 'bg-primary text-primary-foreground' : ''"
									[disabled]="!canActivateFormatPainter() && !formatPainterActive()"
									title="Format painter"
									(click)="toggleFormatPainter.emit()"
								>
									Painter
								</button>
							</div>
							<span class="text-[9px] leading-none text-muted-foreground">Clipboard</span>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Slides -->
						<div class="flex flex-col items-center gap-0.5">
							<div class="pptx-rb-grp">
								<button
									type="button"
									class="pptx-rb-gb"
									title="New slide"
									(click)="editor.addSlide(slideIndex())"
								>
									＋ Slide
								</button>
								<button
									type="button"
									class="pptx-rb-gl"
									title="Duplicate slide"
									(click)="editor.duplicateSlide(slideIndex())"
								>
									Duplicate
								</button>
							</div>
							<span class="text-[9px] leading-none text-muted-foreground">Slides</span>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Font -->
						<div class="flex flex-col items-center gap-0.5">
							<div class="flex items-center gap-1">
								<ng-container [ngTemplateOutlet]="fontControls" />
							</div>
							<span class="text-[9px] leading-none text-muted-foreground">Font</span>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Paragraph -->
						<div class="flex flex-col items-center gap-0.5">
							<ng-container [ngTemplateOutlet]="paragraphControls" />
							<span class="text-[9px] leading-none text-muted-foreground">Paragraph</span>
						</div>
					}
					@case ('insert') {
						<!-- Shapes group -->
						<div class="pptx-rb-grp">
							<button type="button" class="pptx-rb-gb" (click)="insertText()" title="Text box">
								Text Box
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('rect')"
								title="Rectangle"
							>
								▭ Rect
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('ellipse')"
								title="Ellipse"
							>
								◯ Ellipse
							</button>
							<button type="button" class="pptx-rb-gb" (click)="insertShape('line')" title="Line">
								／ Line
							</button>
							<button type="button" class="pptx-rb-gb" (click)="insertImage()" title="Insert image">
								🖼 Image
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								(click)="insertMedia()"
								title="Insert audio or video"
							>
								🎬 Media
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Data / diagram group -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertTable()"
								title="Insert 3×3 table"
							>
								⊞ Table
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertSmartArt()"
								title="Insert SmartArt diagram"
							>
								◈ SmartArt
							</button>
							<select
								class="pptx-rb-gl"
								title="Chart type"
								[value]="newChartType()"
								(change)="setNewChartType($event)"
							>
								@for (ct of chartTypes; track ct.type) {
									<option [value]="ct.type">{{ ct.label }}</option>
								}
							</select>
							<button type="button" class="pptx-rb-gb" (click)="insertChart()" title="Insert chart">
								▥ Chart
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								(click)="insertEquation()"
								title="Insert equation (E = mc²)"
							>
								∑ Equation
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Action button + Field dropdowns -->
						<pptx-ribbon-insert-fields [slideIndex]="slideIndex()" />
					}
					@case ('text') {
						<ng-container [ngTemplateOutlet]="fontControls" />
						<span class="pptx-rb-sep"></span>
						<ng-container [ngTemplateOutlet]="paragraphControls" />
					}
					@case ('arrange') {
						<!-- Order -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Bring to front"
								(click)="editor.bringSelectedToFront(slideIndex())"
							>
								Front
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Send to back"
								(click)="editor.sendSelectedToBack(slideIndex())"
							>
								Back
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Bring forward"
								(click)="editor.bringSelectedForward(slideIndex())"
							>
								Fwd
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Send backward"
								(click)="editor.sendSelectedBackward(slideIndex())"
							>
								Bwd
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Align -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align left"
								(click)="editor.alignSelected(slideIndex(), 'left')"
							>
								⇤
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align center"
								(click)="editor.alignSelected(slideIndex(), 'centerH')"
							>
								⇔
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align right"
								(click)="editor.alignSelected(slideIndex(), 'right')"
							>
								⇥
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align top"
								(click)="editor.alignSelected(slideIndex(), 'top')"
							>
								⤒
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Align middle"
								(click)="editor.alignSelected(slideIndex(), 'middle')"
							>
								⇕
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Align bottom"
								(click)="editor.alignSelected(slideIndex(), 'bottom')"
							>
								⤓
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Distribute -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!canDistribute()"
								title="Distribute horizontally"
								(click)="editor.distributeSelected(slideIndex(), 'horizontal')"
							>
								&#x2194; H
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!canDistribute()"
								title="Distribute vertically"
								(click)="editor.distributeSelected(slideIndex(), 'vertical')"
							>
								&#x2195; V
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Clipboard -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Copy"
								(click)="copy()"
							>
								Copy
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Cut"
								(click)="cut()"
							>
								Cut
							</button>
							<button type="button" class="pptx-rb-gl" title="Paste" (click)="paste()">
								Paste
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Format painter + flip -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								data-testid="format-painter-toggle"
								[attr.data-active]="formatPainterActive() ? 'true' : 'false'"
								[ngClass]="formatPainterActive() ? 'bg-primary text-primary-foreground' : ''"
								[disabled]="!canActivateFormatPainter() && !formatPainterActive()"
								title="Format painter"
								(click)="toggleFormatPainter.emit()"
							>
								Painter
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Flip horizontally"
								(click)="flipSelected('horizontal')"
							>
								Flip H
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Flip vertically"
								(click)="flipSelected('vertical')"
							>
								Flip V
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Group / edit -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Group"
								(click)="editor.groupSelected(slideIndex())"
							>
								Group
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Ungroup"
								(click)="editor.ungroupSelected(slideIndex())"
							>
								Ungroup
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								title="Duplicate"
								(click)="editor.duplicateSelected(slideIndex())"
							>
								Duplicate
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								title="Delete"
								(click)="editor.deleteSelected(slideIndex())"
							>
								Delete
							</button>
						</div>
					}
					@case ('slideShow') {
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="present.emit()"
						>
							From Beginning
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="presenter.emit()"
						>
							Presenter View
						</button>
						<button type="button" class="pptx-rb-pill" (click)="broadcast.emit()">Broadcast</button>
						<button type="button" class="pptx-rb-pill" (click)="openCustomShows.emit()">
							Custom Shows
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Set up how the show runs"
							(click)="openSetUpSlideShow.emit()"
						>
							Set Up Show
						</button>
					}
					@case ('review') {
						<button type="button" class="pptx-rb-pill" (click)="comments.emit()">Comments</button>
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">Accessibility</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Compare with another presentation"
							(click)="openCompare.emit()"
						>
							Compare
						</button>
						@if (hasSel()) {
							<button type="button" class="pptx-rb-pill" (click)="link.emit()">Link</button>
						}
					}
					@case ('view') {
						<!-- Presentation views -->
						<button type="button" class="pptx-rb-pill" (click)="openSorter.emit()">
							Slide Sorter
						</button>
						<button type="button" class="pptx-rb-pill" (click)="toggleNotes.emit()">Notes</button>
						<button type="button" class="pptx-rb-pill" (click)="print.emit()">Print</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Keyboard shortcut reference"
							(click)="openShortcuts.emit()"
						>
							Shortcuts
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Show / Hide overlays -->
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="showGrid() ? 'bg-primary text-primary-foreground' : ''"
							title="Toggle grid overlay"
							(click)="toggleGrid.emit()"
						>
							Grid
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="showRulers() ? 'bg-primary text-primary-foreground' : ''"
							title="Toggle rulers"
							(click)="toggleRulers.emit()"
						>
							Rulers
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="showGuides() ? 'bg-primary text-primary-foreground' : ''"
							title="Toggle center guide lines"
							(click)="toggleGuides.emit()"
						>
							Guides
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Show/hide the Selection pane"
							(click)="toggleSelectionPane.emit()"
						>
							Selection Pane
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="snapToGrid() ? 'bg-primary text-primary-foreground' : ''"
							title="Snap elements to grid while moving"
							(click)="toggleSnapToGrid.emit()"
						>
							Snap to Grid
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="!canEdit()"
							[ngClass]="editor.editTemplateMode() ? 'pptx-rb-template-active' : ''"
							title="Edit inherited master/layout (template) elements"
							(click)="editor.setEditTemplateMode(!editor.editTemplateMode())"
						>
							{{ editor.editTemplateMode() ? 'Templates On' : 'Templates Off' }}
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="eyedropperActive() ? 'pptx-rb-eyedropper-active' : ''"
							title="Pick colour from screen (EyeDropper)"
							(click)="toggleEyedropper.emit()"
						>
							Eyedropper
						</button>
					}
					@case ('draw') {
						<!--
							Draw tool state is held here in the ribbon as local signals.
							TODO: wire activeTool/drawingColor/drawingWidth to an actual
							freehand-ink layer when the editor annotation back-end ships.
							The toolbar is fully interactive and emits drawToolChange so
							the parent can opt in to the state.
						-->
						<!-- Tool selector -->
						<div class="pptx-rb-grp">
							@for (tool of drawTools; track tool.id; let last = $last) {
								<button
									type="button"
									[class]="last ? 'pptx-rb-gl' : 'pptx-rb-gb'"
									[ngClass]="activeTool() === tool.id ? 'bg-primary text-primary-foreground' : ''"
									[title]="tool.label"
									(click)="setDrawTool(tool.id)"
								>
									{{ tool.icon }}
								</button>
							}
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Colour + width -->
						<label
							class="inline-flex items-center gap-1 text-xs text-muted-foreground"
							title="Pen colour"
						>
							Colour
							<input
								type="color"
								[value]="drawingColor()"
								(input)="onDrawColorInput($event)"
								class="h-6 w-6 cursor-pointer rounded border border-border bg-transparent"
							/>
						</label>
						<span class="pptx-rb-sep"></span>
						<label
							class="inline-flex items-center gap-1 text-xs text-muted-foreground"
							title="Stroke width"
						>
							Width
							<input
								type="range"
								min="1"
								max="12"
								[value]="drawingWidth()"
								(input)="onDrawWidthInput($event)"
								class="h-1 w-16 accent-primary"
							/>
							<span class="w-4 text-right text-foreground">{{ drawingWidth() }}</span>
						</label>
					}
					@case ('design') {
						<!-- Themes -->
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="themeGalleryOpen() ? 'bg-primary text-primary-foreground' : ''"
							title="Browse and apply built-in themes"
							(click)="toggleThemeGallery.emit()"
						>
							Browse Themes
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Edit theme — theme editor not yet ported"
							(click)="info.emit()"
						>
							Edit Theme
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Customize -->
						<button
							type="button"
							class="pptx-rb-pill"
							title="Slide size / document properties"
							(click)="info.emit()"
						>
							Slide Size
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							title="Format slide background — opens the Inspector"
							(click)="toggleInspector.emit()"
						>
							Format Background
						</button>
					}
					@case ('transitions') {
						<!-- Preview (fires existing presentation present path; no separate preview API yet) -->
						<button
							type="button"
							class="pptx-rb-pill"
							title="Preview transition"
							(click)="present.emit()"
						>
							▶ Preview
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Preset gallery -->
						<div class="inline-flex max-w-[420px] items-center gap-0.5 overflow-x-auto">
							@for (t of transitionPresets; track t.value) {
								<button
									type="button"
									(click)="setTransition(t.value)"
									class="flex-shrink-0 rounded border px-2 py-1 text-[11px] leading-tight transition-colors"
									[ngClass]="
										selectedTransition() === t.value
											? 'border-primary bg-primary/10 font-medium text-primary'
											: 'border-border bg-muted text-foreground hover:bg-accent'
									"
									[title]="t.label + ' transition'"
								>
									{{ t.label }}
								</button>
							}
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Duration -->
						<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
							<span class="whitespace-nowrap">Duration:</span>
							<input
								type="number"
								min="0"
								max="10"
								step="0.1"
								[value]="transitionDurationSec()"
								(change)="onTransitionDurationChange($event)"
								class="pptx-rb-select w-16 text-center"
								title="Transition duration in seconds"
							/>
							<span>s</span>
						</label>
						<span class="pptx-rb-sep"></span>
						<!-- Apply to all -->
						<button
							type="button"
							class="pptx-rb-pill"
							title="Apply transition to all slides"
							(click)="applyTransitionToAll()"
						>
							⧉ Apply to All
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Inspector -->
						<button
							type="button"
							class="pptx-rb-pill"
							title="Open Inspector for full transition options"
							(click)="toggleInspector.emit()"
						>
							▤ Inspector
						</button>
					}
					@case ('animations') {
						<!-- Preview: plays presentation from this slide; no element-only preview API yet -->
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="!hasSel()"
							title="Preview animation for selected element"
							(click)="present.emit()"
						>
							▶ Preview
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Add Animation dropdown (hover-reveal, mirrors React pattern) -->
						<div class="group relative">
							<button
								type="button"
								class="pptx-rb-pill"
								[disabled]="!hasSel()"
								title="Add an animation to the selected element"
							>
								✨ Add Animation ▾
							</button>
							<!-- Dropdown panel: shown on group hover -->
							<div class="absolute left-0 top-full z-50 hidden w-44 pt-1 group-hover:block">
								<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
									<!-- Entrance group -->
									<div
										class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									>
										Entrance
									</div>
									@for (item of entrancePresets; track item.value) {
										<button
											type="button"
											[disabled]="!hasSel()"
											(click)="addAnimation(item.value, 'entrance')"
											class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
											[title]="'Entrance: ' + item.label"
										>
											{{ item.label }}
										</button>
									}
									<!-- Emphasis group -->
									<div
										class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									>
										Emphasis
									</div>
									@for (item of emphasisPresets; track item.value) {
										<button
											type="button"
											[disabled]="!hasSel()"
											(click)="addAnimation(item.value, 'emphasis')"
											class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
											[title]="'Emphasis: ' + item.label"
										>
											{{ item.label }}
										</button>
									}
									<!-- Exit group -->
									<div
										class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									>
										Exit
									</div>
									@for (item of exitPresets; track item.value) {
										<button
											type="button"
											[disabled]="!hasSel()"
											(click)="addAnimation(item.value, 'exit')"
											class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
											[title]="'Exit: ' + item.label"
										>
											{{ item.label }}
										</button>
									}
								</div>
							</div>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Remove Animation -->
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="!hasSel()"
							title="Remove all animations from the selected element"
							(click)="removeAnim()"
						>
							✕ Remove Animation
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Animation Panel -->
						<button
							type="button"
							class="pptx-rb-pill"
							title="Open Animation Inspector panel"
							(click)="toggleInspector.emit()"
						>
							▤ Animation Panel
						</button>
					}
					@case ('help') {
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">Accessibility</button>
					}
				}
			</div>
		</div>

		<!-- ── Reusable control groups ───────────────────────────────────────── -->
		<ng-template #fontControls>
			<div class="flex items-center gap-1">
				<select
					class="pptx-rb-select w-28"
					aria-label="Font family"
					[disabled]="!isText()"
					(change)="setFontFamily($event)"
				>
					@for (f of fontFamilies; track f) {
						<option [value]="f" [selected]="f === curFontFamily()">{{ f }}</option>
					}
				</select>
				<select
					class="pptx-rb-select w-14"
					aria-label="Font size"
					[disabled]="!isText()"
					(change)="setFontSize($event)"
				>
					@for (s of fontSizes; track s) {
						<option [value]="s" [selected]="s === curFontSize()">{{ s }}</option>
					}
				</select>
			</div>
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					title="Grow font"
					(click)="stepFontSize(1)"
				>
					A▴
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					title="Shrink font"
					(click)="stepFontSize(-1)"
				>
					A▾
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					title="Clear formatting"
					(click)="clearFormatting()"
				>
					⌫
				</button>
			</div>
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb font-bold"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.bold ? 'bg-accent' : ''"
					title="Bold"
					(click)="toggleStyle('bold')"
				>
					B
				</button>
				<button
					type="button"
					class="pptx-rb-gb italic"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.italic ? 'bg-accent' : ''"
					title="Italic"
					(click)="toggleStyle('italic')"
				>
					I
				</button>
				<button
					type="button"
					class="pptx-rb-gb underline"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.underline ? 'bg-accent' : ''"
					title="Underline"
					(click)="toggleStyle('underline')"
				>
					U
				</button>
				<button
					type="button"
					class="pptx-rb-gl line-through"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.strikethrough ? 'bg-accent' : ''"
					title="Strikethrough"
					(click)="toggleStyle('strikethrough')"
				>
					S
				</button>
			</div>
			<!-- Font colour popover -->
			<div class="group relative">
				<button
					type="button"
					class="pptx-rb-pill"
					[disabled]="!isText()"
					title="Font colour"
					(mousedown)="$event.preventDefault()"
				>
					<svg
						class="h-3.5 w-3.5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M6 20h12M9.5 4h5L18 16H6L9.5 4z" />
					</svg>
					<span class="-mt-0.5 block h-1 w-4 rounded-sm" [style.background]="curColor()"></span>
				</button>
				<div class="absolute left-0 top-full z-50 hidden pt-1 group-hover:block">
					<div class="w-36 rounded-lg border border-border bg-card p-2 shadow-2xl">
						<div class="mb-2 grid grid-cols-5 gap-1.5">
							@for (c of fontColorPresets; track c) {
								<button
									type="button"
									class="h-5 w-5 rounded-full border transition-transform hover:scale-125"
									[ngClass]="
										curColor().toLowerCase() === c
											? 'border-primary ring-1 ring-primary'
											: 'border-border'
									"
									[style.background]="c"
									[attr.aria-label]="'Font colour ' + c"
									(mousedown)="$event.preventDefault()"
									(click)="setColor(c)"
								></button>
							}
						</div>
						<label
							class="block w-full cursor-pointer py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
						>
							Custom colour...
							<input
								type="color"
								class="sr-only"
								[value]="curColor()"
								(change)="setColor($any($event.target).value)"
							/>
						</label>
					</div>
				</div>
			</div>
			<!-- Text highlight popover -->
			<div class="group relative">
				<button
					type="button"
					class="pptx-rb-pill"
					[disabled]="!isText()"
					title="Text highlight colour"
					(mousedown)="$event.preventDefault()"
				>
					<span class="font-bold">🖍</span>
					<span class="-mt-0.5 block h-1 w-4 rounded-sm" [style.background]="curHighlight()"></span>
				</button>
				<div class="absolute left-0 top-full z-50 hidden pt-1 group-hover:block">
					<div class="w-36 rounded-lg border border-border bg-card p-2 shadow-2xl">
						<div class="mb-2 grid grid-cols-5 gap-1.5">
							@for (c of highlightColorPresets; track c) {
								<button
									type="button"
									class="h-5 w-5 rounded-full border transition-transform hover:scale-125"
									[ngClass]="
										curHighlight().toLowerCase() === c
											? 'border-primary ring-1 ring-primary'
											: 'border-border'
									"
									[style.background]="c"
									[attr.aria-label]="'Highlight colour ' + c"
									(mousedown)="$event.preventDefault()"
									(click)="setHighlight(c)"
								></button>
							}
						</div>
						<label
							class="block w-full cursor-pointer py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
						>
							Custom colour...
							<input
								type="color"
								class="sr-only"
								[value]="curHighlight()"
								(change)="setHighlight($any($event.target).value)"
							/>
						</label>
					</div>
				</div>
			</div>
		</ng-template>

		<ng-template #paragraphControls>
			<!-- List style: bullets + numbering -->
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.listType === 'bullet' ? 'bg-accent' : ''"
					title="Bullet list"
					(click)="toggleList('bullet')"
				>
					•≡
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.listType === 'numbered' ? 'bg-accent' : ''"
					title="Numbered list"
					(click)="toggleList('numbered')"
				>
					1.≡
				</button>
			</div>
			<!-- Indent: outdent + indent -->
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					title="Decrease indent"
					(click)="changeIndent(-24)"
				>
					⇤
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					title="Increase indent"
					(click)="changeIndent(24)"
				>
					⇥
				</button>
			</div>
			<!-- Alignment -->
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'left' ? 'bg-accent' : ''"
					title="Align left"
					(click)="setAlign('left')"
				>
					⯇
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'center' ? 'bg-accent' : ''"
					title="Align center"
					(click)="setAlign('center')"
				>
					≡
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'right' ? 'bg-accent' : ''"
					title="Align right"
					(click)="setAlign('right')"
				>
					⯈
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'justify' ? 'bg-accent' : ''"
					title="Justify"
					(click)="setAlign('justify')"
				>
					☰
				</button>
			</div>
		</ng-template>
	`,
})
export class RibbonComponent {
	protected readonly editor = inject(EditorStateService);

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
	readonly drawToolChange = output<{ tool: DrawTool; color: string; width: number }>();
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
	protected readonly fontFamilies = FONT_FAMILIES;
	protected readonly fontSizes = FONT_SIZES;
	protected readonly fontColorPresets = FONT_COLOR_PRESETS;
	protected readonly highlightColorPresets = HIGHLIGHT_COLOR_PRESETS;
	protected readonly drawTools = DRAW_TOOLS;
	protected readonly transitionPresets = TRANSITION_PRESETS;
	protected readonly entrancePresets = ENTRANCE_PRESETS;
	protected readonly emphasisPresets = EMPHASIS_PRESETS;
	protected readonly exitPresets = EXIT_PRESETS;

	protected readonly activeTab = signal<RibbonTab>('home');

	/** Ribbon content expanded (true) vs collapsed to just the tab bar (false). */
	protected readonly ribbonExpanded = signal(true);

	// ── Insert tab state ──────────────────────────────────────────────────────
	/** Chart types offered in the Insert tab dropdown (shared source of truth). */
	protected readonly chartTypes = INSERT_CHART_TYPES;
	/** The chart type currently chosen in the Insert tab dropdown. */
	protected readonly newChartType = signal<PptxChartType>(DEFAULT_INSERT_CHART_TYPE);

	// ── Draw tab state ────────────────────────────────────────────────────────
	/** Active drawing tool (UI state only; no ink back-end yet). */
	protected readonly activeTool = signal<DrawTool>('select');
	/** Drawing pen colour (UI state only). */
	protected readonly drawingColor = signal<string>('#000000');
	/** Drawing stroke width in pixels (UI state only). */
	protected readonly drawingWidth = signal<number>(3);

	// ── Transitions tab state ─────────────────────────────────────────────────
	/** The transition type currently selected in the ribbon gallery. */
	protected readonly selectedTransition = signal<PptxTransitionType>('none');
	/** Transition duration in seconds (round-trips through the UI input). */
	protected readonly transitionDurationSec = signal<number>(0.5);

	protected readonly activeTabLabel = computed(
		() => TABS.find((t) => t.id === this.activeTab())?.label ?? '',
	);

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	protected canDistribute(): boolean {
		return this.editor.selectedIds().length >= 3;
	}

	protected isText(): boolean {
		const el = this.selectedElement();
		return el !== null && hasTextProperties(el);
	}

	/** Current text style of the selection (for active-state highlighting). */
	protected readonly curStyle = computed(() => {
		const el = this.selectedElement();
		return el && hasTextProperties(el) ? (el.textStyle ?? null) : null;
	});

	protected curFontFamily(): string {
		return this.curStyle()?.fontFamily ?? 'Segoe UI';
	}
	protected curFontSize(): number {
		return Math.round(this.curStyle()?.fontSize ?? 18);
	}

	// ── Clipboard ────────────────────────────────────────────────────────────
	protected copy(): void {
		this.editor.copySelected(this.slideIndex());
	}
	protected cut(): void {
		this.editor.cutSelected(this.slideIndex());
	}
	protected paste(): void {
		this.editor.paste(this.slideIndex());
	}

	// ── Insert ──────────────────────────────────────────────────────────────
	protected insertText(): void {
		this.editor.addElement(this.slideIndex(), newTextElement());
	}
	protected insertShape(kind: 'rect' | 'ellipse' | 'line'): void {
		this.editor.addElement(this.slideIndex(), newShapeElement(kind));
	}
	protected insertTable(): void {
		this.editor.addElement(this.slideIndex(), newTableElement());
	}
	protected insertSmartArt(): void {
		// Open the Insert SmartArt gallery dialog (host owns the dialog + insert).
		this.openSmartArtDialog.emit();
	}
	protected setNewChartType(event: Event): void {
		this.newChartType.set((event.target as HTMLSelectElement).value as PptxChartType);
	}
	protected insertChart(): void {
		this.editor.addElement(this.slideIndex(), newChartElement(this.newChartType()));
	}
	protected insertEquation(): void {
		// Open the equation editor (host owns the dialog + insert), mirroring React.
		this.openEquationDialog.emit();
	}

	/** Pick an image file and add it as an inline image element (data-URL backed). */
	protected insertImage(): void {
		this.pickFile('image/*', (file) => void this.addImageFile(file));
	}

	/** Pick an audio/video file and add it as a media element (data-URL backed). */
	protected insertMedia(): void {
		this.pickFile('video/*,audio/*', (file) => void this.addMediaFile(file));
	}

	private async addImageFile(file: File): Promise<void> {
		const dataUrl = await readAsDataUrl(file);
		if (!dataUrl) {
			return;
		}
		const dims = await imageDimensions(dataUrl);
		const maxW = 400;
		const scale = dims.width > maxW ? maxW / dims.width : 1;
		const element: PptxElement = {
			type: 'image',
			id: '',
			name: file.name || 'Image',
			x: 100,
			y: 100,
			width: Math.round(dims.width * scale),
			height: Math.round(dims.height * scale),
			imageData: dataUrl,
		} as PptxElement;
		this.editor.addElement(this.slideIndex(), element);
	}

	private async addMediaFile(file: File): Promise<void> {
		const dataUrl = await readAsDataUrl(file);
		if (!dataUrl) {
			return;
		}
		const isAudio = file.type.startsWith('audio/');
		const element: PptxElement = {
			type: 'media',
			id: '',
			name: file.name || 'Media',
			x: 100,
			y: 100,
			width: isAudio ? 280 : 480,
			height: isAudio ? 64 : 270,
			mediaType: isAudio ? 'audio' : 'video',
			mediaData: dataUrl,
			mediaMimeType: file.type,
		} as PptxElement;
		this.editor.addElement(this.slideIndex(), element);
	}

	/** Open the native file picker for a single file of the given accept type. */
	private pickFile(accept: string, onFile: (file: File) => void): void {
		if (typeof document === 'undefined') {
			return;
		}
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = accept;
		fileInput.style.display = 'none';
		fileInput.addEventListener('change', () => {
			const file = fileInput.files?.[0];
			if (file) {
				onFile(file);
			}
			fileInput.remove();
		});
		document.body.appendChild(fileInput);
		fileInput.click();
	}

	// ── Text style ────────────────────────────────────────────────────────────
	private patchText(patch: Record<string, unknown>): void {
		const el = this.selectedElement();
		if (!el || !hasTextProperties(el)) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), el.id, {
			textStyle: { ...el.textStyle, ...patch },
		} as Partial<PptxElement>);
	}
	protected toggleStyle(key: 'bold' | 'italic' | 'underline' | 'strikethrough'): void {
		this.patchText({ [key]: !this.curStyle()?.[key] });
	}
	protected setColor(color: string): void {
		this.patchText({ color });
	}
	protected setHighlight(highlightColor: string): void {
		this.patchText({ highlightColor });
	}
	/** Current font colour of the selection (for the swatch + active-state ring). */
	protected curColor(): string {
		return this.curStyle()?.color ?? '#000000';
	}
	/** Current highlight colour of the selection (for the swatch + active-state ring). */
	protected curHighlight(): string {
		return this.curStyle()?.highlightColor ?? '#ffff00';
	}
	/** Toggle the paragraph list style (bullet / numbered) off when already set. */
	protected toggleList(kind: 'bullet' | 'numbered'): void {
		this.patchText({ listType: this.curStyle()?.listType === kind ? 'none' : kind });
	}
	/** Step the paragraph left-indent by `deltaPx` (clamped at 0). */
	protected changeIndent(deltaPx: number): void {
		const current = this.curStyle()?.paragraphMarginLeft ?? 0;
		this.patchText({ paragraphMarginLeft: Math.max(0, current + deltaPx) });
	}
	protected setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
		this.patchText({ align });
	}
	protected setFontFamily(event: Event): void {
		this.patchText({ fontFamily: (event.target as HTMLSelectElement).value });
	}
	protected setFontSize(event: Event): void {
		this.patchText({ fontSize: Number((event.target as HTMLSelectElement).value) });
	}
	/** Step the selection's font size up or down through the FONT_SIZES ladder. */
	protected stepFontSize(direction: 1 | -1): void {
		const current = this.curFontSize();
		const sizes = FONT_SIZES;
		// Find the nearest ladder index to the current size, then step from it.
		let idx = sizes.findIndex((s) => s >= current);
		if (idx < 0) {
			idx = sizes.length - 1;
		}
		const next = sizes[Math.min(sizes.length - 1, Math.max(0, idx + direction))];
		if (next !== undefined) {
			this.patchText({ fontSize: next });
		}
	}
	/** Clear character formatting (bold/italic/underline/strikethrough) on the selection. */
	protected clearFormatting(): void {
		this.patchText({
			bold: false,
			italic: false,
			underline: false,
			strikethrough: false,
		});
	}

	// ── Arrange: flip ─────────────────────────────────────────────────────────
	/** Toggle horizontal/vertical flip on each selected element. */
	protected flipSelected(axis: 'horizontal' | 'vertical'): void {
		const idx = this.slideIndex();
		const slide = this.editor.slides()[idx];
		if (!slide) {
			return;
		}
		for (const id of this.editor.selectedIds()) {
			const el = slide.elements.find((e) => e.id === id);
			if (!el) {
				continue;
			}
			const patch: Partial<PptxElement> =
				axis === 'horizontal'
					? ({ flipHorizontal: !el.flipHorizontal } as Partial<PptxElement>)
					: ({ flipVertical: !el.flipVertical } as Partial<PptxElement>);
			this.editor.updateElement(idx, id, patch);
		}
	}

	// ── Draw tab ─────────────────────────────────────────────────────────────

	protected setDrawTool(tool: DrawTool): void {
		this.activeTool.set(tool);
		this.drawToolChange.emit({ tool, color: this.drawingColor(), width: this.drawingWidth() });
	}

	protected onDrawColorInput(event: Event): void {
		const color = (event.target as HTMLInputElement).value;
		this.drawingColor.set(color);
		this.drawToolChange.emit({ tool: this.activeTool(), color, width: this.drawingWidth() });
	}

	protected onDrawWidthInput(event: Event): void {
		const width = Number((event.target as HTMLInputElement).value);
		this.drawingWidth.set(width);
		this.drawToolChange.emit({ tool: this.activeTool(), color: this.drawingColor(), width });
	}

	// ── Transitions tab ──────────────────────────────────────────────────────

	/** Apply the chosen transition to the active slide. */
	protected setTransition(type: PptxTransitionType): void {
		this.selectedTransition.set(type);
		const durationMs = Math.round(this.transitionDurationSec() * 1000);
		this.editor.updateSlide(this.slideIndex(), {
			transition: { type, durationMs, advanceOnClick: true },
		} as Partial<PptxSlide>);
	}

	protected onTransitionDurationChange(event: Event): void {
		const sec = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(sec) && sec >= 0) {
			this.transitionDurationSec.set(sec);
			// Re-apply to active slide with the new duration.
			const durationMs = Math.round(sec * 1000);
			this.editor.updateSlide(this.slideIndex(), {
				transition: {
					type: this.selectedTransition(),
					durationMs,
					advanceOnClick: true,
				},
			} as Partial<PptxSlide>);
		}
	}

	/** Apply the current transition to every slide in the deck. */
	protected applyTransitionToAll(): void {
		const type = this.selectedTransition();
		const durationMs = Math.round(this.transitionDurationSec() * 1000);
		const count = this.editor.slides().length;
		for (let i = 0; i < count; i++) {
			this.editor.updateSlide(i, {
				transition: { type, durationMs, advanceOnClick: true },
			} as Partial<PptxSlide>);
		}
	}

	// ── Animations tab ───────────────────────────────────────────────────────

	/**
	 * Add an animation preset to the selected element on the active slide.
	 * Delegates to the immutable helpers in animation-author-helpers.ts and
	 * commits the updated animations array via EditorStateService.updateSlide.
	 */
	protected addAnimation(
		preset: PptxAnimationPreset,
		group: 'entrance' | 'emphasis' | 'exit',
	): void {
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const current = slide.animations ?? [];
		let updated: ReturnType<typeof setAnimationEntrance>;
		if (group === 'entrance') {
			updated = setAnimationEntrance(current, el.id, preset);
		} else if (group === 'emphasis') {
			updated = setAnimationEmphasis(current, el.id, preset);
		} else {
			updated = setAnimationExit(current, el.id, preset);
		}
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/** Remove all animations from the selected element. */
	protected removeAnim(): void {
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const updated = removeAnimation(slide.animations ?? [], el.id);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}
}
