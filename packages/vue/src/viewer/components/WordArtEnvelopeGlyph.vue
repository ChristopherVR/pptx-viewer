<script setup lang="ts">
import type { EnvelopeGlyphPlacement } from 'pptx-viewer-shared';

/**
 * One glyph of the true two-curve WordArt envelope renderer (see
 * `WordArtText.vue`), split out to keep that SFC's template thin.
 *
 * Most glyphs have no `slices` (a single affine already fits them within
 * tolerance): renders a bare `<text transform>`, unchanged from before
 * per-glyph slicing existed, so an ordinary caption pays no extra cost. A
 * glyph on a strongly-curved envelope wide enough to need it (see
 * `chooseGlyphSliceCount` in `pptx-viewer-shared`) instead renders
 * `slices.length` copies of the SAME glyph, each clipped to its own x-band
 * and carrying its own affine, so the pieces tile across the glyph the way
 * PowerPoint's per-point outline warp would. Wrapped in a real `<g>` so a
 * sliced glyph never matches an `svg > text` selector the single-slice case
 * (a bare `<text>` direct `<svg>` child) still does.
 */
interface TspanProps {
	fill: string;
	fontSize: number;
	fontWeight: number;
	fontStyle: 'italic' | 'normal';
	fontFamily: string;
	textDecoration?: string;
}

const props = defineProps<{
	glyph: EnvelopeGlyphPlacement;
	tspan: TspanProps;
	/** Deterministic id prefix for this glyph's clip-paths (unique per element/line/glyph). */
	clipIdPrefix: string;
}>();

function clipId(sliceIndex: number): string {
	return `${props.clipIdPrefix}-s${sliceIndex}`;
}
</script>

<template>
	<text
		v-if="!glyph.slices || glyph.slices.length <= 1"
		:x="glyph.x"
		:y="glyph.y"
		:transform="glyph.transform"
		:fill="tspan.fill"
		:font-size="tspan.fontSize"
		:font-weight="tspan.fontWeight"
		:font-style="tspan.fontStyle"
		:font-family="tspan.fontFamily"
		:text-decoration="tspan.textDecoration"
	>
		{{ glyph.char }}
	</text>
	<g v-else :data-glyph-slices="glyph.slices.length">
		<clipPath
			v-for="(slice, si) in glyph.slices"
			:key="`clip-${si}`"
			:id="clipId(si)"
			clipPathUnits="userSpaceOnUse"
		>
			<rect
				:x="slice.clipX0"
				y="-100000"
				:width="Math.max(0, slice.clipX1 - slice.clipX0)"
				height="200000"
			/>
		</clipPath>
		<text
			v-for="(slice, si) in glyph.slices"
			:key="`txt-${si}`"
			:x="glyph.x"
			:y="glyph.y"
			:transform="slice.transform"
			:clip-path="`url(#${clipId(si)})`"
			:fill="tspan.fill"
			:font-size="tspan.fontSize"
			:font-weight="tspan.fontWeight"
			:font-style="tspan.fontStyle"
			:font-family="tspan.fontFamily"
			:text-decoration="tspan.textDecoration"
		>
			{{ glyph.char }}
		</text>
	</g>
</template>
