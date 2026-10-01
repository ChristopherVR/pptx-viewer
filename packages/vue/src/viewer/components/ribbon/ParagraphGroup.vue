<script setup lang="ts">
/**
 * ParagraphGroup: the Home tab's Paragraph group (list toggles with their
 * Bullets / Numbering library galleries, indent, alignment, and the line
 * spacing / direction / columns dropdowns). Split out of `TextSection.vue`.
 * The indent and alignment buttons are the shared `pptx-ui-ribbon-home-paragraph`
 * strip; this adapter maps its one intent onto the existing text-style edit.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	elementBulletKind,
	getInlineEditorSelectionResult,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
	selectionBulletKind,
} from 'pptx-viewer-shared';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getEffectiveTextStyle } from './effective-text-style';
import ParagraphDropdowns from './ParagraphDropdowns.vue';
import { gB, grp, ic } from './ribbon-constants';
import type { TableCellEditorState } from './ribbon-types';
import RibbonGallery from './RibbonGallery.vue';
import RibbonIcon from './RibbonIcon';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const hasSel = computed(() => Boolean(props.selectedElement));
const canMut = computed(() => hasSel.value && props.canEdit);
const isTextEl = computed(
	() => hasSel.value && props.selectedElement !== null && hasTextProperties(props.selectedElement),
);
const canFormat = computed(
	() => isTextEl.value || (hasSel.value && props.selectedElement?.type === 'table'),
);
const listKind = computed(() =>
	props.selectedElement ? elementBulletKind(props.selectedElement) : 'none',
);
const effectiveTs = computed(() =>
	getEffectiveTextStyle(props.selectedElement, props.tableEditorState),
);

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
	if (!canMut.value || !isTextEl.value) {
		return;
	}
	const current = currentListKind();
	if (current === undefined) {
		return;
	}
	props.onUpdateTextStyle({ listType: current === kind ? 'none' : kind });
}

const paragraphState = computed(() => ({
	controls: paragraphHomeControls({
		enabled: canMut.value && canFormat.value,
		align: paragraphHomeAlign(effectiveTs.value?.align),
	}),
	translate: t,
}));

function requestParagraph(event: RibbonHomeRequestEvent): void {
	const action = paragraphHomeAction(event.detail.id);
	if (!canFormat.value || !props.selectedElement || !action) {
		return;
	}
	if (action.kind === 'indent') {
		const current = effectiveTs.value?.paragraphMarginLeft ?? 0;
		props.onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current + action.delta) });
	} else {
		props.onUpdateTextStyle({ align: action.align });
	}
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.paragraph">
		<div class="flex items-center gap-1" data-pptx-chrome="paragraph-controls">
			<!-- List style: each toggle with its library gallery chevron -->
			<div :class="grp" data-pptx-chrome="list-controls">
				<div class="inline-flex items-stretch" data-ribbon-control="home.paragraph.bullets">
					<button
						type="button"
						:disabled="!canMut || !isTextEl"
						:class="[gB, listKind === 'bullet' ? 'bg-accent' : '']"
						:aria-pressed="listKind === 'bullet'"
						:title="t('pptx.text.bulletList')"
						@mousedown.prevent
						@click="toggleList('bullet')"
					>
						<RibbonIcon name="home.paragraph.bullets" :class="ic" />
					</button>
					<RibbonGallery gallery="bullets" mode="chevron" class="border-r border-border" />
				</div>
				<div class="inline-flex items-stretch" data-ribbon-control="home.paragraph.numbering">
					<button
						type="button"
						:disabled="!canMut || !isTextEl"
						:class="[gB, listKind === 'numbered' ? 'bg-accent' : '']"
						:aria-pressed="listKind === 'numbered'"
						:title="t('pptx.text.numberedList')"
						@mousedown.prevent
						@click="toggleList('numbered')"
					>
						<RibbonIcon name="home.paragraph.numbering" :class="ic" />
					</button>
					<RibbonGallery gallery="numbering" mode="chevron" />
				</div>
			</div>

			<!-- Indent and alignment: the shared Paragraph strip -->
			<pptx-ui-ribbon-home-paragraph
				:state.prop="paragraphState"
				@home-request="requestParagraph"
			/>

			<!-- Line Spacing / Text Direction / Columns -->
			<ParagraphDropdowns :can-mut="canMut" :on-update-text-style="props.onUpdateTextStyle" />
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.ribbon.paragraph')
		}}</span>
	</div>
</template>
