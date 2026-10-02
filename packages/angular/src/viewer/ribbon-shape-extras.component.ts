/**
 * ribbon-shape-extras.component.ts: the Arrange group's shape-level extras
 * (Group, Ungroup, Merge Shapes, Crop and the outline-width spinner), a thin
 * adapter around `pptx-ui-ribbon-home-arrange-shape`. It reflects the
 * selection and crop state into the element and runs each typed intent
 * through the editor (one undoable update per edit) and the crop service.
 *
 * The names are the context menu's (`pptx.contextMenu.group` / `.ungroup`)
 * rather than the Arrange tab's older `pptx.ribbon.group`, because the ribbon
 * inventory spec diffs controls by accessible name and every other binding
 * settled on the context-menu wording.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	computed,
	inject,
	input,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';

import {
	arrangeShapeHomeControls,
	canCropElement,
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	cropFill,
	cropFit,
	cropToAspectRatio,
	getCachedNativeImageSize,
	getImageSrc,
	MERGE_SHAPES_LABEL_KEY,
	parseCropValue,
	strokeWidthOf,
} from '../internal/shared';
import type {
	CropElementUpdate,
	MergeShapeOperation,
	RibbonHomeRequestEvent,
	ToolbarActionId,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { canGroupSelected } from './group-lock-guard';
import { LoadContentService } from './load-content.service';
import { canMergeSelection, runMergeShapes } from './merge-shapes-action';
import { PictureCropService } from './picture-crop.service';
import { homeLanguage, homeTranslator } from './ribbon-home-lang';

export { canGroupSelection, canSetStrokeWidth, canUngroupSelection, strokeWidthOf };

/**
 * The ribbon's Group-button decision for one slide: needs an editable deck,
 * two or more selected ids (`canGroupSelection`'s own count gate), and
 * `a:spLocks/@noGrp` allowing every one of them (`group-lock-guard.ts`'s
 * `canGroupSelected`, the same check `EditorStateService.groupSelected`
 * enforces on the command itself). Pulled out of the component's `canGroup`
 * computed so it is testable without an Angular injection context.
 */
export function resolveRibbonCanGroup(
	canEdit: boolean,
	ids: readonly string[],
	slide: PptxSlide | undefined,
): boolean {
	const groupable = slide ? canGroupSelected(slide.elements, ids) : true;
	return canGroupSelection(canEdit, ids.length, groupable);
}

@Component({
	selector: 'pptx-ribbon-shape-extras',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-home-arrange-shape
		[state]="view()"
		(home-request)="request($event)"
	/>`,
})
export class RibbonShapeExtrasComponent {
	protected readonly editor = inject(EditorStateService);
	private readonly crop = inject(PictureCropService, { optional: true });
	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly translation = inject(TranslateService, { optional: true });
	private readonly language = homeLanguage(this.translation);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);
	/** Toolbar buttons the host hides (gates Merge Shapes and Crop). */
	readonly hiddenActions = input<readonly ToolbarActionId[]>([]);

	/** Grouping needs two elements; the multi-select is the source of truth. */
	protected readonly canGroup = computed(() =>
		resolveRibbonCanGroup(
			this.canEdit(),
			this.editor.selectedIds(),
			this.editor.slides()[this.slideIndex()],
		),
	);
	protected readonly canUngroup = computed(() =>
		canUngroupSelection(this.canEdit(), this.selectedElement()),
	);
	protected readonly canSetStroke = computed(() =>
		canSetStrokeWidth(this.canEdit(), this.selectedElement()),
	);
	protected readonly strokeWidth = computed(() => strokeWidthOf(this.selectedElement()));
	/** The single selected picture, when it can be cropped. */
	private readonly cropTarget = computed<PptxElement | null>(() => {
		const el = this.selectedElement();
		return this.editor.selectedIds().length === 1 && canCropElement(el) ? el : null;
	});

	protected view() {
		return {
			controls: arrangeShapeHomeControls({
				editable: this.canEdit(),
				canGroup: this.canGroup(),
				canUngroup: this.canUngroup(),
				canMerge: canMergeSelection(this.editor, this.slideIndex()),
				canCrop: this.cropTarget() !== null,
				cropActive: this.crop?.isCropping(this.cropTarget()?.id ?? null) ?? false,
				canStrokeWidth: this.canSetStroke(),
				strokeWidth: this.strokeWidth(),
				hideMerge: this.hiddenActions().includes('mergeShapes'),
				hideCrop: this.hiddenActions().includes('crop'),
			}),
			translate: homeTranslator(this.translation, this.language, ['arrange-shape']),
		};
	}

	protected request(event: Event): void {
		const { id, value } = (event as RibbonHomeRequestEvent).detail;
		const slide = this.slideIndex();
		switch (id) {
			case 'home.arrange.group':
				this.editor.groupSelected(slide);
				break;
			case 'home.arrange.ungroup':
				this.editor.ungroupSelected(slide);
				break;
			case 'home.arrange.outlineWidth':
				this.onStrokeWidth(Number(value));
				break;
			case 'home.arrange.mergeShapes':
				runMergeShapes(
					this.editor,
					slide,
					value as MergeShapeOperation,
					this.translation?.instant(MERGE_SHAPES_LABEL_KEY) ?? MERGE_SHAPES_LABEL_KEY,
				);
				break;
			case 'home.arrange.crop':
				this.onCrop(value);
		}
	}

	/** Write the typed outline width through the history-integrated patch path. */
	private onStrokeWidth(next: number): void {
		const element = this.selectedElement();
		if (!this.canSetStroke() || element === null || !hasShapeProperties(element)) {
			return;
		}
		if (!Number.isFinite(next)) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), element.id, {
			shapeStyle: { ...element.shapeStyle, strokeWidth: Math.max(0, next) },
		} as Partial<PptxElement>);
	}

	/** The Crop button toggles crop mode; its menu crops in one undoable update. */
	private onCrop(value: string | number | undefined): void {
		const choice = parseCropValue(value);
		if (!choice) {
			this.crop?.toggle(this.slideIndex(), this.cropTarget());
			return;
		}
		this.applyOneClick((el) => {
			if (choice.kind === 'aspect') {
				return cropToAspectRatio(el, choice.width, choice.height);
			}
			const src = getImageSrc(el, this.loader?.mediaDataUrls() ?? new Map<string, string>());
			const natural = getCachedNativeImageSize(src);
			return choice.kind === 'fill' ? cropFill(el, natural) : cropFit(el, natural);
		});
	}

	/** Commit any live crop session, then apply `compute` as ONE undoable update. */
	private applyOneClick(compute: (el: PptxElement) => CropElementUpdate): void {
		this.crop?.commit();
		const id = this.cropTarget()?.id;
		const el = id
			? this.editor.slides()[this.slideIndex()]?.elements.find((item) => item.id === id)
			: undefined;
		if (!el || !this.canEdit()) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), el.id, compute(el) as Partial<PptxElement>);
	}
}
