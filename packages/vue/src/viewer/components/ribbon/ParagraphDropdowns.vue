<script setup lang="ts">
/**
 * ParagraphDropdowns: Line Spacing, Text Direction, and Columns dropdowns
 * extracted from TextSection to keep file size under 300 LOC.
 */
import { ChevronDown, Columns2, Columns3, RotateCw } from 'lucide-vue-next';
import type { TextStyle } from 'pptx-viewer-core';
import { useI18n } from 'vue-i18n';

import { vAnchoredPopup } from './anchored-popup';
import { ic, MENU_ITEM, MENU_PANEL, pill } from './ribbon-constants';
import { useDropdown } from './use-dropdown';

interface Props {
	canMut: boolean;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

/* ── Line Spacing ── */
const LINE_SPACING_OPTIONS = [
	{ label: '1.0', value: 1.0 },
	{ label: '1.15', value: 1.15 },
	{ label: '1.5', value: 1.5 },
	{ label: '2.0', value: 2.0 },
	{ label: '2.5', value: 2.5 },
	{ label: '3.0', value: 3.0 },
];

const lineSpacingMenu = useDropdown();

function handleLineSpacing(value: number): void {
	if (!props.canMut) {
		return;
	}
	props.onUpdateTextStyle({ lineSpacing: value });
	lineSpacingMenu.close();
}

/* ── Text Direction ── */
const TEXT_DIRECTION_OPTIONS: Array<{ labelKey: string; value: TextStyle['textDirection'] }> = [
	{ labelKey: 'pptx.slideInspector.horizontal', value: 'horizontal' },
	{ labelKey: 'pptx.ribbon.textDirectionRotate90', value: 'vertical' },
	{ labelKey: 'pptx.ribbon.textDirectionRotate270', value: 'vertical270' },
	{ labelKey: 'pptx.ribbon.textDirectionStacked', value: 'wordArtVert' },
];

const textDirectionMenu = useDropdown();

function handleTextDirection(value: TextStyle['textDirection']): void {
	if (!props.canMut) {
		return;
	}
	props.onUpdateTextStyle({ textDirection: value });
	textDirectionMenu.close();
}

/* ── Columns ── */
const COLUMN_OPTIONS = [
	{ labelKey: 'pptx.ribbon.columns1', value: 1 },
	{ labelKey: 'pptx.ribbon.columns2', value: 2 },
	{ labelKey: 'pptx.ribbon.columns3', value: 3 },
];

const columnsMenu = useDropdown();

function handleColumns(value: number): void {
	if (!props.canMut) {
		return;
	}
	props.onUpdateTextStyle({ columnCount: value });
	columnsMenu.close();
}
</script>

<template>
	<!-- Line Spacing -->
	<div :ref="lineSpacingMenu.root" class="relative">
		<button
			type="button"
			:disabled="!props.canMut"
			:class="pill"
			:title="t('pptx.paragraph.lineSpacing')"
			@mousedown.prevent
			@click="lineSpacingMenu.toggle()"
		>
			<svg :class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M6 6h12M6 12h12M6 18h12M3 6v12M3 6l1.5-2M3 6l-1.5-2M3 18l1.5 2M3 18l-1.5 2" />
			</svg>
			<ChevronDown class="w-3 h-3" />
		</button>
		<div
			v-if="lineSpacingMenu.open.value"
			class="z-50 flex flex-col w-28 pt-1"
			v-anchored-popup="{ anchor: lineSpacingMenu.root.value }"
		>
			<div :class="MENU_PANEL">
				<button
					v-for="opt in LINE_SPACING_OPTIONS"
					:key="opt.value"
					type="button"
					:class="MENU_ITEM"
					@click="handleLineSpacing(opt.value)"
				>
					{{ opt.label }}
				</button>
			</div>
		</div>
	</div>

	<!-- Text Direction -->
	<div :ref="textDirectionMenu.root" class="relative">
		<button
			type="button"
			:disabled="!props.canMut"
			:class="pill"
			:title="t('pptx.paragraph.textDirection')"
			@mousedown.prevent
			@click="textDirectionMenu.toggle()"
		>
			<RotateCw :class="ic" />
			<ChevronDown class="w-3 h-3" />
		</button>
		<div
			v-if="textDirectionMenu.open.value"
			class="z-50 flex flex-col w-36 pt-1"
			v-anchored-popup="{ anchor: textDirectionMenu.root.value }"
		>
			<div :class="MENU_PANEL">
				<button
					v-for="opt in TEXT_DIRECTION_OPTIONS"
					:key="opt.value"
					type="button"
					:class="MENU_ITEM"
					@click="handleTextDirection(opt.value)"
				>
					{{ t(opt.labelKey) }}
				</button>
			</div>
		</div>
	</div>

	<!-- Columns -->
	<div :ref="columnsMenu.root" class="relative">
		<button
			type="button"
			:disabled="!props.canMut"
			:class="pill"
			:title="t('pptx.table.columns')"
			@mousedown.prevent
			@click="columnsMenu.toggle()"
		>
			<Columns2 :class="ic" />
			<ChevronDown class="w-3 h-3" />
		</button>
		<div
			v-if="columnsMenu.open.value"
			class="z-50 flex flex-col w-32 pt-1"
			v-anchored-popup="{ anchor: columnsMenu.root.value }"
		>
			<div :class="MENU_PANEL">
				<button
					v-for="opt in COLUMN_OPTIONS"
					:key="opt.value"
					type="button"
					:class="MENU_ITEM"
					@click="handleColumns(opt.value)"
				>
					{{ t(opt.labelKey) }}
				</button>
			</div>
		</div>
	</div>
</template>
