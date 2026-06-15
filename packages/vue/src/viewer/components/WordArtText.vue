<script setup lang="ts">
import type { PptxElement, PptxElementWithText, TextSegment, TextStyle } from 'pptx-viewer-core';
import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';
import { computed } from 'vue';

import { buildWarpPath, shouldUseSvgWarp } from '../composables/text-warp';

/**
 * WordArtText — Vue port of the React `WarpedText` SVG renderer.
 *
 * Renders warped (WordArt) text along SVG `<textPath>` baselines for the
 * `prstTxWarp` presets that {@link shouldUseSvgWarp} accepts (arch, arched
 * up/down, wave, circle, triangle, chevron, inflate/deflate, slant, fade,
 * pour, …). Each paragraph becomes one baseline `<path>` + `<text>` pair, and
 * per-run styling (colour, bold/italic, underline, hyperlink) is emitted as
 * `<tspan>` attributes.
 *
 * Presets that are not in the SVG allowlist (`textNoShape`, `textPlain`,
 * unknown values) cause the component to render nothing — callers fall back to
 * flat text. The SVG is absolutely positioned to fill the host box and is
 * `pointer-events: none` so it overlays without intercepting interaction.
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
}>();

// ── Inlined scalar defaults (kept self-contained; mirrors React constants) ──
const DEFAULT_TEXT_COLOR = '#111827';
const DEFAULT_FONT_FAMILY = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const DEFAULT_TEXT_FONT_SIZE = 24;
const HYPERLINK_COLOR = '#0563C1';

/** Normalise a colour to a 6-digit `#rrggbb` hex, or return the fallback. */
function normalizeHexColor(value: string | undefined, fallback: string): string {
	if (!value || value === 'transparent') {
		return fallback;
	}
	const candidate = value.startsWith('#') ? value : `#${value}`;
	return /^#[0-9A-Fa-f]{6}$/u.test(candidate) ? candidate : fallback;
}

interface WarpParagraph {
	segments: TextSegment[];
}

/** Group an element's text segments into paragraphs delimited by breaks. */
function groupIntoParagraphs(element: PptxElementWithText): WarpParagraph[] {
	const segments = element.textSegments;
	if (!segments || segments.length === 0) {
		return element.text ? [{ segments: [{ text: element.text, style: {} }] }] : [];
	}
	const paragraphs: WarpParagraph[] = [];
	let current: TextSegment[] = [];
	for (const seg of segments) {
		if (seg.isParagraphBreak) {
			if (current.length > 0) {
				paragraphs.push({ segments: current });
			}
			current = [];
		} else if (seg.text) {
			current.push(seg);
		}
	}
	if (current.length > 0) {
		paragraphs.push({ segments: current });
	}
	return paragraphs;
}

const textEl = computed<PptxElementWithText | null>(() =>
	hasTextProperties(props.element) ? props.element : null,
);

const preset = computed(() => textEl.value?.textStyle?.textWarpPreset);

/** Whether this component should render anything for the current element. */
const active = computed(() => Boolean(textEl.value) && shouldUseSvgWarp(preset.value));

const width = computed(() => Math.max(props.element.width, 1));
const height = computed(() => Math.max(props.element.height, 1));

const paragraphs = computed<WarpParagraph[]>(() =>
	textEl.value ? groupIntoParagraphs(textEl.value) : [],
);

const pathIdPrefix = computed(() => `warp-${props.element.id.replace(/[^a-zA-Z0-9_-]/gu, '_')}`);

const warpAdj = computed(() => textEl.value?.textStyle?.textWarpAdj);
const warpAdj2 = computed(() => textEl.value?.textStyle?.textWarpAdj2);

/** Map paragraph alignment to SVG textPath offset + anchor. */
const alignment = computed<{ startOffset: string; textAnchor: 'start' | 'middle' | 'end' }>(() => {
	switch (textEl.value?.textStyle?.align ?? 'center') {
		case 'center':
			return { startOffset: '50%', textAnchor: 'middle' };
		case 'right':
			return { startOffset: '100%', textAnchor: 'end' };
		default:
			return { startOffset: '0%', textAnchor: 'start' };
	}
});

const baseFontSize = computed(() => textEl.value?.textStyle?.fontSize ?? DEFAULT_TEXT_FONT_SIZE);
const baseFontFamily = computed(() =>
	textEl.value?.textStyle?.fontFamily
		? getSubstituteFontFamily(textEl.value.textStyle.fontFamily)
		: DEFAULT_FONT_FAMILY,
);
const baseFill = computed(() =>
	normalizeHexColor(textEl.value?.textStyle?.color, DEFAULT_TEXT_COLOR),
);
const baseFontWeight = computed(() => (textEl.value?.textStyle?.bold ? 700 : 400));
const baseFontStyle = computed(() => (textEl.value?.textStyle?.italic ? 'italic' : 'normal'));

interface TspanProps {
	fill: string;
	fontSize: number;
	fontWeight: number;
	fontStyle: 'italic' | 'normal';
	fontFamily: string;
	textDecoration?: string;
}

/** Resolve per-segment `<tspan>` attributes from a run's style. */
function tspanProps(segment: TextSegment): TspanProps {
	const s: TextStyle = segment.style ?? {};
	const decos: string[] = [];
	if (s.underline || s.hyperlink) {
		decos.push('underline');
	}
	if (s.strikethrough) {
		decos.push('line-through');
	}
	const elStyle = textEl.value?.textStyle;
	const fill = s.hyperlink
		? normalizeHexColor(s.color ?? elStyle?.color, HYPERLINK_COLOR)
		: normalizeHexColor(s.color ?? elStyle?.color, DEFAULT_TEXT_COLOR);
	const family = s.fontFamily ?? elStyle?.fontFamily;
	return {
		fill,
		fontSize: s.fontSize ?? elStyle?.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
		fontWeight: s.bold ? 700 : 400,
		fontStyle: s.italic ? 'italic' : 'normal',
		fontFamily: family ? getSubstituteFontFamily(family) : DEFAULT_FONT_FAMILY,
		textDecoration: decos.length > 0 ? decos.join(' ') : undefined,
	};
}

/** Path `d` for the baseline of paragraph `i`. */
function pathFor(i: number): string {
	return buildWarpPath(
		preset.value as NonNullable<typeof preset.value>,
		width.value,
		height.value,
		i,
		paragraphs.value.length,
		warpAdj.value,
		warpAdj2.value,
	);
}
</script>

<template>
	<svg
		v-if="active && paragraphs.length > 0"
		class="pptx-vue-wordart"
		:width="width"
		:height="height"
		:viewBox="`0 0 ${width} ${height}`"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
		:style="{ zIndex }"
	>
		<defs>
			<path
				v-for="(_para, i) in paragraphs"
				:id="`${pathIdPrefix}-${i}`"
				:key="`def-${i}`"
				:d="pathFor(i)"
				fill="none"
			/>
		</defs>
		<text
			v-for="(para, pi) in paragraphs"
			:key="`txt-${pi}`"
			:font-size="baseFontSize"
			:font-family="baseFontFamily"
			:fill="baseFill"
			:font-weight="baseFontWeight"
			:font-style="baseFontStyle"
		>
			<textPath
				:href="`#${pathIdPrefix}-${pi}`"
				:startOffset="alignment.startOffset"
				:text-anchor="alignment.textAnchor"
			>
				<tspan
					v-for="(seg, si) in para.segments"
					:key="`ts-${pi}-${si}`"
					:fill="tspanProps(seg).fill"
					:font-size="tspanProps(seg).fontSize"
					:font-weight="tspanProps(seg).fontWeight"
					:font-style="tspanProps(seg).fontStyle"
					:font-family="tspanProps(seg).fontFamily"
					:text-decoration="tspanProps(seg).textDecoration"
				>
					{{ seg.text }}
				</tspan>
			</textPath>
		</text>
	</svg>
</template>

<style scoped>
.pptx-vue-wordart {
	position: absolute;
	inset: 0;
	overflow: visible;
	pointer-events: none;
}
</style>
