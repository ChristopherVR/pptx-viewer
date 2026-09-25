<script setup lang="ts">
/**
 * ParagraphGroup: the Home tab's Paragraph group (list toggles with their
 * Bullets / Numbering library galleries, indent, alignment, and the line
 * spacing / direction / columns dropdowns). Split out of `TextSection.vue`.
 */
import { IndentDecrease, IndentIncrease, List, ListOrdered } from 'lucide-vue-next';
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import {
	elementBulletKind,
	getInlineEditorSelectionResult,
	selectionBulletKind,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getEffectiveTextStyle } from './effective-text-style';
import ParagraphDropdowns from './ParagraphDropdowns.vue';
import { ATXT, gB, gL, grp, ic } from './ribbon-constants';
import type { TableCellEditorState } from './ribbon-types';
import RibbonGallery from './RibbonGallery.vue';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const ALIGN_CONTROL: Record<string, string> = {
	left: 'home.paragraph.alignLeft',
	center: 'home.paragraph.alignCenter',
	right: 'home.paragraph.alignRight',
	justify: 'home.paragraph.justify',
};

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

function stepIndent(delta: number): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.paragraphMarginLeft ?? 0;
	props.onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current + delta) });
}

function handleAlignClick(id: string): void {
	if (!canFormat.value) {
		return;
	}
	if (id === 'left' || id === 'center' || id === 'right' || id === 'justify') {
		props.onUpdateTextStyle({ align: id });
	}
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.paragraph">
		<div class="flex items-center gap-1">
			<!-- List style: each toggle with its library gallery chevron -->
			<div :class="grp">
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
						<List :class="ic" />
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
						<ListOrdered :class="ic" />
					</button>
					<RibbonGallery gallery="numbering" mode="chevron" />
				</div>
			</div>

			<!-- Indent decrease / increase -->
			<div :class="grp">
				<button
					type="button"
					data-ribbon-control="home.paragraph.decreaseIndent"
					:disabled="!canMut"
					:class="gB"
					:title="t('pptx.text.decreaseIndent')"
					@mousedown.prevent
					@click="stepIndent(-24)"
				>
					<IndentDecrease :class="ic" />
				</button>
				<button
					type="button"
					data-ribbon-control="home.paragraph.increaseIndent"
					:disabled="!canMut"
					:class="gL"
					:title="t('pptx.text.increaseIndent')"
					@mousedown.prevent
					@click="stepIndent(24)"
				>
					<IndentIncrease :class="ic" />
				</button>
			</div>

			<!-- Alignment -->
			<div :class="grp">
				<button
					v-for="(b, i) in ATXT"
					:key="b.id"
					type="button"
					:data-ribbon-control="ALIGN_CONTROL[b.id]"
					:disabled="!canMut"
					:class="i < ATXT.length - 1 ? gB : gL"
					:title="t(b.labelKey)"
					@mousedown.prevent
					@click="handleAlignClick(b.id)"
				>
					<component :is="b.icon" :class="ic" />
				</button>
			</div>

			<!-- Line Spacing / Text Direction / Columns -->
			<ParagraphDropdowns :can-mut="canMut" :on-update-text-style="props.onUpdateTextStyle" />
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.ribbon.paragraph')
		}}</span>
	</div>
</template>
