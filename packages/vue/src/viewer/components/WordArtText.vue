<script setup lang="ts">
import type { PptxElement, PptxElementWithText, TextSegment, TextStyle } from 'pptx-viewer-core';
import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';
import {
	buildWarpPath,
	classifyTextWarp,
	getWarpCssTransform,
	groupIntoParagraphs,
	normalizeHexColor,
	shouldUseSvgWarp,
} from 'pptx-viewer-shared';
import type { WarpParagraph } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

/**
 * WordArtText - Vue port of the React `WarpedText` SVG renderer.
 *
 * Renders warped (WordArt) text. The strategy depends on the preset's
 * {@link classifyTextWarp} category, mirroring React:
 *  - `path` (arch, wave, circle, triangle, chevron, curve, ring, …): each
 *    paragraph becomes one SVG baseline `<path>` + `<text>` pair, with per-run
 *    styling (colour, bold/italic, underline, hyperlink) emitted as `<tspan>`
 *    attributes.
 *  - `envelope` (inflate/deflate/can) and `simple` (slant/fade/cascade): SVG
 *    `<textPath>` cannot bend individual glyphs, so the text is laid out flat
 *    and a CSS `transform` (+ `transform-origin`) from {@link getWarpCssTransform}
 *    approximates the warp, the same approach React uses.
 *
 * Presets that are not classified (`textNoShape`, `textPlain`, unknown values)
 * cause the component to render nothing; callers fall back to flat text. The
 * overlay is absolutely positioned to fill the host box and is
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

// Paragraph splitting now uses the shared pure helper
// (pptx-viewer-shared render/text-warp `groupIntoParagraphs`), shared with the
// React + Angular warp renderers.

const textEl = computed<PptxElementWithText | null>(() =>
	hasTextProperties(props.element) ? props.element : null,
);

const preset = computed(() => textEl.value?.textStyle?.textWarpPreset);

/** Rendering-strategy category for the current preset. */
const category = computed(() => classifyTextWarp(preset.value));

/**
 * `path` presets render along an SVG `<textPath>` baseline. `envelope`/`simple`
 * presets are excluded here even though they also pass {@link shouldUseSvgWarp}:
 * they use the CSS-transform branch instead, matching React.
 */
const usesTextPath = computed(
	() => Boolean(textEl.value) && category.value === 'path' && shouldUseSvgWarp(preset.value),
);

/**
 * `envelope`/`simple` presets render flat text with a CSS-transform
 * approximation (perspective/rotate/skew/scale) instead of a textPath.
 */
const usesCssTransform = computed(
	() => Boolean(textEl.value) && (category.value === 'envelope' || category.value === 'simple'),
);

/** Whether this component should render anything for the current element. */
const active = computed(() => usesTextPath.value || usesCssTransform.value);

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

/**
 * CSS-transform style for `envelope`/`simple` presets: the warp `transform`
 * plus its `transform-origin`, applied to the flat-text overlay. `undefined`
 * for `path`/`none` presets.
 */
const warpTransformStyle = computed<CSSProperties | undefined>(() => {
	const warp = getWarpCssTransform(preset.value, warpAdj.value, warpAdj2.value);
	if (!warp) {
		return undefined;
	}
	return { transform: warp.transform, transformOrigin: warp.transformOrigin };
});

/** Inline style for a flat-text run (mirrors {@link tspanProps} as CSS). */
function runStyle(segment: TextSegment): CSSProperties {
	const p = tspanProps(segment);
	return {
		color: p.fill,
		fontSize: `${p.fontSize}px`,
		fontWeight: p.fontWeight,
		fontStyle: p.fontStyle,
		fontFamily: p.fontFamily,
		textDecoration: p.textDecoration,
	};
}
</script>

<template>
	<svg
		v-if="usesTextPath && paragraphs.length > 0"
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

	<div
		v-else-if="usesCssTransform && paragraphs.length > 0"
		class="pptx-vue-wordart pptx-vue-wordart-css"
		:style="{ ...warpTransformStyle, zIndex }"
		aria-hidden="true"
	>
		<div
			v-for="(para, pi) in paragraphs"
			:key="`css-line-${pi}`"
			class="pptx-vue-wordart-line"
			:style="{ textAlign: alignment.textAnchor === 'middle' ? 'center' : alignment.textAnchor }"
		>
			<span v-for="(seg, si) in para.segments" :key="`css-run-${pi}-${si}`" :style="runStyle(seg)">
				{{ seg.text }}
			</span>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-wordart {
	position: absolute;
	inset: 0;
	overflow: visible;
	pointer-events: none;
}

.pptx-vue-wordart-css {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	white-space: pre-wrap;
	will-change: transform;
}

.pptx-vue-wordart-line {
	width: 100%;
}
</style>
