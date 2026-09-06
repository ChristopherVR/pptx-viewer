import type { PptxElementWithText, TextSegment, TextStyle } from 'pptx-viewer-core';
import { getSubstituteFontFamily } from 'pptx-viewer-core';
import type {
	EnvelopeGlyphPlacement,
	EnvelopeSegmentInput,
	WarpParagraph,
} from 'pptx-viewer-shared';
import { buildGlyphEnvelope, hasGlyphEnvelope } from 'pptx-viewer-shared';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';

/** One warped line's glyph placements plus the segments to resolve their style from. */
export interface EnvelopeGlyphLine {
	lineIndex: number;
	glyphs: EnvelopeGlyphPlacement[];
	segments: TextSegment[];
}

/**
 * Two-curve WordArt envelope (inflate/deflate/can) glyph placement for the
 * Vue `WordArtText` component. Split out of the SFC (a `<script setup>` with
 * its own interfaces/computations is the extraction smell this repo flags)
 * so the component stays a thin template + wiring layer.
 *
 * Envelope presets render one `<text>` per glyph instead of a shared
 * `<textPath>` baseline, so glyph HEIGHT varies between the preset's top and
 * bottom curves the way PowerPoint's own text warp does. Every paragraph is
 * eligible: paragraph `i` of `n` occupies the `[i/n, (i+1)/n]` vertical slice
 * of the envelope curve's local band (see `buildGlyphEnvelope` in
 * pptx-viewer-shared), so a multi-paragraph block bends within the same
 * overall envelope instead of falling back to a shared-baseline `<textPath>`.
 */
export function useTextWarpEnvelope(options: {
	textEl: ComputedRef<PptxElementWithText | null>;
	preset: ComputedRef<string | undefined>;
	paragraphs: ComputedRef<WarpParagraph[]>;
	width: ComputedRef<number>;
	height: ComputedRef<number>;
	warpAdj: ComputedRef<number | undefined>;
	warpAdj2: ComputedRef<number | undefined>;
	defaultFontFamily: string;
	defaultFontSize: number;
}): {
	useGlyphEnvelope: ComputedRef<boolean>;
	glyphLines: ComputedRef<EnvelopeGlyphLine[]>;
} {
	const {
		textEl,
		preset,
		paragraphs,
		width,
		height,
		warpAdj,
		warpAdj2,
		defaultFontFamily,
		defaultFontSize,
	} = options;

	const useGlyphEnvelope = computed(
		() => paragraphs.value.length > 0 && hasGlyphEnvelope(preset.value ?? ''),
	);

	function segmentFont(segment: TextSegment): EnvelopeSegmentInput['font'] {
		const s: TextStyle = segment.style ?? {};
		const elStyle = textEl.value?.textStyle;
		const family = s.fontFamily ?? elStyle?.fontFamily;
		return {
			fontFamily: family ? getSubstituteFontFamily(family) : defaultFontFamily,
			fontSizePx: s.fontSize ?? elStyle?.fontSize ?? defaultFontSize,
			bold: s.bold ?? elStyle?.bold,
			italic: s.italic ?? elStyle?.italic,
		};
	}

	const glyphLines = computed<EnvelopeGlyphLine[]>(() => {
		if (!useGlyphEnvelope.value) {
			return [];
		}
		const lineCount = paragraphs.value.length;
		return paragraphs.value.map((paragraph, lineIndex) => {
			const segs: EnvelopeSegmentInput[] = paragraph.segments.map((seg, i) => ({
				text: seg.text,
				font: segmentFont(seg),
				segmentIndex: i,
			}));
			const glyphs = buildGlyphEnvelope(
				preset.value as string,
				segs,
				width.value,
				height.value,
				textEl.value?.textStyle?.align,
				warpAdj.value,
				warpAdj2.value,
				lineIndex,
				lineCount,
			);
			return { lineIndex, glyphs, segments: paragraph.segments };
		});
	});

	return { useGlyphEnvelope, glyphLines };
}
