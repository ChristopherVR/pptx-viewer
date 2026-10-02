<script setup lang="ts">
/**
 * ParagraphGroup: the Home tab's Paragraph group. The list toggles with their
 * Bullets / Numbering library galleries, indent, alignment, line spacing, text
 * direction and columns are all the shared `pptx-ui-ribbon-home-paragraph`
 * element; this adapter reflects the text style and gallery descriptors into it
 * and maps each intent onto the existing undoable text-style edit.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	elementBulletKind,
	getInlineEditorSelectionResult,
	homeGalleryApply,
	homeGalleryControls,
	homeSnapshotTranslator,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	selectionBulletKind,
	withHomeGalleries,
} from 'pptx-viewer-shared';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useRibbonGalleryHost } from '../../composables/useRibbonGalleryHost';
import { getEffectiveTextStyle } from './effective-text-style';
import type { TableCellEditorState } from './ribbon-types';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();
const gallery = useRibbonGalleryHost();

const hasSel = computed(() => Boolean(props.selectedElement));
const canMut = computed(() => hasSel.value && props.canEdit);
const isTextEl = computed(
	() => hasSel.value && props.selectedElement !== null && hasTextProperties(props.selectedElement),
);
const canFormat = computed(
	() => isTextEl.value || (hasSel.value && props.selectedElement?.type === 'table'),
);
const enabled = computed(() => canMut.value && canFormat.value);
const effectiveTs = computed(() =>
	getEffectiveTextStyle(props.selectedElement, props.tableEditorState),
);
/** Table cells keep their list kind in the cell style; text elements read their paragraphs. */
const listKind = computed(() => {
	if (!props.selectedElement) {
		return 'none';
	}
	if (isTextEl.value) {
		return elementBulletKind(props.selectedElement);
	}
	const kind = effectiveTs.value?.listType;
	return kind === 'bullet' || kind === 'numbered' ? kind : 'none';
});

function currentListKind() {
	const element = props.selectedElement;
	if (!element || !hasTextProperties(element)) {
		return 'none';
	}
	const result = getInlineEditorSelectionResult(element.textSegments, { preserveCaret: true });
	return result.kind === 'supported' &&
		(!result.snapshot || result.snapshot.elementId === element.id)
		? selectionBulletKind(element, result.selection, result.snapshot?.textSegments)
		: undefined;
}

function toggleList(kind: 'bullet' | 'numbered'): void {
	if (!canMut.value || !canFormat.value) {
		return;
	}
	if (!isTextEl.value) {
		props.onUpdateTextStyle({ listType: effectiveTs.value?.listType === kind ? 'none' : kind });
		return;
	}
	const current = currentListKind();
	if (current === undefined) {
		return;
	}
	props.onUpdateTextStyle({ listType: current === kind ? 'none' : kind });
}

const paragraphState = computed(() => ({
	controls: withHomeGalleries(
		paragraphHomeControls({
			enabled: enabled.value,
			align: paragraphHomeAlign(effectiveTs.value?.align),
			list: listKind.value === 'mixed' ? 'none' : listKind.value,
			lineSpacing: effectiveTs.value?.lineSpacing,
			columns: effectiveTs.value?.columnCount,
			textDirection: effectiveTs.value?.textDirection,
		}),
		homeGalleryControls('paragraph', gallery.context.value, enabled.value),
		enabled.value,
	),
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	translate: homeSnapshotTranslator(['paragraph'], t),
}));

function request(event: RibbonHomeRequestEvent): void {
	const { id, value } = event.detail;
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	switch (id) {
		case 'home.paragraph.bullets':
		case 'home.paragraph.numbering':
			if (value === undefined) {
				toggleList(id === 'home.paragraph.bullets' ? 'bullet' : 'numbered');
			} else {
				const result = homeGalleryApply('paragraph', id, String(value), gallery.context.value);
				if (result && gallery.editable?.value !== false) {
					gallery.dispatch(result);
				}
			}
			return;
		case 'home.paragraph.lineSpacing':
			props.onUpdateTextStyle({ lineSpacing: Number(value) });
			return;
		case 'home.paragraph.textDirection':
			props.onUpdateTextStyle({ textDirection: value as TextStyle['textDirection'] });
			return;
		case 'home.paragraph.columns':
			props.onUpdateTextStyle({ columnCount: Number(value) });
			return;
	}
	const action = paragraphHomeAction(id);
	if (action?.kind === 'indent') {
		const current = effectiveTs.value?.paragraphMarginLeft ?? 0;
		props.onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current + action.delta) });
	} else if (action) {
		props.onUpdateTextStyle({ align: action.align });
	}
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.paragraph">
		<div class="flex items-center gap-1" data-pptx-chrome="paragraph-controls">
			<pptx-ui-ribbon-home-paragraph :state.prop="paragraphState" @home-request="request" />
		</div>
		<span data-pptx-chrome="ribbon-group-label">{{ t('pptx.ribbon.paragraph') }}</span>
	</div>
</template>
