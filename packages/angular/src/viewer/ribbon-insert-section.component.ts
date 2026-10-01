/**
 * ribbon-insert-section.component.ts: the Insert ribbon tab, split out of
 * {@link RibbonComponent}. A thin adapter for the shared `pptx-ui-ribbon-insert`:
 * the shared element owns groups, icons, labels, pickers and pressed/disabled state;
 * this component supplies viewer state and routes typed intents to the native
 * handlers.
 *
 * Document mutation stays native: inserts go straight through the shared
 * {@link EditorStateService}; the file dialog / FileReader / image-probe plumbing
 * lives in `ribbon-insert-file-picker.ts`; Action buttons, Fields and the Date/Time
 * modal live in {@link RibbonInsertFieldsComponent}; SmartArt, Equation and Hyperlink
 * open the viewer's own dialogs through outputs, and Header & Footer through
 * {@link ViewerDialogsService}.
 *
 * The chart-type and shape-type selections are owned by the parent ribbon (so they
 * survive a tab switch) and passed in via `newChartType` / `newShapeType`; changes
 * emit `chartTypeChange` / `shapeTypeChange`.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
	viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import { classifyMediaType, DEFAULT_INSERT_CHART_KIND } from '../internal/shared';
import type {
	FreeformToolKind,
	InsertChartKind,
	RibbonInsertRequestEvent,
	ShapePresetType,
} from '../internal/shared';
import {
	newChartElement,
	newPresetShapeElement,
	newTableElement,
	newTextElement,
} from './editor-insert';
import { EditorStateService } from './editor-state.service';
import { OutlineAuthoringService } from './outline-authoring.service';
import { RibbonInsertFieldsComponent } from './ribbon-insert-fields.component';
import { imageDimensions, pickFile, readAsDataUrl } from './ribbon-insert-file-picker';
import { visibleFreeformTools } from './ribbon-insert-freeform';
import { injectResolvedCustomization } from './viewer-customization.service';
import { ViewerDialogsService } from './viewer-dialogs.service';

@Component({
	selector: 'pptx-ribbon-insert-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	imports: [RibbonInsertFieldsComponent],
	template: `
		<pptx-ui-ribbon-insert [state]="view()" (insert-request)="request($event)" />
		<pptx-ribbon-insert-fields [slideIndex]="slideIndex()" />
	`,
})
export class RibbonInsertSectionComponent {
	private readonly editor = inject(EditorStateService);
	private readonly translate = inject(TranslateService);
	private readonly dialogs = inject(ViewerDialogsService);
	private readonly outline = inject(OutlineAuthoringService, { optional: true });
	private readonly customization = injectResolvedCustomization();
	private readonly fields = viewChild(RibbonInsertFieldsComponent);

	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(false);
	/** The insert-chart dropdown entry ('column' is vertical, 'bar' horizontal). */
	readonly newChartType = input<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
	readonly newShapeType = input<ShapePresetType>('rect');

	readonly openSmartArtDialog = output<void>();
	readonly openEquationDialog = output<void>();
	/** "Hyperlink"; the host opens the hyperlink edit dialog for the selection. */
	readonly openHyperlink = output<void>();
	readonly chartTypeChange = output<InsertChartKind>();
	readonly shapeTypeChange = output<ShapePresetType>();

	protected view() {
		return {
			editable: this.canEdit(),
			hasSelection: this.editor.hasSelection(),
			shapeType: this.newShapeType(),
			chartKind: this.newChartType(),
			activeFreeformTool: this.outline?.activeFreeformTool() ?? null,
			freeformTools: visibleFreeformTools(this.outline, this.customization()),
			translate: (key: string) => this.translate.instant(key),
		};
	}

	protected request(event: Event): void {
		const intent = (event as RibbonInsertRequestEvent).detail;
		switch (intent.kind) {
			case 'command': {
				const commands = {
					textBox: () => this.editor.addElement(this.slideIndex(), newTextElement()),
					table: () => this.editor.addElement(this.slideIndex(), newTableElement()),
					image: () => this.insertImage(),
					media: () => this.insertMedia(),
					smartArt: () => this.openSmartArtDialog.emit(),
					equation: () => this.openEquationDialog.emit(),
					link: () => this.openHyperlink.emit(),
					headerFooter: () => this.dialogs.showHeaderFooter.set(true),
				};
				commands[intent.value]();
				break;
			}
			case 'shapeType':
				this.shapeTypeChange.emit(intent.value as ShapePresetType);
				break;
			case 'shape':
				this.editor.addElement(
					this.slideIndex(),
					newPresetShapeElement(intent.value as ShapePresetType),
				);
				break;
			case 'chartType':
				this.chartTypeChange.emit(intent.value as InsertChartKind);
				break;
			case 'chart':
				this.editor.addElement(this.slideIndex(), newChartElement(intent.value as InsertChartKind));
				break;
			case 'freeform':
				this.outline?.armFreeformTool(intent.value as FreeformToolKind | null);
				break;
			case 'actionButton':
				this.fields()?.addActionButton(intent.value);
				break;
			case 'field':
				if (intent.value === 'datetime') {
					this.fields()?.openDatePicker();
				} else {
					this.fields()?.insertField(intent.value);
				}
		}
	}

	/** Pick an image file and add it as an inline image element (data-URL backed). */
	private insertImage(): void {
		pickFile('image/*', (file) => void this.addImageFile(file));
	}

	/** Pick an audio/video file and add it as a media element (data-URL backed). */
	private insertMedia(): void {
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
