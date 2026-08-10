import { createEditorId, createShapeElement, createTextElement } from 'pptx-viewer-core';
import type { PptxElement, PptxHandler, PptxSlide } from 'pptx-viewer-core';
import {
	createDefaultChartElement,
	newFieldElement,
	newTableElement,
	resolveInsertedFieldText,
} from 'pptx-viewer-shared';
import type { InsertChartKind } from 'pptx-viewer-shared';
import { ref } from 'vue';
import type { Ref, ShallowRef } from 'vue';

import type { ShapePreset } from '../components/EditorToolbar.vue';
import { buildActionButtonElement } from './action-buttons';
import { partitionTemplateElements } from './template-editing';
import type { TemplateElementMap } from './template-editing';
import type { EditorOperations } from './useEditorOperations';

export interface UseElementInsertionInput {
	canvasSize: Ref<{ width: number; height: number }>;
	ops: EditorOperations;
	selectedElementIds: Ref<string[]>;
	slides: Ref<PptxSlide[]>;
	activeSlideIndex: Ref<number>;
	pushHistory: () => void;
	handler: ShallowRef<PptxHandler | null>;
	/**
	 * The per-slide store of inherited layout / master artwork, refreshed when a
	 * slide is re-mapped onto a different layout. Optional so callers that never
	 * switch layouts (tests, read-only hosts) need not thread it through.
	 */
	templateElementsBySlideId?: Ref<TemplateElementMap>;
}

export interface UseElementInsertionResult {
	imageInputRef: Ref<HTMLInputElement | null>;
	mediaInputRef: Ref<HTMLInputElement | null>;
	addText: () => void;
	addShape: (preset: ShapePreset) => void;
	addTable: () => void;
	addChart: (chartKind: InsertChartKind) => void;
	addField: (fieldType: string, value?: string) => void;
	openImagePicker: () => void;
	onImageFileSelected: (e: Event) => void;
	openMediaPicker: () => void;
	onMediaFileSelected: (e: Event) => void;
	addActionButton: (shapeType: string) => void;
	insertSlideFromLayout: (layoutPath: string, layoutName?: string) => Promise<void>;
	/** Re-map the active slide onto another layout of its master. */
	applyLayoutToActiveSlide: (layoutPath: string) => Promise<void>;
}

/**
 * useElementInsertion: Insert-tab element creation for the Vue editor.
 *
 * Owns the hidden image/media `<input>` refs and every "add a new element"
 * handler (text / shape / table / chart / image / media / action button /
 * new slide from layout). Each newly-created element is centred on the slide
 * and selected. Extracted verbatim from `PowerPointViewer.vue`.
 */
export function useElementInsertion(input: UseElementInsertionInput): UseElementInsertionResult {
	const {
		canvasSize,
		ops,
		selectedElementIds,
		slides,
		activeSlideIndex,
		pushHistory,
		handler,
		templateElementsBySlideId,
	} = input;

	/** Centre a newly-created element (default box) on the slide. */
	function centreNewElement(el: PptxElement, width: number, height: number): void {
		el.width = width;
		el.height = height;
		el.x = Math.max(0, Math.round((canvasSize.value.width - width) / 2));
		el.y = Math.max(0, Math.round((canvasSize.value.height - height) / 2));
	}

	function addText(): void {
		const el = createTextElement('Text');
		centreNewElement(el, 320, 80);
		ops.addElement(el);
		selectedElementIds.value = [el.id];
	}
	function addShape(preset: ShapePreset): void {
		const el = createShapeElement(preset);
		centreNewElement(el, 240, 160);
		ops.addElement(el);
		selectedElementIds.value = [el.id];
	}

	/**
	 * Insert a default 3×3 table, centred on the slide. Uses the shared factory
	 * so the new table gets the visible default style (header row + banded rows
	 * + borders), consistent with the React and Angular insert defaults.
	 */
	function addTable(): void {
		const el = { ...newTableElement(3, 3), id: createEditorId('table') } as PptxElement;
		centreNewElement(el, 600, 250);
		ops.addElement(el);
		selectedElementIds.value = [el.id];
	}

	/** Insert a default chart of the given dropdown kind, centred on the slide. */
	function addChart(chartKind: InsertChartKind): void {
		const el = createDefaultChartElement(chartKind) as PptxElement;
		centreNewElement(el, el.width, el.height);
		ops.addElement(el);
		selectedElementIds.value = [el.id];
	}

	/** Insert a dynamic slide/date/header/footer field, centred and selected. */
	function addField(fieldType: string, value?: string): void {
		const displayText = resolveInsertedFieldText(fieldType, activeSlideIndex.value + 1, value);
		const el = newFieldElement(fieldType, displayText);
		el.id = createEditorId('field');
		centreNewElement(el, el.width, el.height);
		ops.addElement(el);
		selectedElementIds.value = [el.id];
	}

	// ── Image picker (Insert tab) ──
	const imageInputRef = ref<HTMLInputElement | null>(null);
	function openImagePicker(): void {
		imageInputRef.value?.click();
	}
	function onImageFileSelected(e: Event): void {
		const inputEl = e.target as HTMLInputElement;
		const file = inputEl.files?.[0];
		inputEl.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = typeof reader.result === 'string' ? reader.result : '';
			if (!dataUrl) {
				return;
			}
			// Size the picture to ~60% of the slide width, preserving aspect ratio.
			const probe = new Image();
			probe.onload = () => {
				const maxW = Math.round(canvasSize.value.width * 0.6);
				const ratio = probe.width / Math.max(1, probe.height);
				const width = Math.min(maxW, probe.width || maxW);
				const height = Math.max(1, Math.round(width / (ratio || 1)));
				const el = {
					id: createEditorId('image'),
					type: 'image',
					x: 0,
					y: 0,
					width,
					height,
					imageData: dataUrl,
				} as unknown as PptxElement;
				centreNewElement(el, width, height);
				ops.addElement(el);
				selectedElementIds.value = [el.id];
			};
			probe.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}

	// ── Media picker (Insert tab): audio / video ──
	const mediaInputRef = ref<HTMLInputElement | null>(null);
	function openMediaPicker(): void {
		mediaInputRef.value?.click();
	}
	function onMediaFileSelected(e: Event): void {
		const inputEl = e.target as HTMLInputElement;
		const file = inputEl.files?.[0];
		inputEl.value = '';
		if (!file) {
			return;
		}
		const mediaType: 'audio' | 'video' | null = file.type.startsWith('audio/')
			? 'audio'
			: file.type.startsWith('video/')
				? 'video'
				: null;
		if (!mediaType) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = typeof reader.result === 'string' ? reader.result : '';
			if (!dataUrl) {
				return;
			}
			const insert = (width: number, height: number): void => {
				const el = {
					id: createEditorId('media'),
					type: 'media',
					mediaType,
					mediaMimeType: file.type || undefined,
					mediaData: dataUrl,
					x: 0,
					y: 0,
					width,
					height,
				} as unknown as PptxElement;
				centreNewElement(el, width, height);
				ops.addElement(el);
				selectedElementIds.value = [el.id];
			};
			// Audio: fixed control-bar box. Video: probe intrinsic size, cap at 640×360.
			if (mediaType === 'audio') {
				insert(420, 64);
				return;
			}
			const probe = document.createElement('video');
			probe.preload = 'metadata';
			probe.onloadedmetadata = () => {
				const maxW = 640;
				const maxH = 360;
				let w = probe.videoWidth || maxW;
				let h = probe.videoHeight || maxH;
				if (w > maxW || h > maxH) {
					const scale = Math.min(maxW / w, maxH / h);
					w = Math.round(w * scale);
					h = Math.round(h * scale);
				}
				insert(w, h);
			};
			probe.onerror = () => insert(640, 360);
			probe.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}

	/** Insert an OOXML action button (Insert ▸ Action), centred + selected. */
	function addActionButton(shapeType: string): void {
		const el = buildActionButtonElement(shapeType, createEditorId('action'));
		if (!el) {
			return;
		}
		centreNewElement(el, 120, 50);
		ops.addElement(el);
		selectedElementIds.value = [el.id];
	}

	/**
	 * Insert a new slide based on a chosen layout (New-Slide gallery). The draft
	 * carries `layoutPath` so placeholders render immediately; the handler then
	 * walks the layout XML to populate background/placeholders (mirrors React's
	 * `handleInsertSlideFromLayout`).
	 */
	/**
	 * Re-map the ACTIVE slide onto `layoutPath`, keeping its content.
	 *
	 * The core call returns the slide with its placeholders moved onto the target
	 * layout's geometry and the layout relationship rewritten; unlike
	 * {@link insertSlideFromLayout} nothing is added to the deck.
	 */
	async function applyLayoutToActiveSlide(layoutPath: string): Promise<void> {
		const h = handler.value;
		const index = activeSlideIndex.value;
		const target = slides.value[index];
		if (!h || !target) {
			return;
		}
		const updated = await h.applyLayoutToSlide(index, layoutPath, slides.value).catch(() => null);
		if (!updated || slides.value[index]?.id !== target.id) {
			return;
		}
		pushHistory();
		// Core returns the slide with the TARGET layout's inherited artwork merged
		// in; this editor holds that artwork in its own store, so the result is
		// partitioned again and the store entry REPLACED. Without that the canvas
		// keeps painting the previous layout's decoration.
		const partitioned = partitionTemplateElements([updated]);
		const next = slides.value.slice();
		next[index] = partitioned.slides[0]!;
		slides.value = next;
		if (templateElementsBySlideId) {
			templateElementsBySlideId.value = {
				...templateElementsBySlideId.value,
				[updated.id]: partitioned.templateElementsBySlideId[updated.id] ?? [],
			};
		}
	}

	async function insertSlideFromLayout(layoutPath: string, layoutName?: string): Promise<void> {
		const insertAt = activeSlideIndex.value + 1;
		pushHistory();
		const draft = {
			id: createEditorId('slide'),
			rId: '',
			slideNumber: slides.value.length + 1,
			elements: [],
			layoutPath,
			...(layoutName ? { layoutName } : {}),
		} as unknown as PptxSlide;
		const next = slides.value.slice();
		next.splice(insertAt, 0, draft);
		slides.value = next;
		activeSlideIndex.value = insertAt;
		const h = handler.value;
		if (!h) {
			return;
		}
		// Returns the single updated slide (layout metadata/placeholders applied).
		const updated = await h
			.applyLayoutToSlide(insertAt, layoutPath, slides.value)
			.catch(() => null);
		if (updated && updated.id === draft.id && slides.value[insertAt]?.id === draft.id) {
			const merged = slides.value.slice();
			merged[insertAt] = updated;
			slides.value = merged;
		}
	}

	return {
		imageInputRef,
		mediaInputRef,
		addText,
		addShape,
		addTable,
		addChart,
		addField,
		openImagePicker,
		onImageFileSelected,
		openMediaPicker,
		onMediaFileSelected,
		addActionButton,
		insertSlideFromLayout,
		applyLayoutToActiveSlide,
	};
}
