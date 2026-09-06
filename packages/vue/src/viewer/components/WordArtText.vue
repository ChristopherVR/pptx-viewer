<script setup lang="ts">
import type { PptxElement, PptxElementWithText, TextSegment, TextStyle } from 'pptx-viewer-core';
import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';
import {
	buildWarpPath,
	DEFAULT_FONT_FAMILY,
	groupIntoParagraphs,
	normalizeHexColor,
	shouldUseSvgWarp,
	substituteFieldText,
} from 'pptx-viewer-shared';
import type { EnvelopeGlyphPlacement, WarpParagraph } from 'pptx-viewer-shared';
import { computed } from 'vue';

import { injectFieldContext, resolveFieldContext } from '../composables/field-context';
import { useTextWarpEnvelope } from '../composables/useTextWarpEnvelope';
import WordArtEnvelopeGlyph from './WordArtEnvelopeGlyph.vue';

/**
 * WordArtText - Vue port of the React `WarpedText` SVG renderer.
 *
 * Renders warped (WordArt) text. Every classified preset (`textNoShape` /
 * `textPlain` / unknown excluded) renders along an SVG `<textPath>` baseline
 * built by {@link shouldUseSvgWarp} + `buildWarpPath`: arch/wave/circle/
 * triangle/chevron/ring/curve, and (as of the WordArt envelope fidelity fix)
 * inflate/deflate/can/slant/fade/cascade too, matching React and Vanilla.
 *
 * This used to branch on `classifyTextWarp(preset)` and fall back to a flat
 * `<div>` + CSS `transform` approximation for the `envelope`/`simple`
 * categories; that branch was dead code once `shouldUseSvgWarp` is used
 * directly (it already returns `true` for every classified preset), and
 * because React/Vanilla never had that branch, Vue rendered inflate/deflate/
 * can/slant/fade/cascade as a flat CSS-transform approximation while React
 * and Vanilla already rendered them as true SVG textPath - a cross-binding
 * parity bug this component no longer has.
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
// DEFAULT_FONT_FAMILY comes from pptx-viewer-shared so every binding's WordArt
// fallback font is the same string (see the shared `constants.ts` doc comment).
const DEFAULT_TEXT_COLOR = '#111827';
const DEFAULT_TEXT_FONT_SIZE = 24;
const HYPERLINK_COLOR = '#0563C1';

// Paragraph splitting now uses the shared pure helper
// (pptx-viewer-shared render/text-warp `groupIntoParagraphs`), shared with the
// React + Angular warp renderers.

const textEl = computed<PptxElementWithText | null>(() =>
	hasTextProperties(props.element) ? props.element : null,
);

const preset = computed(() => textEl.value?.textStyle?.textWarpPreset);

/**
 * Every classified preset renders along an SVG `<textPath>` baseline; only
 * `textNoShape` / `textPlain` / unknown presets fall through to flat text
 * (handled by the caller, not this component). Matches React and Vanilla.
 */
const usesTextPath = computed(() => Boolean(textEl.value) && shouldUseSvgWarp(preset.value));

const width = computed(() => Math.max(props.element.width, 1));
const height = computed(() => Math.max(props.element.height, 1));

/** OOXML field-substitution context (slide number, date/time, etc.), provided by the viewer root. */
const fieldContextSource = injectFieldContext();

const paragraphs = computed<WarpParagraph[]>(() => {
	const el = textEl.value;
	if (!el) {
		return [];
	}
	// Mirror React's warp-text-renderer: substitute field-run text via a
	// per-segment transform so warped WordArt resolves slide number / date /
	// footer fields identically to flat text.
	const ctx = resolveFieldContext(fieldContextSource);
	return groupIntoParagraphs(el, (seg) => {
		if (seg.fieldType) {
			const substituted = substituteFieldText(seg.text, seg.fieldType, ctx);
			if (substituted !== seg.text) {
				return { ...seg, text: substituted };
			}
		}
		return seg;
	});
});

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

const { useGlyphEnvelope, glyphLines } = useTextWarpEnvelope({
	textEl,
	preset,
	paragraphs,
	width,
	height,
	warpAdj,
	warpAdj2,
	defaultFontFamily: DEFAULT_FONT_FAMILY,
	defaultFontSize: DEFAULT_TEXT_FONT_SIZE,
});

/** Per-glyph `<text>` style attributes, from the segment it belongs to. */
function glyphProps(glyph: EnvelopeGlyphPlacement, segments: TextSegment[]): TspanProps {
	return tspanProps(segments[glyph.segmentIndex]);
}

/**
 * Deterministic clip-id prefix for one glyph's slices, unique across every
 * WordArt element on the page: `element.id` + line + glyph index. Sanitised
 * the same way `pathIdPrefix` already is, since an SVG `id` cannot contain
 * arbitrary characters a PPTX shape id might.
 */
function glyphClipIdPrefix(lineIndex: number, glyphIndex: number): string {
	return `${pathIdPrefix.value}-l${lineIndex}-g${glyphIndex}`;
}
</script>

<template>
	<svg
		v-if="useGlyphEnvelope"
		class="pptx-vue-wordart"
		:width="width"
		:height="height"
		:viewBox="`0 0 ${width} ${height}`"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
		:style="{ zIndex }"
	>
		<template v-for="line in glyphLines" :key="`line-${line.lineIndex}`">
			<WordArtEnvelopeGlyph
				v-for="(g, gi) in line.glyphs"
				:key="`g-${line.lineIndex}-${gi}`"
				:glyph="g"
				:tspan="glyphProps(g, line.segments)"
				:clip-id-prefix="glyphClipIdPrefix(line.lineIndex, gi)"
			/>
		</template>
	</svg>
	<svg
		v-else-if="usesTextPath && paragraphs.length > 0"
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
