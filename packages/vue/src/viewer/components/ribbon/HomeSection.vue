<script setup lang="ts">
import { ChevronDown, ClipboardPaste, Copy, Paintbrush, Plus, Scissors } from 'lucide-vue-next';
/**
 * HomeSection: the Vue 3 port of React's
 * `toolbar/HomeSection.tsx`. Renders the Home ribbon tab's Clipboard, Slides and
 * Font groups (Paste/Cut/Copy/Format Painter, New Slide + layout picker, and the
 * font-family / font-size dropdowns). A faithful, mechanical port for visual +
 * behavioral parity: class strings are copied verbatim, React's
 * `useState`/`useEffect(mousedown)` dropdown plumbing becomes `useDropdown`, and
 * the copied/cut feedback flashes use a `ref` + `setTimeout`.
 */
import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { computed, ref } from 'vue';

import { cn } from '../../../utils';
import {
	COMMON_FONTS,
	COMMON_SIZES,
	gB,
	gL,
	grp,
	ic,
	MENU_ITEM,
	MENU_PANEL,
	pill,
	SEP,
} from './ribbon-constants';
import type { ElementClipboardPayload, LayoutOption } from './ribbon-types';
import { useDropdown } from './use-dropdown';

interface Props {
	canEdit: boolean;
	clipboardPayload: ElementClipboardPayload | null;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
	layoutOptions: LayoutOption[];
	onInsertSlideFromLayout: (path: string, name?: string) => void;
	selectedElement?: PptxElement | null;
	onUpdateTextStyle?: (style: Partial<TextStyle>) => void;
}

const props = defineProps<Props>();

function extractFontInfo(element?: PptxElement | null): { fontFamily: string; fontSize: string } {
	const defaults = { fontFamily: 'Segoe UI', fontSize: '24' };
	if (!element) {
		return defaults;
	}
	if (!hasTextProperties(element)) {
		return defaults;
	}

	const segStyle = element.textSegments?.[0]?.style;
	const textStyle = element.textStyle;

	const fontFamily = segStyle?.fontFamily ?? textStyle?.fontFamily ?? defaults.fontFamily;
	const fontSize = segStyle?.fontSize ?? textStyle?.fontSize;

	return {
		fontFamily,
		fontSize: fontSize !== undefined && fontSize !== null ? String(fontSize) : defaults.fontSize,
	};
}

const fontInfo = computed(() => extractFontInfo(props.selectedElement));
const fontFamily = computed(() => fontInfo.value.fontFamily);
const fontSize = computed(() => fontInfo.value.fontSize);

const layoutMenu = useDropdown();
const fontMenu = useDropdown();
const sizeMenu = useDropdown();

const copiedFeedback = ref(false);
const cutFeedback = ref(false);

function handleNewSlide(): void {
	if (props.layoutOptions.length > 0) {
		const first = props.layoutOptions[0];
		props.onInsertSlideFromLayout(first.path, first.name);
	}
}

function handleCut(): void {
	props.onCut();
	cutFeedback.value = true;
	setTimeout(() => {
		cutFeedback.value = false;
	}, 600);
}

function handleCopy(): void {
	props.onCopy();
	copiedFeedback.value = true;
	setTimeout(() => {
		copiedFeedback.value = false;
	}, 600);
}

function handlePickLayout(lo: LayoutOption): void {
	props.onInsertSlideFromLayout(lo.path, lo.name);
	layoutMenu.close();
}

function handlePickFont(f: string): void {
	props.onUpdateTextStyle?.({ fontFamily: f });
	fontMenu.close();
}

function handlePickSize(s: number): void {
	props.onUpdateTextStyle?.({ fontSize: s });
	sizeMenu.close();
}
</script>

<template>
	<!-- Clipboard group -->
	<div class="flex flex-col items-center gap-0.5">
		<div :class="grp">
			<button
				type="button"
				:disabled="!props.clipboardPayload || !props.canEdit"
				:class="gB"
				title="Paste"
				@click="props.onPaste()"
			>
				<ClipboardPaste :class="ic" />
			</button>
			<button
				type="button"
				:disabled="!props.canEdit"
				:class="cn(gB, cutFeedback && 'bg-green-600/20 text-green-400')"
				title="Cut"
				@click="handleCut()"
			>
				<Scissors :class="ic" />
			</button>
			<button
				type="button"
				:class="cn(gB, copiedFeedback && 'bg-green-600/20 text-green-400')"
				title="Copy"
				@click="handleCopy()"
			>
				<Copy :class="ic" />
			</button>
			<button
				v-if="props.onToggleFormatPainter"
				type="button"
				:disabled="
					!props.canEdit || (props.canActivateFormatPainter === false && !props.formatPainterActive)
				"
				data-testid="format-painter-toggle"
				:data-active="props.formatPainterActive ? 'true' : 'false'"
				:class="
					cn(gL, props.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')
				"
				title="Format Painter"
				@click="props.onToggleFormatPainter()"
			>
				<Paintbrush :class="ic" />
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Clipboard</span>
	</div>

	<div :class="SEP" />

	<!-- Slides group -->
	<div class="flex flex-col items-center gap-0.5">
		<div :ref="layoutMenu.root" class="relative inline-flex items-center">
			<button
				type="button"
				:disabled="!props.canEdit || props.layoutOptions.length === 0"
				:class="
					cn(pill, 'whitespace-nowrap', props.layoutOptions.length > 0 ? 'rounded-r-none' : '')
				"
				title="New Slide"
				@click="handleNewSlide()"
			>
				<Plus :class="ic" />
				New Slide
			</button>
			<button
				v-if="props.layoutOptions.length > 0"
				type="button"
				:disabled="!props.canEdit"
				class="inline-flex items-center justify-center self-stretch px-1 rounded-r bg-muted hover:bg-accent text-xs transition-colors border-l border-border/40 active:scale-95 active:opacity-80"
				title="Choose layout"
				@click="layoutMenu.toggle()"
			>
				<ChevronDown class="w-3 h-3" />
			</button>
			<div
				v-if="layoutMenu.open.value"
				class="absolute left-0 top-full z-50 flex flex-col w-48 pt-1"
			>
				<div :class="MENU_PANEL">
					<button
						v-for="lo in props.layoutOptions"
						:key="lo.path"
						type="button"
						:class="MENU_ITEM"
						@click="handlePickLayout(lo)"
					>
						{{ lo.name }}
					</button>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Slides</span>
	</div>

	<div :class="SEP" />

	<!-- Font group -->
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<div :ref="fontMenu.root" class="relative">
				<button
					type="button"
					class="inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[120px] truncate hover:bg-accent/40 transition-colors cursor-pointer"
					@click="fontMenu.toggle()"
				>
					<span class="truncate">{{ fontFamily }}</span>
					<ChevronDown class="w-3 h-3 ml-1 shrink-0 text-muted-foreground" />
				</button>
				<div
					v-if="fontMenu.open.value"
					class="absolute left-0 top-full z-50 flex flex-col w-48 pt-1"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="f in COMMON_FONTS"
							:key="f"
							type="button"
							:class="MENU_ITEM"
							:style="{ fontFamily: f }"
							@click="handlePickFont(f)"
						>
							{{ f }}
						</button>
					</div>
				</div>
			</div>
			<div :ref="sizeMenu.root" class="relative">
				<button
					type="button"
					class="inline-flex items-center justify-between px-2 py-1 rounded-sm border border-border/60 bg-background/60 text-[11px] text-foreground min-w-[50px] text-center hover:bg-accent/40 transition-colors cursor-pointer"
					@click="sizeMenu.toggle()"
				>
					<span class="truncate">{{ fontSize }}</span>
					<ChevronDown class="w-3 h-3 ml-1 shrink-0 text-muted-foreground" />
				</button>
				<div
					v-if="sizeMenu.open.value"
					class="absolute left-0 top-full z-50 flex flex-col w-48 pt-1"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="s in COMMON_SIZES"
							:key="s"
							type="button"
							:class="MENU_ITEM"
							@click="handlePickSize(s)"
						>
							{{ s }}
						</button>
					</div>
				</div>
			</div>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Font</span>
	</div>

	<div :class="SEP" />
</template>
