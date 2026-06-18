/**
 * ribbon.component.ts — Office-style tabbed ribbon for the Angular editor chrome.
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
	PptxElement,
	PptxSlide,
	PptxTransitionType,
} from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	EMPHASIS_PRESETS,
	ENTRANCE_PRESETS,
	EXIT_PRESETS,
	removeAnimation,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
} from './animation-author-helpers';
import {
	newEquationElement,
	newShapeElement,
	newSmartArtElement,
	newTableElement,
	newTextElement,
} from './editor-insert';
import { EditorStateService } from './editor-state.service';

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
const TEXT_COLORS = [
	'#000000',
	'#ffffff',
	'#ef4444',
	'#f59e0b',
	'#eab308',
	'#22c55e',
	'#3b82f6',
	'#6366f1',
	'#a855f7',
	'#ec4899',
];

@Component({
	selector: 'pptx-ribbon',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgClass, NgTemplateOutlet],
	template: `
		<div
			role="toolbar"
			aria-label="Presentation toolbar"
			class="relative z-20 overflow-visible border-b border-border bg-secondary/50"
		>
			<!-- ── Primary quick-access row ─────────────────────────────────── -->
			<div class="flex items-center gap-1 px-2 py-1">
				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Previous slide"
					[disabled]="slideIndex() <= 0"
					(click)="prev.emit()"
				>
					‹
				</button>
				<span class="px-1 text-[11px] text-muted-foreground tabular-nums"
					>{{ slideCount() === 0 ? 0 : slideIndex() + 1 }} / {{ slideCount() }}</span
				>
				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Next slide"
					[disabled]="slideIndex() >= slideCount() - 1"
					(click)="next.emit()"
				>
					›
				</button>

				<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Undo"
					[disabled]="!editor.canUndo()"
					(click)="editor.undo()"
				>
					↶
				</button>
				<button
					type="button"
					class="pptx-rb-icon"
					aria-label="Redo"
					[disabled]="!editor.canRedo()"
					(click)="editor.redo()"
				>
					↷
				</button>

				<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

				<button type="button" class="pptx-rb-icon" aria-label="Zoom out" (click)="zoomOut.emit()">
					−
				</button>
				<button
					type="button"
					class="pptx-rb-pill min-w-12 justify-center tabular-nums"
					(click)="zoomReset.emit()"
				>
					{{ zoomPercent() }}%
				</button>
				<button type="button" class="pptx-rb-icon" aria-label="Zoom in" (click)="zoomIn.emit()">
					+
				</button>

				<span class="mx-1 h-5 w-px self-center bg-border/50"></span>

				<button
					type="button"
					class="pptx-rb-pill"
					(click)="find.emit()"
					aria-label="Find in slides"
				>
					Find
				</button>

				<div class="flex-1"></div>

				<button
					type="button"
					class="pptx-rb-pill"
					[disabled]="slideCount() === 0"
					(click)="present.emit()"
				>
					Present
				</button>
				<button
					type="button"
					class="pptx-rb-pill"
					[disabled]="slideCount() === 0"
					(click)="presenter.emit()"
					aria-label="Presenter view"
				>
					Presenter
				</button>
				<button
					type="button"
					class="pptx-rb-pill"
					(click)="share.emit()"
					aria-label="Share for collaboration"
				>
					Share
				</button>
				<button
					type="button"
					class="pptx-rb-pill"
					(click)="info.emit()"
					aria-label="Document properties"
				>
					Info
				</button>
			</div>

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
			</div>

			<!-- ── Ribbon content ────────────────────────────────────────────── -->
			<div class="flex flex-nowrap items-stretch gap-1.5 overflow-x-auto px-2 py-1.5">
				@switch (activeTab()) {
					@case ('file') {
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
						<button type="button" class="pptx-rb-pill" (click)="replace.emit()">Replace</button>
					}
					@case ('home') {
						<!-- Clipboard -->
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
						<span class="pptx-rb-sep"></span>
						<!-- Slides -->
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
						<span class="pptx-rb-sep"></span>
						<!-- Font -->
						<ng-container [ngTemplateOutlet]="fontControls" />
						<span class="pptx-rb-sep"></span>
						<ng-container [ngTemplateOutlet]="paragraphControls" />
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
							<button type="button" class="pptx-rb-gl" (click)="insertShape('line')" title="Line">
								／ Line
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
							<button
								type="button"
								class="pptx-rb-gl"
								(click)="insertEquation()"
								title="Insert equation (E = mc²)"
							>
								∑ Equation
							</button>
						</div>
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
					}
					@case ('review') {
						<button type="button" class="pptx-rb-pill" (click)="comments.emit()">Comments</button>
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">Accessibility</button>
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
							<!-- Dropdown panel — shown on group hover -->
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
			<div class="flex items-center gap-0.5">
				@for (c of textColors; track c) {
					<button
						type="button"
						class="h-4 w-4 rounded-sm border border-border/60"
						[disabled]="!isText()"
						[style.background]="c"
						[attr.aria-label]="'Text colour ' + c"
						(click)="setColor(c)"
					></button>
				}
			</div>
		</ng-template>

		<ng-template #paragraphControls>
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
	/** Current visibility state of the theme gallery overlay (for active-state styling). */
	readonly themeGalleryOpen = input<boolean>(false);

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
	 * Currently UI-only — no freehand-draw back-end exists in the Angular port.
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

	protected readonly tabs = TABS;
	protected readonly fontFamilies = FONT_FAMILIES;
	protected readonly fontSizes = FONT_SIZES;
	protected readonly textColors = TEXT_COLORS;
	protected readonly drawTools = DRAW_TOOLS;
	protected readonly transitionPresets = TRANSITION_PRESETS;
	protected readonly entrancePresets = ENTRANCE_PRESETS;
	protected readonly emphasisPresets = EMPHASIS_PRESETS;
	protected readonly exitPresets = EXIT_PRESETS;

	protected readonly activeTab = signal<RibbonTab>('home');

	// ── Draw tab state ────────────────────────────────────────────────────────
	/** Active drawing tool (UI state only — no ink back-end yet). */
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
		this.editor.addElement(this.slideIndex(), newSmartArtElement());
	}
	protected insertEquation(): void {
		this.editor.addElement(this.slideIndex(), newEquationElement());
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
	protected setAlign(align: 'left' | 'center' | 'right' | 'justify'): void {
		this.patchText({ align });
	}
	protected setFontFamily(event: Event): void {
		this.patchText({ fontFamily: (event.target as HTMLSelectElement).value });
	}
	protected setFontSize(event: Event): void {
		this.patchText({ fontSize: Number((event.target as HTMLSelectElement).value) });
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
