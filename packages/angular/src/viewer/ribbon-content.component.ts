/**
 * ribbon-content.component.ts: the ribbon's File/Home/Insert/Text/Arrange tab
 * content, split out of {@link RibbonComponent} (which was well over this
 * repo's 300-LOC file cap). The remaining tabs (Slide Show/Review/View/Draw/
 * Design/Transitions/Animations/Help/Record) live in the sibling
 * {@link RibbonContentSecondaryComponent} for the same reason: one file
 * covering all fourteen tabs' outputs was itself over the cap.
 *
 * A `@switch` on `activeTab` that dispatches to one standalone section
 * component per tab, exactly as it did inline in `ribbon.component.ts`. Also
 * owns the Insert tab's chart-type selection, the one piece of tab-local
 * state used by a tab in this group: since this component stays mounted for
 * as long as the ribbon is (it isn't behind an `@if`), that state persists
 * across `activeTab` changes the same way it did on `RibbonComponent`.
 *
 * Every output here is re-emitted 1:1 by {@link RibbonComponent}, which keeps
 * the public `<pptx-ribbon>` API (and `PowerPointViewerComponent`'s bindings
 * to it) unchanged.
 */
import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import type { PptxElement } from 'pptx-viewer-core';

import { DEFAULT_INSERT_CHART_KIND } from '../internal/shared';
import type {
	AccountAuthConfig,
	InsertChartKind,
	ShapePresetType,
	ToolbarActionId,
} from '../internal/shared';
import { RibbonArrangeSectionComponent } from './ribbon-arrange-section.component';
import { RibbonDrawingGroupComponent } from './ribbon-drawing-group.component';
import { RibbonFileSectionComponent } from './ribbon-file-section.component';
import { RibbonFontControlsComponent } from './ribbon-font-controls.component';
import { RibbonHomeSectionComponent } from './ribbon-home-section.component';
import { RibbonInsertSectionComponent } from './ribbon-insert-section.component';
import { RibbonParagraphControlsComponent } from './ribbon-paragraph-controls.component';
import type { RibbonTab } from './ribbon-types';

@Component({
	selector: 'pptx-ribbon-content',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		RibbonFileSectionComponent,
		RibbonHomeSectionComponent,
		RibbonInsertSectionComponent,
		RibbonFontControlsComponent,
		RibbonParagraphControlsComponent,
		RibbonArrangeSectionComponent,
		RibbonDrawingGroupComponent,
	],
	template: `
		@switch (activeTab()) {
			@case ('file') {
				<pptx-ribbon-file-section
					(close)="selectTab.emit('home')"
					(createPresentation)="createPresentation.emit($event)"
					[slideCount]="slideCount()"
					[exporting]="exporting()"
					[hasMacros]="hasMacros()"
					[hiddenActions]="hiddenActions()"
					(openFile)="openFile.emit()"
					(openRecentFile)="openRecentFile.emit($event)"
					(save)="save.emit()"
					(savePpsx)="savePpsx.emit()"
					(savePptm)="savePptm.emit()"
					(exportPng)="exportPng.emit()"
					(exportPdf)="exportPdf.emit()"
					(exportGif)="exportGif.emit()"
					(exportVideo)="exportVideo.emit()"
					(exportJson)="exportJson.emit()"
					(copySlideAsImage)="copySlideAsImage.emit()"
					(print)="print.emit()"
					(info)="info.emit()"
					(signatures)="signatures.emit()"
					(replace)="replace.emit()"
					(openPassword)="openPassword.emit()"
					(openFontEmbedding)="openFontEmbedding.emit()"
					(openVersionHistory)="openVersionHistory.emit()"
					(share)="share.emit()"
					(options)="openSettings.emit()"
					[accountAuth]="accountAuth()"
				/>
			}
			@case ('home') {
				<pptx-ribbon-home-section
					[slideIndex]="slideIndex()"
					[selectedElement]="selectedElement()"
					[canEdit]="canEdit()"
					[formatPainterActive]="formatPainterActive()"
					[canActivateFormatPainter]="canActivateFormatPainter()"
					(toggleFormatPainter)="toggleFormatPainter.emit()"
					(findReplace)="find.emit()"
					(openTemplateGallery)="openTemplateGallery.emit()"
				/>
				<span class="pptx-rb-sep"></span>
				<pptx-ribbon-drawing-group
					[canEdit]="canEdit()"
					[slideIndex]="slideIndex()"
					[selectedElement]="selectedElement()"
				/>
				<span class="pptx-rb-sep"></span>
				<!--
					React parity (Toolbar.tsx: sArr = sHome || toolbarSection === 'arrange'):
					the Home tab also ends with the Arrange group. The dedicated Arrange
					tab below stays unchanged.
				-->
				<pptx-ribbon-arrange-section
					[slideIndex]="slideIndex()"
					[selectedElement]="selectedElement()"
					[canEdit]="canEdit()"
					[formatPainterActive]="formatPainterActive()"
					[canActivateFormatPainter]="canActivateFormatPainter()"
					(toggleFormatPainter)="toggleFormatPainter.emit()"
				/>
			}
			@case ('insert') {
				<pptx-ribbon-insert-section
					[slideIndex]="slideIndex()"
					[newChartType]="newChartType()"
					[newShapeType]="newShapeType()"
					(chartTypeChange)="newChartType.set($event)"
					(shapeTypeChange)="newShapeType.set($event)"
					(openSmartArtDialog)="openSmartArtDialog.emit()"
					(openEquationDialog)="openEquationDialog.emit()"
					(openHyperlink)="link.emit()"
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
					[selectedElement]="selectedElement()"
					[canEdit]="canEdit()"
					[formatPainterActive]="formatPainterActive()"
					[canActivateFormatPainter]="canActivateFormatPainter()"
					(toggleFormatPainter)="toggleFormatPainter.emit()"
				/>
			}
		}
	`,
})
export class RibbonContentComponent {
	readonly activeTab = input.required<RibbonTab>();
	readonly slideIndex = input<number>(0);
	readonly slideCount = input<number>(0);
	readonly canEdit = input<boolean>(false);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly formatPainterActive = input<boolean>(false);
	readonly canActivateFormatPainter = input<boolean>(false);
	readonly exporting = input<boolean>(false);
	readonly hasMacros = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (threaded to the File section). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	/** Optional sign-in hook point for File > Account. Absent/disabled by default. */
	readonly accountAuth = input<AccountAuthConfig | undefined>(undefined);

	/** Emitted when the File tab wants to close back to the Home tab. */
	readonly selectTab = output<RibbonTab>();

	readonly find = output<void>();
	readonly share = output<void>();
	readonly openFile = output<void>();
	readonly openRecentFile = output<string>();
	readonly createPresentation = output<string>();
	readonly save = output<void>();
	readonly savePpsx = output<void>();
	readonly savePptm = output<void>();
	readonly signatures = output<void>();
	readonly info = output<void>();
	readonly print = output<void>();
	readonly toggleFormatPainter = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly exportJson = output<void>();
	readonly copySlideAsImage = output<void>();
	readonly replace = output<void>();
	readonly openSmartArtDialog = output<void>();
	readonly openEquationDialog = output<void>();
	/** "Slide Templates" in the Home tab's Slides group; the host opens the gallery. */
	readonly openTemplateGallery = output<void>();
	/**
	 * Insert > Hyperlink. Shares the ribbon's existing `link` output with the
	 * Review tab's Link command: both open the one hyperlink edit dialog the
	 * viewer already owns, so there is nothing for the host to wire up twice.
	 */
	readonly link = output<void>();
	readonly openPassword = output<void>();
	readonly openFontEmbedding = output<void>();
	readonly openVersionHistory = output<void>();
	readonly openSettings = output<void>();
	/** The chart entry currently chosen in the Insert tab dropdown (survives tab switches). */
	protected readonly newChartType = signal<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
	/** The shape geometry currently chosen in the Insert tab dropdown (survives tab switches). */
	protected readonly newShapeType = signal<ShapePresetType>('rect');
}
