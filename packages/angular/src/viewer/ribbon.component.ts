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
import { TranslatePipe } from '@ngx-translate/core';
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

/** Drawing tool IDs (mirrors React DRAW_TOOLS). */
type DrawTool = 'select' | 'pen' | 'highlighter' | 'eraser' | 'freeform';

interface DrawToolDef {
	id: DrawTool;
	labelKey: string;
	icon: string;
}

const DRAW_TOOLS: readonly DrawToolDef[] = [
	{ id: 'select', labelKey: 'pptx.ribbon.tool.select', icon: '↖' },
	{ id: 'pen', labelKey: 'pptx.ribbon.tool.pen', icon: '✏' },
	{ id: 'highlighter', labelKey: 'pptx.ribbon.tool.highlighter', icon: 'Hl' },
	{ id: 'eraser', labelKey: 'pptx.ribbon.tool.eraser', icon: '⌫' },
	{ id: 'freeform', labelKey: 'pptx.ribbon.tool.freeform', icon: '∿' },
];

/**
 * Transition presets shown in the Transitions ribbon tab (mirrors React
 * `TRANSITION_PRESETS` in `DesignTransitionsReviewSection.tsx`).
 */
const TRANSITION_PRESETS: ReadonlyArray<{ value: PptxTransitionType; labelKey: string }> = [
	{ value: 'none', labelKey: 'pptx.ribbon.transition.none' },
	{ value: 'fade', labelKey: 'pptx.ribbon.transition.fade' },
	{ value: 'push', labelKey: 'pptx.ribbon.transition.push' },
	{ value: 'wipe', labelKey: 'pptx.ribbon.transition.wipe' },
	{ value: 'split', labelKey: 'pptx.ribbon.transition.split' },
	{ value: 'reveal', labelKey: 'pptx.ribbon.transition.reveal' },
	{ value: 'cut', labelKey: 'pptx.ribbon.transition.cut' },
	{ value: 'cover', labelKey: 'pptx.ribbon.transition.cover' },
	{ value: 'uncover', labelKey: 'pptx.ribbon.transition.uncover' },
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
	imports: [
		NgClass,
		NgTemplateOutlet,
		RibbonPrimaryRowComponent,
		RibbonInsertFieldsComponent,
		TranslatePipe,
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
						<button
							type="button"
							class="pptx-rb-pill"
							(click)="openFile.emit()"
							[title]="'pptx.ribbon.openAnotherPresentation' | translate"
						>
							{{ 'pptx.ribbon.open' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="save.emit()"
							[title]="'pptx.ribbon.saveAsPptx' | translate"
						>
							{{ 'pptx.toolbar.save' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportPng.emit()"
								[title]="'pptx.ribbon.exportCurrentSlidePng' | translate"
							>
								PNG
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportPdf.emit()"
								[title]="'pptx.ribbon.exportDeckPdf' | translate"
							>
								{{ exporting() ? ('pptx.ribbon.exporting' | translate) : 'PDF' }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportGif.emit()"
								[title]="'pptx.ribbon.exportGifTitle' | translate"
							>
								GIF
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="exporting() || slideCount() === 0"
								(click)="exportVideo.emit()"
								[title]="'pptx.ribbon.exportWebmVideo' | translate"
							>
								Video
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<button type="button" class="pptx-rb-pill" (click)="print.emit()">
							{{ 'pptx.print.printButton' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="info.emit()">
							{{ 'pptx.ribbon.properties' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="signatures.emit()">
							{{ 'pptx.ribbon.signatures' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="replace.emit()">
							{{ 'pptx.ribbon.replace' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.protectWithPassword' | translate"
							(click)="openPassword.emit()"
						>
							{{ 'pptx.ribbon.protect' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.manageEmbeddedFonts' | translate"
							(click)="openFontEmbedding.emit()"
						>
							{{ 'pptx.ribbon.embedFonts' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.browseSavedVersions' | translate"
							(click)="openVersionHistory.emit()"
						>
							{{ 'pptx.ribbon.versionHistory' | translate }}
						</button>
					}
					@case ('home') {
						<!-- Clipboard -->
						<div class="flex flex-col items-center gap-0.5">
							<div class="pptx-rb-grp">
								<button
									type="button"
									class="pptx-rb-gb"
									[title]="'pptx.arrange.paste' | translate"
									(click)="paste()"
								>
									{{ 'pptx.arrange.paste' | translate }}
								</button>
								<button
									type="button"
									class="pptx-rb-gb"
									[title]="'pptx.arrange.cut' | translate"
									[disabled]="!hasSel()"
									(click)="cut()"
								>
									{{ 'pptx.arrange.cut' | translate }}
								</button>
								<button
									type="button"
									class="pptx-rb-gb"
									[title]="'pptx.arrange.copy' | translate"
									[disabled]="!hasSel()"
									(click)="copy()"
								>
									{{ 'pptx.arrange.copy' | translate }}
								</button>
								<button
									type="button"
									class="pptx-rb-gl"
									data-testid="format-painter-toggle"
									[attr.data-active]="formatPainterActive() ? 'true' : 'false'"
									[ngClass]="formatPainterActive() ? 'bg-primary text-primary-foreground' : ''"
									[disabled]="!canActivateFormatPainter() && !formatPainterActive()"
									[title]="'pptx.arrange.formatPainter' | translate"
									(click)="toggleFormatPainter.emit()"
								>
									{{ 'pptx.ribbon.painter' | translate }}
								</button>
							</div>
							<span class="text-[9px] leading-none text-muted-foreground">
								{{ 'pptx.ribbon.clipboard' | translate }}
							</span>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Slides -->
						<div class="flex flex-col items-center gap-0.5">
							<div class="pptx-rb-grp">
								<button
									type="button"
									class="pptx-rb-gb"
									[title]="'pptx.ribbon.newSlide' | translate"
									(click)="editor.addSlide(slideIndex())"
								>
									＋ {{ 'pptx.ribbon.slide' | translate }}
								</button>
								<button
									type="button"
									class="pptx-rb-gl"
									[title]="'pptx.ribbon.duplicateSlide' | translate"
									(click)="editor.duplicateSlide(slideIndex())"
								>
									{{ 'pptx.arrange.duplicate' | translate }}
								</button>
							</div>
							<span class="text-[9px] leading-none text-muted-foreground">
								{{ 'pptx.sections.slides' | translate }}
							</span>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Font -->
						<div class="flex flex-col items-center gap-0.5">
							<div class="flex items-center gap-1">
								<ng-container [ngTemplateOutlet]="fontControls" />
							</div>
							<span class="text-[9px] leading-none text-muted-foreground">
								{{ 'pptx.ribbon.font' | translate }}
							</span>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Paragraph -->
						<div class="flex flex-col items-center gap-0.5">
							<ng-container [ngTemplateOutlet]="paragraphControls" />
							<span class="text-[9px] leading-none text-muted-foreground">
								{{ 'pptx.ribbon.paragraph' | translate }}
							</span>
						</div>
					}
					@case ('insert') {
						<!-- Shapes group -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertText()"
								[title]="'pptx.ribbon.textBox' | translate"
							>
								{{ 'pptx.ribbon.textBox' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('rect')"
								[title]="'pptx.ribbon.rectangle' | translate"
							>
								▭ {{ 'pptx.ribbon.rect' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('ellipse')"
								[title]="'pptx.ribbon.ellipse' | translate"
							>
								◯ {{ 'pptx.ribbon.ellipse' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertShape('line')"
								[title]="'pptx.ribbon.line' | translate"
							>
								／ {{ 'pptx.ribbon.line' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertImage()"
								[title]="'pptx.ribbon.insertImage' | translate"
							>
								🖼 {{ 'pptx.ribbon.image' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								(click)="insertMedia()"
								[title]="'pptx.ribbon.insertMedia' | translate"
							>
								🎬 {{ 'pptx.ribbon.media' | translate }}
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Data / diagram group -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertTable()"
								[title]="'pptx.ribbon.insertTable' | translate"
							>
								⊞ {{ 'pptx.ribbon.table' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertSmartArt()"
								[title]="'pptx.ribbon.insertSmartArt' | translate"
							>
								◈ {{ 'pptx.ribbon.smartArt' | translate }}
							</button>
							<select
								class="pptx-rb-gl"
								[title]="'pptx.ribbon.chartType' | translate"
								[value]="newChartType()"
								(change)="setNewChartType($event)"
							>
								@for (ct of chartTypes; track ct.type) {
									<option [value]="ct.type">{{ ct.label }}</option>
								}
							</select>
							<button
								type="button"
								class="pptx-rb-gb"
								(click)="insertChart()"
								[title]="'pptx.ribbon.insertChart' | translate"
							>
								▥ {{ 'pptx.ribbon.chart' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								(click)="insertEquation()"
								[title]="'pptx.ribbon.insertEquation' | translate"
							>
								∑ {{ 'pptx.ribbon.equation' | translate }}
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
								[title]="'pptx.arrange.bringToFront' | translate"
								(click)="editor.bringSelectedToFront(slideIndex())"
							>
								{{ 'pptx.arrange.front' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.sendToBack' | translate"
								(click)="editor.sendSelectedToBack(slideIndex())"
							>
								{{ 'pptx.arrange.back' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.bringForward' | translate"
								(click)="editor.bringSelectedForward(slideIndex())"
							>
								{{ 'pptx.ribbon.fwd' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.sendBackward' | translate"
								(click)="editor.sendSelectedBackward(slideIndex())"
							>
								{{ 'pptx.ribbon.bwd' | translate }}
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Align -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.alignLeft' | translate"
								(click)="editor.alignSelected(slideIndex(), 'left')"
							>
								⇤
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.alignCenter' | translate"
								(click)="editor.alignSelected(slideIndex(), 'centerH')"
							>
								⇔
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.alignRight' | translate"
								(click)="editor.alignSelected(slideIndex(), 'right')"
							>
								⇥
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.alignTop' | translate"
								(click)="editor.alignSelected(slideIndex(), 'top')"
							>
								⤒
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.alignMiddle' | translate"
								(click)="editor.alignSelected(slideIndex(), 'middle')"
							>
								⇕
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.alignBottom' | translate"
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
								[title]="'pptx.ribbon.distributeHorizontally' | translate"
								(click)="editor.distributeSelected(slideIndex(), 'horizontal')"
							>
								&#x2194; H
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!canDistribute()"
								[title]="'pptx.ribbon.distributeVertically' | translate"
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
								[title]="'pptx.arrange.copy' | translate"
								(click)="copy()"
							>
								{{ 'pptx.arrange.copy' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.cut' | translate"
								(click)="cut()"
							>
								{{ 'pptx.arrange.cut' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[title]="'pptx.arrange.paste' | translate"
								(click)="paste()"
							>
								{{ 'pptx.arrange.paste' | translate }}
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
								[title]="'pptx.arrange.formatPainter' | translate"
								(click)="toggleFormatPainter.emit()"
							>
								{{ 'pptx.ribbon.painter' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.flipHorizontally' | translate"
								(click)="flipSelected('horizontal')"
							>
								{{ 'pptx.arrange.flipH' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.flipVertically' | translate"
								(click)="flipSelected('vertical')"
							>
								{{ 'pptx.arrange.flipV' | translate }}
							</button>
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Group / edit -->
						<div class="pptx-rb-grp">
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.group' | translate"
								(click)="editor.groupSelected(slideIndex())"
							>
								{{ 'pptx.ribbon.group' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.ribbon.ungroup' | translate"
								(click)="editor.ungroupSelected(slideIndex())"
							>
								{{ 'pptx.ribbon.ungroup' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gb"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.duplicate' | translate"
								(click)="editor.duplicateSelected(slideIndex())"
							>
								{{ 'pptx.arrange.duplicate' | translate }}
							</button>
							<button
								type="button"
								class="pptx-rb-gl"
								[disabled]="!hasSel()"
								[title]="'pptx.arrange.delete' | translate"
								(click)="editor.deleteSelected(slideIndex())"
							>
								{{ 'pptx.arrange.delete' | translate }}
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
							{{ 'pptx.ribbon.fromBeginning' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="slideCount() === 0"
							(click)="presenter.emit()"
						>
							{{ 'pptx.ribbon.presenterView' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="broadcast.emit()">
							{{ 'pptx.ribbon.broadcast' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="openCustomShows.emit()">
							{{ 'pptx.ribbon.customShowsButton' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.setUpShowTitle' | translate"
							(click)="openSetUpSlideShow.emit()"
						>
							{{ 'pptx.ribbon.setUpShow' | translate }}
						</button>
					}
					@case ('review') {
						<button type="button" class="pptx-rb-pill" (click)="comments.emit()">
							{{ 'pptx.toolbar.comments' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">
							{{ 'pptx.ribbon.accessibility' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.compareTitle' | translate"
							(click)="openCompare.emit()"
						>
							{{ 'pptx.ribbon.compare' | translate }}
						</button>
						@if (hasSel()) {
							<button type="button" class="pptx-rb-pill" (click)="link.emit()">
								{{ 'pptx.ribbon.link' | translate }}
							</button>
						}
					}
					@case ('view') {
						<!-- Presentation views -->
						<button type="button" class="pptx-rb-pill" (click)="openSorter.emit()">
							{{ 'pptx.slideSorter.title' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="toggleNotes.emit()">
							{{ 'pptx.notes.title' | translate }}
						</button>
						<button type="button" class="pptx-rb-pill" (click)="print.emit()">
							{{ 'pptx.print.printButton' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.shortcutsTitle' | translate"
							(click)="openShortcuts.emit()"
						>
							{{ 'pptx.ribbon.shortcuts' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Show / Hide overlays -->
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="showGrid() ? 'bg-primary text-primary-foreground' : ''"
							[title]="'pptx.ribbon.toggleGridOverlay' | translate"
							(click)="toggleGrid.emit()"
						>
							{{ 'pptx.grid.grid' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="showRulers() ? 'bg-primary text-primary-foreground' : ''"
							[title]="'pptx.ruler.toggleRulers' | translate"
							(click)="toggleRulers.emit()"
						>
							{{ 'pptx.ruler.rulers' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="showGuides() ? 'bg-primary text-primary-foreground' : ''"
							[title]="'pptx.ribbon.toggleGuides' | translate"
							(click)="toggleGuides.emit()"
						>
							{{ 'pptx.ribbon.guides' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.toggleSelectionPane' | translate"
							(click)="toggleSelectionPane.emit()"
						>
							{{ 'pptx.selectionPane.title' | translate }}
						</button>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="snapToGrid() ? 'bg-primary text-primary-foreground' : ''"
							[title]="'pptx.ribbon.snapToGridTitle' | translate"
							(click)="toggleSnapToGrid.emit()"
						>
							{{ 'pptx.grid.snapToGrid' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="!canEdit()"
							[ngClass]="editor.editTemplateMode() ? 'pptx-rb-template-active' : ''"
							[title]="'pptx.ribbon.editTemplateTitle' | translate"
							(click)="editor.setEditTemplateMode(!editor.editTemplateMode())"
						>
							{{
								(editor.editTemplateMode() ? 'pptx.ribbon.templatesOn' : 'pptx.ribbon.templatesOff')
									| translate
							}}
						</button>
						<span class="pptx-rb-sep"></span>
						<button
							type="button"
							class="pptx-rb-pill"
							[ngClass]="eyedropperActive() ? 'pptx-rb-eyedropper-active' : ''"
							[title]="'pptx.ribbon.eyedropperTitle' | translate"
							(click)="toggleEyedropper.emit()"
						>
							{{ 'pptx.ribbon.eyedropper' | translate }}
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
									[title]="tool.labelKey | translate"
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
							[title]="'pptx.ribbon.penColour' | translate"
						>
							{{ 'pptx.ribbon.colour' | translate }}
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
							[title]="'pptx.ribbon.strokeWidth' | translate"
						>
							{{ 'pptx.ribbon.width' | translate }}
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
					}
					@case ('transitions') {
						<!-- Preview (fires existing presentation present path; no separate preview API yet) -->
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.previewTransition' | translate"
							(click)="present.emit()"
						>
							▶ {{ 'pptx.ribbon.preview' | translate }}
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
									[title]="
										'pptx.ribbon.transitionTitle' | translate: { name: t.labelKey | translate }
									"
								>
									{{ t.labelKey | translate }}
								</button>
							}
						</div>
						<span class="pptx-rb-sep"></span>
						<!-- Duration -->
						<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
							<span class="whitespace-nowrap">{{ 'pptx.ribbon.duration' | translate }}</span>
							<input
								type="number"
								min="0"
								max="10"
								step="0.1"
								[value]="transitionDurationSec()"
								(change)="onTransitionDurationChange($event)"
								class="pptx-rb-select w-16 text-center"
								[title]="'pptx.ribbon.transitionDurationTitle' | translate"
							/>
							<span>s</span>
						</label>
						<span class="pptx-rb-sep"></span>
						<!-- Apply to all -->
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.applyTransitionToAll' | translate"
							(click)="applyTransitionToAll()"
						>
							⧉ {{ 'pptx.headerFooter.applyToAll' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Inspector -->
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.ribbon.openInspectorTransitions' | translate"
							(click)="toggleInspector.emit()"
						>
							▤ {{ 'pptx.ribbon.inspector' | translate }}
						</button>
					}
					@case ('animations') {
						<!-- Preview: plays presentation from this slide; no element-only preview API yet -->
						<button
							type="button"
							class="pptx-rb-pill"
							[disabled]="!hasSel()"
							[title]="'pptx.animations.previewTooltip' | translate"
							(click)="present.emit()"
						>
							▶ {{ 'pptx.animations.preview' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Add Animation dropdown (hover-reveal, mirrors React pattern) -->
						<div class="group relative">
							<button
								type="button"
								class="pptx-rb-pill"
								[disabled]="!hasSel()"
								[title]="'pptx.animations.addTooltip' | translate"
							>
								✨ {{ 'pptx.animations.addAnimation' | translate }} ▾
							</button>
							<!-- Dropdown panel: shown on group hover -->
							<div class="absolute left-0 top-full z-50 hidden w-44 pt-1 group-hover:block">
								<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
									<!-- Entrance group -->
									<div
										class="px-3 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
									>
										{{ 'pptx.animations.group.entrance' | translate }}
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
										{{ 'pptx.animations.group.emphasis' | translate }}
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
										{{ 'pptx.animations.group.exit' | translate }}
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
							[title]="'pptx.animations.removeTooltip' | translate"
							(click)="removeAnim()"
						>
							✕ {{ 'pptx.ribbon.removeAnimation' | translate }}
						</button>
						<span class="pptx-rb-sep"></span>
						<!-- Animation Panel -->
						<button
							type="button"
							class="pptx-rb-pill"
							[title]="'pptx.animations.openPanelTooltip' | translate"
							(click)="toggleInspector.emit()"
						>
							▤ {{ 'pptx.animations.animationPanel' | translate }}
						</button>
					}
					@case ('help') {
						<button type="button" class="pptx-rb-pill" (click)="a11y.emit()">
							{{ 'pptx.ribbon.accessibility' | translate }}
						</button>
					}
				}
			</div>
		</div>

		<!-- ── Reusable control groups ───────────────────────────────────────── -->
		<ng-template #fontControls>
			<div class="flex items-center gap-1">
				<select
					class="pptx-rb-select w-28"
					[attr.aria-label]="'pptx.ribbon.fontFamily' | translate"
					[disabled]="!isText()"
					(change)="setFontFamily($event)"
				>
					@for (f of fontFamilies; track f) {
						<option [value]="f" [selected]="f === curFontFamily()">{{ f }}</option>
					}
				</select>
				<select
					class="pptx-rb-select w-14"
					[attr.aria-label]="'pptx.ribbon.fontSize' | translate"
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
					[title]="'pptx.ribbon.growFont' | translate"
					(click)="stepFontSize(1)"
				>
					A▴
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[title]="'pptx.ribbon.shrinkFont' | translate"
					(click)="stepFontSize(-1)"
				>
					A▾
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[title]="'pptx.ribbon.clearFormatting' | translate"
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
					[title]="'pptx.notes.bold' | translate"
					(click)="toggleStyle('bold')"
				>
					B
				</button>
				<button
					type="button"
					class="pptx-rb-gb italic"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.italic ? 'bg-accent' : ''"
					[title]="'pptx.notes.italic' | translate"
					(click)="toggleStyle('italic')"
				>
					I
				</button>
				<button
					type="button"
					class="pptx-rb-gb underline"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.underline ? 'bg-accent' : ''"
					[title]="'pptx.notes.underline' | translate"
					(click)="toggleStyle('underline')"
				>
					U
				</button>
				<button
					type="button"
					class="pptx-rb-gl line-through"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.strikethrough ? 'bg-accent' : ''"
					[title]="'pptx.notes.strikethrough' | translate"
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
					[title]="'pptx.ribbon.fontColour' | translate"
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
									[attr.aria-label]="'pptx.ribbon.fontColourValue' | translate: { color: c }"
									(mousedown)="$event.preventDefault()"
									(click)="setColor(c)"
								></button>
							}
						</div>
						<label
							class="block w-full cursor-pointer py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
						>
							{{ 'pptx.ribbon.customColour' | translate }}
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
					[title]="'pptx.ribbon.textHighlightColour' | translate"
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
									[attr.aria-label]="'pptx.ribbon.highlightColourValue' | translate: { color: c }"
									(mousedown)="$event.preventDefault()"
									(click)="setHighlight(c)"
								></button>
							}
						</div>
						<label
							class="block w-full cursor-pointer py-1 text-center text-[10px] text-muted-foreground transition-colors hover:text-foreground"
						>
							{{ 'pptx.ribbon.customColour' | translate }}
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
					[title]="'pptx.ribbon.bulletList' | translate"
					(click)="toggleList('bullet')"
				>
					•≡
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.listType === 'numbered' ? 'bg-accent' : ''"
					[title]="'pptx.notes.numberedList' | translate"
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
					[title]="'pptx.notes.outdent' | translate"
					(click)="changeIndent(-24)"
				>
					⇤
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[title]="'pptx.notes.indent' | translate"
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
					[title]="'pptx.ribbon.alignLeft' | translate"
					(click)="setAlign('left')"
				>
					⯇
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'center' ? 'bg-accent' : ''"
					[title]="'pptx.ribbon.alignCenter' | translate"
					(click)="setAlign('center')"
				>
					≡
				</button>
				<button
					type="button"
					class="pptx-rb-gb"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'right' ? 'bg-accent' : ''"
					[title]="'pptx.ribbon.alignRight' | translate"
					(click)="setAlign('right')"
				>
					⯈
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[disabled]="!isText()"
					[ngClass]="curStyle()?.align === 'justify' ? 'bg-accent' : ''"
					[title]="'pptx.ribbon.justify' | translate"
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
		() => TABS.find((t) => t.id === this.activeTab())?.labelKey ?? '',
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
