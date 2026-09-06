<script lang="ts">
	import type { TextSegment, TextStyle } from 'pptx-viewer-core';
	import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';
	import type { EnvelopeGlyphPlacement, EnvelopeSegmentInput } from 'pptx-viewer-shared';
	import {
		buildGlyphEnvelope,
		buildWarpPath,
		DEFAULT_FONT_FAMILY,
		groupIntoParagraphs,
		hasGlyphEnvelope,
		normalizeHexColor,
		shouldUseSvgWarp,
		substituteFieldText,
	} from 'pptx-viewer-shared';

	import { getFieldContextGetter } from '../state/field-context';
	import { styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex }: ElementRendererProps = $props();
	// Captured at init: `getContext` only resolves during component
	// initialisation, so the getter is invoked inside the `$derived` below.
	const getFieldContext = getFieldContextGetter();
	const textElement = $derived(hasTextProperties(element) ? element : undefined);
	const preset = $derived(textElement?.textStyle?.textWarpPreset);
	// Every classified preset renders along an SVG `<textPath>` baseline;
	// only `textNoShape` / `textPlain` / unknown presets render nothing here.
	// This used to additionally require `classifyTextWarp(preset) === 'path'`,
	// which routed inflate/deflate/can/slant/fade/cascade to a flat CSS
	// `transform` approximation instead - a cross-binding parity bug, since
	// React and Vanilla never had that extra gate and already rendered those
	// presets as true SVG textPath. See `WordArtText.vue` for the same fix.
	const usesPath = $derived(shouldUseSvgWarp(preset));
	// Warped WordArt bypasses `buildParagraphs`, so it substitutes field runs
	// itself via a per-segment transform; without this a slide-number field
	// inside WordArt would still render its authored "Slide #" placeholder.
	const paragraphs = $derived(
		textElement
			? groupIntoParagraphs(textElement, (segment) => {
					if (!segment.fieldType) {
						return segment;
					}
					const substituted = substituteFieldText(
						segment.text,
						segment.fieldType,
						getFieldContext?.(),
					);
					return substituted === segment.text ? segment : { ...segment, text: substituted };
				})
			: [],
	);
	const width = $derived(Math.max(element.width, 1));
	const height = $derived(Math.max(element.height, 1));
	const pathPrefix = $derived(`warp-${element.id.replace(/[^a-zA-Z0-9_-]/gu, '_')}`);
	const alignment = $derived.by(() => {
		switch (textElement?.textStyle?.align ?? 'center') {
			case 'center': return { offset: '50%', anchor: 'middle' as const };
			case 'right': return { offset: '100%', anchor: 'end' as const };
			default: return { offset: '0%', anchor: 'start' as const };
		}
	});

	function runStyle(segment: TextSegment): Record<string, string | number> {
		const style: TextStyle = segment.style ?? {};
		const inherited = textElement?.textStyle;
		const decorations = [style.underline || style.hyperlink ? 'underline' : '', style.strikethrough ? 'line-through' : ''].filter(Boolean);
		const family = style.fontFamily ?? inherited?.fontFamily;
		const result: Record<string, string | number> = {
			color: normalizeHexColor(style.color ?? inherited?.color, style.hyperlink ? '#0563C1' : '#111827'),
			fontSize: `${style.fontSize ?? inherited?.fontSize ?? 24}px`,
			fontWeight: style.bold || inherited?.bold ? 700 : 400,
			fontStyle: style.italic || inherited?.italic ? 'italic' : 'normal',
			fontFamily: family ? getSubstituteFontFamily(family) : DEFAULT_FONT_FAMILY,
		};
		if (decorations.length) {
			result.textDecoration = decorations.join(' ');
		}
		return result;
	}

	function pathFor(index: number): string {
		return buildWarpPath(preset!, width, height, index, paragraphs.length, textElement?.textStyle?.textWarpAdj, textElement?.textStyle?.textWarpAdj2);
	}

	// Envelope presets (inflate/deflate/can) get a true per-glyph height warp
	// instead of a shared-baseline `<textPath>`, so glyph HEIGHT varies between
	// the preset's top and bottom curves the way PowerPoint's own text warp
	// does. Every paragraph is eligible: paragraph `i` of `n` occupies the
	// `[i/n, (i+1)/n]` vertical slice of the envelope curve's local band (see
	// `buildGlyphEnvelope` in pptx-viewer-shared), so a multi-paragraph block
	// bends within the same overall envelope instead of falling back to the
	// shared-baseline `<textPath>` renderer below.
	const useGlyphEnvelope = $derived(paragraphs.length > 0 && hasGlyphEnvelope(preset ?? ''));

	function segmentFont(segment: TextSegment): EnvelopeSegmentInput['font'] {
		const s: TextStyle = segment.style ?? {};
		const inherited = textElement?.textStyle;
		const family = s.fontFamily ?? inherited?.fontFamily;
		return {
			fontFamily: family ? getSubstituteFontFamily(family) : DEFAULT_FONT_FAMILY,
			fontSizePx: s.fontSize ?? inherited?.fontSize ?? 24,
			bold: s.bold ?? inherited?.bold,
			italic: s.italic ?? inherited?.italic,
		};
	}

	/** One glyph plus its already-resolved inline style string (avoids a stale
	 *  cross-paragraph `segmentIndex` lookup at render time). */
	type StyledGlyph = EnvelopeGlyphPlacement & { styleStr: string };

	const glyphs = $derived.by<StyledGlyph[]>(() => {
		if (!useGlyphEnvelope) {
			return [];
		}
		const lineCount = paragraphs.length;
		return paragraphs.flatMap((paragraph, lineIndex) => {
			const segs: EnvelopeSegmentInput[] = paragraph.segments.map((seg, i) => ({
				text: seg.text,
				font: segmentFont(seg),
				segmentIndex: i,
			}));
			const placements = buildGlyphEnvelope(preset as string, segs, width, height, textElement?.textStyle?.align, textElement?.textStyle?.textWarpAdj, textElement?.textStyle?.textWarpAdj2, lineIndex, lineCount);
			return placements.map((p) => ({ ...p, styleStr: styleToString(runStyle(paragraph.segments[p.segmentIndex])) }));
		});
	});
</script>

{#if useGlyphEnvelope}
	<svg class="pptx-svelte-wordart" {width} {height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={`z-index:${zIndex}`}>
		{#each glyphs as g, gi (gi)}
			{#if !g.slices || g.slices.length <= 1}
				<!-- Ordinary glyph (no slices needed): a bare <text>, unchanged
				     from before per-glyph slicing existed. -->
				<text x={g.x} y={g.y} transform={g.transform} style={g.styleStr}>{g.char}</text>
			{:else}
				<!-- A very wide glyph on a strongly-curved envelope: rendered as
				     `slices.length` clipped copies, each with its own affine (see
				     `chooseGlyphSliceCount` in pptx-viewer-shared), so the pieces
				     tile across the glyph. Wrapped in a real <g> so it never
				     matches an "svg > text" selector the single-slice case does. -->
				<g data-glyph-slices={g.slices.length}>
					{#each g.slices as slice, si (si)}
						<clipPath id={`${pathPrefix}-g${gi}-s${si}`} clipPathUnits="userSpaceOnUse">
							<rect x={slice.clipX0} y={-100000} width={slice.clipX1 - slice.clipX0} height={200000} />
						</clipPath>
						<text x={g.x} y={g.y} transform={slice.transform} clip-path={`url(#${pathPrefix}-g${gi}-s${si})`} style={g.styleStr}>{g.char}</text>
					{/each}
				</g>
			{/if}
		{/each}
	</svg>
{:else if usesPath && paragraphs.length > 0}
	<svg class="pptx-svelte-wordart" {width} {height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={`z-index:${zIndex}`}>
		<defs>{#each paragraphs as _, i (i)}<path id={`${pathPrefix}-${i}`} d={pathFor(i)} fill="none" />{/each}</defs>
		{#each paragraphs as paragraph, pi (pi)}
			<text><textPath href={`#${pathPrefix}-${pi}`} startOffset={alignment.offset} text-anchor={alignment.anchor}>
				{#each paragraph.segments as segment, si (si)}<tspan style={styleToString(runStyle(segment))}>{segment.text}</tspan>{/each}
			</textPath></text>
		{/each}
	</svg>
{/if}

<style>
	.pptx-svelte-wordart { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
</style>
