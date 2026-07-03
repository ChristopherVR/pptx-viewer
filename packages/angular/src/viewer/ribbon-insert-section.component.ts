/**
 * ribbon-insert-section.component.ts: the Insert ribbon tab (Text box / shapes /
 * image / media group, Table / SmartArt / Chart / Equation group, and the
 * Action + Field controls via {@link RibbonInsertFieldsComponent}). Split out of
 * {@link RibbonComponent}; behaviour and markup are unchanged.
 *
 * The chart-type dropdown is owned by the parent ribbon (so its selection
 * persists across tab switches) and passed in via `newChartType`; changes emit
 * `chartTypeChange`. Everything else inserts straight through the shared
 * {@link EditorStateService}.
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxChartType, PptxElement } from 'pptx-viewer-core';

import { INSERT_CHART_TYPES } from '../internal/shared';
import { newChartElement, newShapeElement, newTableElement, newTextElement } from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { RibbonInsertFieldsComponent } from './ribbon-insert-fields.component';

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
	selector: 'pptx-ribbon-insert-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, RibbonInsertFieldsComponent],
	template: `
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
				(click)="openSmartArtDialog.emit()"
				[title]="'pptx.ribbon.insertSmartArt' | translate"
			>
				◈ {{ 'pptx.ribbon.smartArt' | translate }}
			</button>
			<select
				class="pptx-rb-gl"
				[title]="'pptx.ribbon.chartType' | translate"
				[value]="newChartType()"
				(change)="setChartType($event)"
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
				(click)="openEquationDialog.emit()"
				[title]="'pptx.ribbon.insertEquation' | translate"
			>
				∑ {{ 'pptx.ribbon.equation' | translate }}
			</button>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Action button + Field dropdowns -->
		<pptx-ribbon-insert-fields [slideIndex]="slideIndex()" />
	`,
})
export class RibbonInsertSectionComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly newChartType = input<PptxChartType>('bar');

	readonly openSmartArtDialog = output<void>();
	readonly openEquationDialog = output<void>();
	readonly chartTypeChange = output<PptxChartType>();

	/** Chart types offered in the Insert tab dropdown (shared source of truth). */
	protected readonly chartTypes = INSERT_CHART_TYPES;

	protected insertText(): void {
		this.editor.addElement(this.slideIndex(), newTextElement());
	}
	protected insertShape(kind: 'rect' | 'ellipse' | 'line'): void {
		this.editor.addElement(this.slideIndex(), newShapeElement(kind));
	}
	protected insertTable(): void {
		this.editor.addElement(this.slideIndex(), newTableElement());
	}
	protected setChartType(event: Event): void {
		this.chartTypeChange.emit((event.target as HTMLSelectElement).value as PptxChartType);
	}
	protected insertChart(): void {
		this.editor.addElement(this.slideIndex(), newChartElement(this.newChartType()));
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
}
