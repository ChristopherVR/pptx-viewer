<script setup lang="ts">
import {
	AArrowDown,
	AArrowUp,
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
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { gB, gL, grp, FMT, ATXT, pill, ic, SEP } from './ribbon-constants';
import type { TableCellEditorState } from './ribbon-types';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	tableEditorState?: TableCellEditorState | null;
	onUpdateTextStyle: (updates: Partial<TextStyle>) => void;
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

const FONT_COLOR_PRESETS = [
	'#000000',
	'#ffffff',
	'#ff0000',
	'#00aa00',
	'#0000ff',
	'#ff8800',
	'#8800cc',
	'#00cccc',
	'#ff69b4',
	'#808080',
];

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

const currentHighlight = computed(() =>
	isTextEl.value && props.selectedElement && hasTextProperties(props.selectedElement)
		? (props.selectedElement.textSegments?.[0]?.style?.highlightColor ??
			props.selectedElement.textStyle?.highlightColor ??
			'#ffff00')
		: '#ffff00',
);

const colorInputRef = ref<HTMLInputElement | null>(null);
const highlightInputRef = ref<HTMLInputElement | null>(null);

function handleColorChange(color: string): void {
	if (!canFormat.value) {
		return;
	}
	props.onUpdateTextStyle({ color });
}

function handleHighlightChange(highlightColor: string): void {
	if (!canFormat.value) {
		return;
	}
	props.onUpdateTextStyle({ highlightColor });
}

function handleFmtClick(t: string): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const ts = effectiveTs.value;
	switch (t) {
		case 'Bold':
			props.onUpdateTextStyle({ bold: !ts?.bold });
			break;
		case 'Italic':
			props.onUpdateTextStyle({ italic: !ts?.italic });
			break;
		case 'Underline':
			props.onUpdateTextStyle({ underline: !ts?.underline });
			break;
		case 'Strikethrough':
			props.onUpdateTextStyle({ strikethrough: !ts?.strikethrough });
			break;
	}
}

function handleIncreaseFontSize(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.fontSize ?? 18;
	props.onUpdateTextStyle({ fontSize: current + 2 });
}

function handleDecreaseFontSize(): void {
	if (!canFormat.value || !props.selectedElement) {
		return;
	}
	const current = effectiveTs.value?.fontSize ?? 18;
	props.onUpdateTextStyle({ fontSize: Math.max(1, current - 2) });
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

function handleAlignClick(t: string): void {
	if (!canFormat.value) {
		return;
	}
	const alignMap: Record<string, 'left' | 'center' | 'right' | 'justify'> = {
		'Align left': 'left',
		'Align center': 'center',
		'Align right': 'right',
		Justify: 'justify',
	};
	const align = alignMap[t];
	if (align) {
		props.onUpdateTextStyle({ align });
	}
}
</script>

<template>
	<!-- ── Font group ── -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<div :class="grp">
				<button
					v-for="(b, i) in FMT"
					:key="b.t"
					type="button"
					:disabled="!canMut"
					:class="i < FMT.length - 1 ? gB : gL"
					:title="b.t"
					@mousedown.prevent
					@click="handleFmtClick(b.t)"
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
			<div class="relative group">
				<button
					type="button"
					:disabled="!canMut"
					:class="pill"
					:title="t('pptx.text.fontColor')"
					@mousedown.prevent
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
					<div class="w-4 h-1 rounded-sm -mt-0.5" :style="{ backgroundColor: currentColor }" />
				</button>
				<div class="absolute left-0 top-full z-50 hidden group-hover:block pt-1">
					<div
						class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-36"
					>
						<div class="grid grid-cols-5 gap-1.5 mb-2">
							<button
								v-for="c in FONT_COLOR_PRESETS"
								:key="c"
								type="button"
								:class="[
									'w-5 h-5 rounded-full border transition-transform hover:scale-125',
									currentColor?.toLowerCase() === c
										? 'border-primary ring-1 ring-primary'
										: 'border-border',
								]"
								:style="{ backgroundColor: c }"
								@mousedown.prevent
								@click="handleColorChange(c)"
							/>
						</div>
						<button
							type="button"
							class="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
							@mousedown.prevent
							@click="colorInputRef?.click()"
						>
							{{ t('pptx.text.customColour') }}
						</button>
						<input
							ref="colorInputRef"
							type="color"
							class="sr-only"
							:value="currentColor"
							@change="handleColorChange(($event.target as HTMLInputElement).value)"
						/>
					</div>
				</div>
			</div>

			<!-- Text highlight colour -->
			<div class="relative group">
				<button
					type="button"
					:disabled="!canMut"
					:class="pill"
					:title="t('pptx.text.highlightColor')"
					@mousedown.prevent
				>
					<Highlighter :class="ic" />
					<div class="w-4 h-1 rounded-sm -mt-0.5" :style="{ backgroundColor: currentHighlight }" />
				</button>
				<div class="absolute left-0 top-full z-50 hidden group-hover:block pt-1">
					<div
						class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 w-36"
					>
						<div class="grid grid-cols-5 gap-1.5 mb-2">
							<button
								v-for="c in HIGHLIGHT_COLOR_PRESETS"
								:key="c"
								type="button"
								:class="[
									'w-5 h-5 rounded-full border transition-transform hover:scale-125',
									currentHighlight?.toLowerCase() === c
										? 'border-primary ring-1 ring-primary'
										: 'border-border',
								]"
								:style="{ backgroundColor: c }"
								@mousedown.prevent
								@click="handleHighlightChange(c)"
							/>
						</div>
						<button
							type="button"
							class="w-full text-[10px] text-muted-foreground hover:text-foreground py-1 transition-colors"
							@mousedown.prevent
							@click="highlightInputRef?.click()"
						>
							{{ t('pptx.text.customColour') }}
						</button>
						<input
							ref="highlightInputRef"
							type="color"
							class="sr-only"
							:value="currentHighlight"
							@change="handleHighlightChange(($event.target as HTMLInputElement).value)"
						/>
					</div>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{ t('pptx.text.font') }}</span>
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
					:key="b.t"
					type="button"
					:disabled="!canMut"
					:class="i < ATXT.length - 1 ? gB : gL"
					:title="b.t"
					@mousedown.prevent
					@click="handleAlignClick(b.t)"
				>
					<component :is="b.icon" :class="ic" />
				</button>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.text.paragraph')
		}}</span>
	</div>
</template>
