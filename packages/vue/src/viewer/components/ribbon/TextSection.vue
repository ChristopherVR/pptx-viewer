<script setup lang="ts">
/** Vue's Home character-formatting controls and thin editor wiring. */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import { textFontSizePtToPx } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { getEffectiveTextStyle } from './effective-text-style';
import FontHomeControls from './FontHomeControls.vue';
import ParagraphGroup from './ParagraphGroup.vue';
import { SEP } from './ribbon-constants';
import type { TableCellEditorState } from './ribbon-types';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	onTransformTextCase: (mode: ChangeCaseMode) => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

const hasSel = computed(() => Boolean(props.selectedElement));
const canMut = computed(() => hasSel.value && props.canEdit);
const isTextEl = computed(
	() => hasSel.value && props.selectedElement !== null && hasTextProperties(props.selectedElement),
);
const isTable = computed(() => hasSel.value && props.selectedElement?.type === 'table');
// Enable formatting for text elements AND table cells
const canFormat = computed(() => isTextEl.value || isTable.value);
const effectiveTs = computed(() =>
	getEffectiveTextStyle(props.selectedElement, props.tableEditorState),
);

const currentColor = computed(() =>
	isTextEl.value && props.selectedElement && hasTextProperties(props.selectedElement)
		? (props.selectedElement.textSegments?.[0]?.style?.color ??
			props.selectedElement.textStyle?.color ??
			'#000000')
		: (effectiveTs.value?.color ?? '#000000'),
);

const currentColorThemeRef = computed<PptxThemeColorRef | undefined>(() =>
	isTextEl.value && props.selectedElement && hasTextProperties(props.selectedElement)
		? (props.selectedElement.textSegments?.[0]?.style?.colorRef ??
			props.selectedElement.textStyle?.colorRef)
		: undefined,
);

const currentHighlight = computed(() =>
	isTextEl.value && props.selectedElement && hasTextProperties(props.selectedElement)
		? (props.selectedElement.textSegments?.[0]?.style?.highlightColor ??
			props.selectedElement.textStyle?.highlightColor ??
			'#ffff00')
		: '#ffff00',
);

function handleColorChange(color: string, ref?: PptxThemeColorRef): void {
	if (!canFormat.value) {
		return;
	}
	props.onUpdateTextStyle({ color, colorRef: ref });
}

function handleHighlightChange(highlightColor: string): void {
	if (!canFormat.value) {
		return;
	}
	props.onUpdateTextStyle({ highlightColor });
}

function handleFmtClick(id: string): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const ts = effectiveTs.value;
	switch (id) {
		case 'bold':
			props.onUpdateTextStyle({ bold: !ts?.bold });
			break;
		case 'italic':
			props.onUpdateTextStyle({ italic: !ts?.italic });
			break;
		case 'underline':
			props.onUpdateTextStyle({ underline: !ts?.underline });
			break;
		case 'strikethrough':
			props.onUpdateTextStyle({ strikethrough: !ts?.strikethrough });
			break;
	}
}

function handleIncreaseFontSize(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.fontSize ?? (isTextEl.value ? textFontSizePtToPx(18) : 18);
	const delta = isTextEl.value ? textFontSizePtToPx(2) : 2;
	props.onUpdateTextStyle({ fontSize: current + delta });
}

function handleDecreaseFontSize(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.fontSize ?? (isTextEl.value ? textFontSizePtToPx(18) : 18);
	const delta = isTextEl.value ? textFontSizePtToPx(2) : 2;
	const minimum = isTextEl.value ? textFontSizePtToPx(1) : 1;
	props.onUpdateTextStyle({ fontSize: Math.max(minimum, current - delta) });
}

function handleClearFormatting(): void {
	if (!canFormat.value) {
		return;
	}
	props.onUpdateTextStyle({
		bold: false,
		italic: false,
		underline: false,
		strikethrough: false,
		highlightColor: undefined,
	});
}

/* ── Text Shadow ── */
function handleToggleTextShadow(): void {
	if (!canFormat.value) {
		return;
	}
	const hasShadow = Boolean(effectiveTs.value?.textShadowColor);
	if (hasShadow) {
		props.onUpdateTextStyle({ textShadowColor: undefined });
	} else {
		props.onUpdateTextStyle({
			textShadowColor: '#000000',
			textShadowBlur: 2,
			textShadowOffsetX: 1,
			textShadowOffsetY: 1,
		});
	}
}

function handleCharSpacing(value: number): void {
	if (canFormat.value) {
		props.onUpdateTextStyle({ characterSpacing: value });
	}
}
function handleChangeCase(value: ChangeCaseMode): void {
	if (!canFormat.value) {
		return;
	}
	if (isTable.value) {
		props.onUpdateTextStyle({ textCaps: value === 'upper' ? 'all' : 'none' });
	} else {
		props.onTransformTextCase(value);
	}
}
</script>

<template>
	<!-- ── Font group ── -->
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.font">
		<div class="flex items-center gap-1" data-pptx-chrome="font-controls">
			<FontHomeControls
				:disabled="!canMut || !canFormat"
				:text-style="effectiveTs"
				:color="currentColor"
				:color-ref="currentColorThemeRef"
				:highlight="currentHighlight"
				@format="handleFmtClick"
				@shadow="handleToggleTextShadow"
				@increase="handleIncreaseFontSize"
				@decrease="handleDecreaseFontSize"
				@clear="handleClearFormatting"
				@color="handleColorChange"
				@highlight="handleHighlightChange"
				@spacing="handleCharSpacing"
				@case="handleChangeCase"
			/>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{ t('pptx.ribbon.font') }}</span>
	</div>

	<div :class="SEP" />

	<!-- ── Paragraph group ── -->
	<ParagraphGroup
		:can-edit="props.canEdit"
		:selected-element="props.selectedElement"
		:table-editor-state="props.tableEditorState"
		:on-update-text-style="props.onUpdateTextStyle"
	/>
</template>
