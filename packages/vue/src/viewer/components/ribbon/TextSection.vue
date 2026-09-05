<script setup lang="ts">
import {
	AArrowDown,
	AArrowUp,
	ChevronDown,
	Highlighter,
	IndentDecrease,
	IndentIncrease,
	List,
	ListOrdered,
	RemoveFormatting,
} from 'lucide-vue-next';
/**
 * Text ribbon section: the Vue port of React's `toolbar/TextSection.tsx`.
 *
 * Mirrors the React `TextSection` for visual + behavioral parity: character
 * formatting toggles (B/I/U/strikethrough), font-size step/clear, font-colour
 * and highlight-colour pickers (preset swatches + native colour input), list
 * style, indent, and paragraph alignment. Tailwind class strings are copied
 * verbatim; the active text style is derived from the selected element (or the
 * focused table cell) exactly as React does so re-clicking a toggle turns it off.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, PptxThemeColorRef, TextStyle } from 'pptx-viewer-core';
import type { ChangeCaseMode } from 'pptx-viewer-shared';
import { OFFICE_COLOR_SWATCH_HEXES, textFontSizePtToPx } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { vAnchoredPopup } from './anchored-popup';
import ParagraphDropdowns from './ParagraphDropdowns.vue';
import { gB, gL, grp, FMT, ATXT, pill, ic, SEP, MENU_PANEL, MENU_ITEM } from './ribbon-constants';
import type { TableCellEditorState } from './ribbon-types';
import TextColorPopover from './TextColorPopover.vue';
import { useDropdown } from './use-dropdown';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
	onTransformTextCase: (mode: ChangeCaseMode) => void;
}

const props = defineProps<Props>();

const { t } = useI18n();

/**
 * Returns the text style currently in effect for toolbar toggles:
 * - For text/shape/connector elements, the element's own `textStyle`.
 * - For tables with a focused cell, that cell's style (a superset of the
 *   relevant `TextStyle` fields like `bold`/`italic`/`underline`/`fontSize`).
 * - `undefined` otherwise.
 *
 * Without this lookup, table-cell toggles always read `undefined` (since
 * `hasTextProperties` is false for tables) and `!undefined === true`, so
 * re-clicking Bold/Italic/Underline never turns the formatting off.
 */
function getEffectiveTextStyle(
	element: PptxElement | null,
	tableEditorState: TableCellEditorState | null | undefined,
): Partial<TextStyle> | undefined {
	if (!element) {
		return undefined;
	}
	if (hasTextProperties(element)) {
		return element.textStyle;
	}
	if (element.type === 'table' && tableEditorState && element.tableData) {
		const cell =
			element.tableData.rows[tableEditorState.rowIndex]?.cells[tableEditorState.columnIndex];
		return cell?.style as Partial<TextStyle> | undefined;
	}
	return undefined;
}

const FONT_COLOR_PRESETS = OFFICE_COLOR_SWATCH_HEXES;

const HIGHLIGHT_COLOR_PRESETS = [
	'#ffff00',
	'#00ff00',
	'#00ffff',
	'#ff00ff',
	'#0000ff',
	'#ff0000',
	'#000080',
	'#008080',
	'#008000',
	'#800080',
];

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

function handleBulletList(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	props.onUpdateTextStyle({
		listType: effectiveTs.value?.listType === 'bullet' ? 'none' : 'bullet',
	});
}

function handleNumberedList(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	props.onUpdateTextStyle({
		listType: effectiveTs.value?.listType === 'numbered' ? 'none' : 'numbered',
	});
}

function handleDecreaseIndent(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.paragraphMarginLeft ?? 0;
	props.onUpdateTextStyle({ paragraphMarginLeft: Math.max(0, current - 24) });
}

function handleIncreaseIndent(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.paragraphMarginLeft ?? 0;
	props.onUpdateTextStyle({ paragraphMarginLeft: current + 24 });
}

function handleAlignClick(id: string): void {
	if (!canFormat.value) {
		return;
	}
	if (id === 'left' || id === 'center' || id === 'right' || id === 'justify') {
		props.onUpdateTextStyle({ align: id });
	}
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

/* ── Character Spacing ── */
const CHAR_SPACING_OPTIONS = [
	{ labelKey: 'pptx.text.characterSpacingVeryTight', value: -300 },
	{ labelKey: 'pptx.text.characterSpacingTight', value: -150 },
	{ labelKey: 'pptx.view.normal', value: 0 },
	{ labelKey: 'pptx.text.characterSpacingLoose', value: 150 },
	{ labelKey: 'pptx.text.characterSpacingVeryLoose', value: 300 },
];

const charSpacingMenu = useDropdown();

function handleCharSpacing(value: number): void {
	if (!canFormat.value) {
		return;
	}
	props.onUpdateTextStyle({ characterSpacing: value });
	charSpacingMenu.close();
}

/* ── Change Case ── */
const CHANGE_CASE_OPTIONS = [
	{ label: 'pptx.text.changeCaseSentence', value: 'sentence' },
	{ label: 'pptx.text.changeCaseLower', value: 'lower' },
	{ label: 'pptx.text.changeCaseUpper', value: 'upper' },
	{ label: 'pptx.text.changeCaseCapitalize', value: 'capitalize' },
	{ label: 'pptx.text.changeCaseToggle', value: 'toggle' },
];

const changeCaseMenu = useDropdown();

function handleChangeCase(value: string): void {
	if (!canFormat.value) {
		return;
	}
	if (isTable.value) {
		// Table-cell text is plain (no textSegments to rewrite); fall back to
		// the visual all-caps render hint.
		props.onUpdateTextStyle({ textCaps: value === 'upper' ? 'all' : 'none' });
	} else {
		props.onTransformTextCase(value as ChangeCaseMode);
	}
	changeCaseMenu.close();
}
</script>

<template>
	<!-- ── Font group ── -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<div :class="grp">
				<button
					v-for="(b, i) in FMT"
					:key="b.id"
					type="button"
					:disabled="!canMut"
					:class="i < FMT.length - 1 ? gB : gL"
					:title="t(b.labelKey)"
					@mousedown.prevent
					@click="handleFmtClick(b.id)"
				>
					<component :is="b.icon" :class="ic" />
				</button>
			</div>

			<!-- Font size increase / decrease / clear formatting -->
			<div :class="grp">
				<button
					type="button"
					:disabled="!canMut"
					:class="gB"
					:title="t('pptx.text.increaseFontSize')"
					@mousedown.prevent
					@click="handleIncreaseFontSize"
				>
					<AArrowUp :class="ic" />
				</button>
				<button
					type="button"
					:disabled="!canMut"
					:class="gB"
					:title="t('pptx.text.decreaseFontSize')"
					@mousedown.prevent
					@click="handleDecreaseFontSize"
				>
					<AArrowDown :class="ic" />
				</button>
				<button
					type="button"
					:disabled="!canMut"
					:class="gL"
					:title="t('pptx.text.clearFormatting')"
					@mousedown.prevent
					@click="handleClearFormatting"
				>
					<RemoveFormatting :class="ic" />
				</button>
			</div>

			<!-- Font colour -->
			<TextColorPopover
				:current="currentColor"
				:current-ref="currentColorThemeRef"
				:show-theme-colors="true"
				:presets="FONT_COLOR_PRESETS"
				:disabled="!canMut"
				title-key="pptx.text.fontColor"
				@pick="handleColorChange"
			>
				<svg
					:class="ic"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M6 20h12M9.5 4h5L18 16H6L9.5 4z" />
				</svg>
			</TextColorPopover>

			<!-- Text highlight colour -->
			<TextColorPopover
				:current="currentHighlight"
				:presets="HIGHLIGHT_COLOR_PRESETS"
				:disabled="!canMut"
				title-key="pptx.text.highlightColor"
				@pick="handleHighlightChange"
			>
				<Highlighter :class="ic" />
			</TextColorPopover>

			<!-- Text Shadow toggle -->
			<button
				type="button"
				:disabled="!canMut"
				:class="[pill, effectiveTs?.textShadowColor ? 'bg-primary/20 ring-1 ring-primary' : '']"
				:title="t('pptx.textEffects.shadow')"
				:aria-label="t('pptx.textEffects.shadow')"
				@mousedown.prevent
				@click="handleToggleTextShadow"
			>
				<svg :class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<text x="5" y="16" font-size="14" font-weight="bold" stroke="none" fill="currentColor">
						S
					</text>
					<text
						x="7"
						y="18"
						font-size="14"
						font-weight="bold"
						stroke="none"
						fill="currentColor"
						opacity="0.3"
					>
						S
					</text>
				</svg>
			</button>

			<!-- Character Spacing dropdown -->
			<div :ref="charSpacingMenu.root" class="relative">
				<button
					type="button"
					:disabled="!canMut"
					:class="pill"
					:title="t('pptx.text.characterSpacing')"
					@mousedown.prevent
					@click="charSpacingMenu.toggle()"
				>
					<svg :class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
					</svg>
					<ChevronDown class="w-3 h-3" />
				</button>
				<div
					v-if="charSpacingMenu.open.value"
					class="z-50 flex flex-col w-36 pt-1"
					v-anchored-popup="{ anchor: charSpacingMenu.root.value }"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="opt in CHAR_SPACING_OPTIONS"
							:key="opt.value"
							type="button"
							:class="MENU_ITEM"
							@click="handleCharSpacing(opt.value)"
						>
							{{ t(opt.labelKey) }}
						</button>
					</div>
				</div>
			</div>

			<!-- Change Case (Aa) dropdown -->
			<div :ref="changeCaseMenu.root" class="relative">
				<button
					type="button"
					:disabled="!canMut"
					:class="pill"
					:title="t('pptx.text.changeCase')"
					:aria-label="t('pptx.text.changeCase')"
					@mousedown.prevent
					@click="changeCaseMenu.toggle()"
				>
					<svg :class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<text x="2" y="16" font-size="13" font-weight="bold" fill="currentColor" stroke="none">
							Aa
						</text>
					</svg>
					<ChevronDown class="w-3 h-3" />
				</button>
				<div
					v-if="changeCaseMenu.open.value"
					class="z-50 flex flex-col w-44 pt-1"
					v-anchored-popup="{ anchor: changeCaseMenu.root.value }"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="opt in CHANGE_CASE_OPTIONS"
							:key="opt.value"
							type="button"
							:class="MENU_ITEM"
							@click="handleChangeCase(opt.value)"
						>
							{{ t(opt.label) }}
						</button>
					</div>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{ t('pptx.ribbon.font') }}</span>
	</div>

	<div :class="SEP" />

	<!-- ── Paragraph group ── -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<!-- List style -->
			<div :class="grp">
				<button
					type="button"
					:disabled="!canMut"
					:class="gB"
					:title="t('pptx.text.bulletList')"
					@mousedown.prevent
					@click="handleBulletList"
				>
					<List :class="ic" />
				</button>
				<button
					type="button"
					:disabled="!canMut"
					:class="gL"
					:title="t('pptx.text.numberedList')"
					@mousedown.prevent
					@click="handleNumberedList"
				>
					<ListOrdered :class="ic" />
				</button>
			</div>

			<!-- Indent decrease / increase -->
			<div :class="grp">
				<button
					type="button"
					:disabled="!canMut"
					:class="gB"
					:title="t('pptx.text.decreaseIndent')"
					@mousedown.prevent
					@click="handleDecreaseIndent"
				>
					<IndentDecrease :class="ic" />
				</button>
				<button
					type="button"
					:disabled="!canMut"
					:class="gL"
					:title="t('pptx.text.increaseIndent')"
					@mousedown.prevent
					@click="handleIncreaseIndent"
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
