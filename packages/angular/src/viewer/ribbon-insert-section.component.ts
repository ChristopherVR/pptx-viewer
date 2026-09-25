/**
 * ribbon-insert-section.component.ts: the Insert ribbon tab (Text box / shape
 * picker / image / media group, Table / SmartArt / Chart / Equation group, and the
 * Action + Field controls via {@link RibbonInsertFieldsComponent}). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 *
 * The chart-type and shape-type dropdowns are owned by the parent ribbon (so a
 * selection survives a tab switch) and passed in via `newChartType` /
 * `newShapeType`; changes emit `chartTypeChange` / `shapeTypeChange`. The shape
 * picker offers the whole shared preset catalogue rather than a fixed
 * rect/ellipse/line trio, matching React's Insert tab. Everything else inserts
 * straight through the shared {@link EditorStateService}.
 *
 * The Links group is {@link RibbonHyperlinkButtonComponent}, and the file
 * dialog / FileReader / image-probe plumbing behind Image and Media lives in
 * `ribbon-insert-file-picker.ts`: both are out of this file so it stays inside
 * the repo's 300-LOC budget.
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
	LucideDatabase,
	LucideImage,
	LucideLayers,
	LucideSquare,
	LucideVideo,
} from '@lucide/angular';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	classifyMediaType,
	DEFAULT_INSERT_CHART_KIND,
	INSERT_CHART_TYPES,
	SHAPE_PRESET_DEFS,
} from '../internal/shared';
import type { InsertChartKind, ShapePresetType } from '../internal/shared';
import {
	newChartElement,
	newPresetShapeElement,
	newTableElement,
	newTextElement,
} from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { HeaderFooterRibbonButtonComponent } from './header-footer-ribbon-button.component';
import { RibbonFreeformToolsComponent } from './ribbon-freeform-tools.component';
import { RibbonHyperlinkButtonComponent } from './ribbon-hyperlink-button.component';
import { RibbonInsertFieldsComponent } from './ribbon-insert-fields.component';
import { imageDimensions, pickFile, readAsDataUrl } from './ribbon-insert-file-picker';
import { RibbonInsertGlyphComponent } from './ribbon-insert-glyph.component';

@Component({
	selector: 'pptx-ribbon-insert-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		TranslatePipe,
		RibbonInsertFieldsComponent,
		LucideSquare,
		LucideImage,
		LucideVideo,
		LucideDatabase,
		LucideLayers,
		HeaderFooterRibbonButtonComponent,
		RibbonHyperlinkButtonComponent,
		RibbonFreeformToolsComponent,
		RibbonInsertGlyphComponent,
	],
	template: `
		<!-- Shapes group -->
		<div class="pptx-rb-grp">
			<span class="contents" data-ribbon-group="insert.text">
				<button
					type="button"
					class="pptx-rb-gb"
					data-ribbon-control="insert.text.textBox"
					(click)="insertText()"
					[title]="'pptx.ribbon.textBox' | translate"
				>
					{{ 'pptx.ribbon.textBox' | translate }}
				</button>
			</span>
			<span
				class="contents"
				data-ribbon-group="insert.illustrations"
				data-ribbon-control="insert.illustrations.shapes"
			>
				<select
					class="pptx-rb-select rounded-none border-y-0 border-l-0"
					[title]="'pptx.insert.shapeType' | translate"
					[value]="newShapeType()"
					(change)="setShapeType($event)"
				>
					@for (sp of shapePresets; track sp.type) {
						<option [value]="sp.type" [selected]="sp.type === newShapeType()">
							{{ sp.i18nKey | translate }}
						</option>
					}
				</select>
				<button
					type="button"
					class="pptx-rb-gb gap-1.5"
					(click)="insertShape()"
					[title]="'pptx.insert.addShape' | translate"
				>
					<svg lucideSquare class="h-4 w-4"></svg> {{ 'pptx.insert.shape' | translate }}
				</button>
				<pptx-ribbon-freeform-tools />
			</span>
			<span
				class="contents"
				data-ribbon-group="insert.images"
				data-ribbon-control="insert.images.pictures"
			>
				<button
					type="button"
					class="pptx-rb-gb gap-1.5"
					(click)="insertImage()"
					[title]="'pptx.ribbon.insertImage' | translate"
				>
					<svg lucideImage class="h-4 w-4"></svg> {{ 'pptx.ribbon.image' | translate }}
				</button>
			</span>
			<span
				class="contents"
				data-ribbon-group="insert.media"
				data-ribbon-control="insert.media.media"
			>
				<button
					type="button"
					class="pptx-rb-gl gap-1.5"
					(click)="insertMedia()"
					[title]="'pptx.ribbon.insertMedia' | translate"
				>
					<svg lucideVideo class="h-4 w-4"></svg> {{ 'pptx.ribbon.media' | translate }}
				</button>
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Data / diagram group -->
		<div class="pptx-rb-grp">
			<span
				class="contents"
				data-ribbon-group="insert.tables"
				data-ribbon-control="insert.tables.table"
			>
				<button
					type="button"
					class="pptx-rb-gb gap-1.5"
					(click)="insertTable()"
					[title]="'pptx.ribbon.insertTable' | translate"
				>
					<svg lucideDatabase class="h-4 w-4"></svg> {{ 'pptx.ribbon.table' | translate }}
				</button>
			</span>
			<span class="contents" data-ribbon-group="insert.illustrations">
				<button
					data-ribbon-control="insert.illustrations.smartArt"
					type="button"
					class="pptx-rb-gb gap-1.5"
					(click)="openSmartArtDialog.emit()"
					[title]="'pptx.ribbon.insertSmartArt' | translate"
				>
					<svg lucideLayers class="h-4 w-4"></svg> {{ 'pptx.ribbon.smartArt' | translate }}
				</button>
				<span class="contents" data-ribbon-control="insert.illustrations.chart">
					<select
						class="pptx-rb-gl"
						[title]="'pptx.ribbon.chartType' | translate"
						[value]="newChartType()"
						(change)="setChartType($event)"
					>
						@for (ct of chartTypes; track ct.id) {
							<option [value]="ct.id" [selected]="ct.id === newChartType()">
								{{ ct.labelKey | translate }}
							</option>
						}
					</select>
					<button
						type="button"
						class="pptx-rb-gb gap-1.5"
						(click)="insertChart()"
						[title]="'pptx.ribbon.insertChart' | translate"
					>
						<pptx-ribbon-insert-glyph name="chart" />
						{{ 'pptx.ribbon.chart' | translate }}
					</button>
				</span>
			</span>
			<span
				class="contents"
				data-ribbon-group="insert.symbols"
				data-ribbon-control="insert.symbols.equation"
			>
				<button
					type="button"
					class="pptx-rb-gl gap-1.5"
					(click)="openEquationDialog.emit()"
					[title]="'pptx.ribbon.insertEquation' | translate"
				>
					<pptx-ribbon-insert-glyph name="equation" />
					{{ 'pptx.ribbon.equation' | translate }}
				</button>
			</span>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Links -->
		<pptx-ribbon-hyperlink-button
			data-ribbon-group="insert.links"
			data-ribbon-control="insert.links.link"
			(openHyperlink)="openHyperlink.emit()"
		/>
		<span class="pptx-rb-sep"></span>
		<!-- Action button + Field dropdowns -->
		<pptx-ribbon-insert-fields [slideIndex]="slideIndex()" />
		<pptx-header-footer-ribbon-button />
	`,
})
export class RibbonInsertSectionComponent {
	private readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);

	readonly slideIndex = input<number>(0);
	/** The insert-chart dropdown entry ('column' is vertical, 'bar' horizontal). */
	readonly newChartType = input<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
	readonly newShapeType = input<ShapePresetType>('rect');

	readonly openSmartArtDialog = output<void>();
	readonly openEquationDialog = output<void>();
	/** "Hyperlink"; the host opens the hyperlink edit dialog for the selection. */
	readonly openHyperlink = output<void>();
	readonly chartTypeChange = output<InsertChartKind>();
	readonly shapeTypeChange = output<ShapePresetType>();

	/** Chart types offered in the Insert tab dropdown (shared source of truth). */
	protected readonly chartTypes = INSERT_CHART_TYPES;
	/** Geometries offered by the Insert tab's shape picker (shared catalogue). */
	protected readonly shapePresets = SHAPE_PRESET_DEFS;

	protected insertText(): void {
		this.editor.addElement(this.slideIndex(), newTextElement());
	}
	protected setShapeType(event: Event): void {
		this.shapeTypeChange.emit((event.target as HTMLSelectElement).value as ShapePresetType);
	}
	/** Insert the geometry currently chosen in the shape-type dropdown. */
	protected insertShape(): void {
		this.editor.addElement(this.slideIndex(), newPresetShapeElement(this.newShapeType()));
	}
	protected insertTable(): void {
		this.editor.addElement(this.slideIndex(), newTableElement());
	}
	protected setChartType(event: Event): void {
		this.chartTypeChange.emit((event.target as HTMLSelectElement).value as InsertChartKind);
	}
	protected insertChart(): void {
		this.editor.addElement(this.slideIndex(), newChartElement(this.newChartType()));
	}

	/** Pick an image file and add it as an inline image element (data-URL backed). */
	protected insertImage(): void {
		pickFile('image/*', (file) => void this.addImageFile(file));
	}

	/** Pick an audio/video file and add it as a media element (data-URL backed). */
	protected insertMedia(): void {
		pickFile('video/*,audio/*', (file) => void this.addMediaFile(file));
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
			name: file.name || this.translate.instant('pptx.elementType.image'),
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
		const mediaType = classifyMediaType(file.type);
		if (!mediaType) {
			return;
		}
		const isAudio = mediaType === 'audio';
		const element: PptxElement = {
			type: 'media',
			id: '',
			name: file.name || this.translate.instant('pptx.elementType.media'),
			x: 100,
			y: 100,
			width: isAudio ? 280 : 480,
			height: isAudio ? 64 : 270,
			mediaType,
			mediaData: dataUrl,
			mediaMimeType: file.type,
		} as PptxElement;
		this.editor.addElement(this.slideIndex(), element);
	}
}
