<script lang="ts">
	import type { TextSegment, TextStyle } from 'pptx-viewer-core';
	import { getSubstituteFontFamily, hasTextProperties } from 'pptx-viewer-core';
	import {
		buildWarpPath,
		classifyTextWarp,
		getWarpCssTransform,
		groupIntoParagraphs,
		normalizeHexColor,
		shouldUseSvgWarp,
	} from 'pptx-viewer-shared';

	import { styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex }: ElementRendererProps = $props();
	const textElement = $derived(hasTextProperties(element) ? element : undefined);
	const preset = $derived(textElement?.textStyle?.textWarpPreset);
	const category = $derived(classifyTextWarp(preset));
	const usesPath = $derived(category === 'path' && shouldUseSvgWarp(preset));
	const usesCss = $derived(category === 'envelope' || category === 'simple');
	const paragraphs = $derived(textElement ? groupIntoParagraphs(textElement) : []);
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
			fontFamily: family ? getSubstituteFontFamily(family) : '"Segoe UI", Arial, sans-serif',
		};
		if (decorations.length) {
			result.textDecoration = decorations.join(' ');
		}
		return result;
	}

	function pathFor(index: number): string {
		return buildWarpPath(preset!, width, height, index, paragraphs.length, textElement?.textStyle?.textWarpAdj, textElement?.textStyle?.textWarpAdj2);
	}

	const cssTransform = $derived(getWarpCssTransform(preset, textElement?.textStyle?.textWarpAdj, textElement?.textStyle?.textWarpAdj2));
	const cssStyle = $derived(styleToString({
		...(cssTransform ? { transform: cssTransform.transform, transformOrigin: cssTransform.transformOrigin } : {}),
		zIndex,
	}));
</script>

{#if usesPath && paragraphs.length > 0}
	<svg class="pptx-svelte-wordart" {width} {height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" style={`z-index:${zIndex}`}>
		<defs>{#each paragraphs as _, i (i)}<path id={`${pathPrefix}-${i}`} d={pathFor(i)} fill="none" />{/each}</defs>
		{#each paragraphs as paragraph, pi (pi)}
			<text><textPath href={`#${pathPrefix}-${pi}`} startOffset={alignment.offset} text-anchor={alignment.anchor}>
				{#each paragraph.segments as segment, si (si)}<tspan style={styleToString(runStyle(segment))}>{segment.text}</tspan>{/each}
			</textPath></text>
		{/each}
	</svg>
{:else if usesCss && paragraphs.length > 0}
	<div class="pptx-svelte-wordart pptx-svelte-wordart-css" style={cssStyle} aria-hidden="true">
		{#each paragraphs as paragraph, pi (pi)}
			<div class="pptx-svelte-wordart-line" style={`text-align:${alignment.anchor === 'middle' ? 'center' : alignment.anchor}`}>
				{#each paragraph.segments as segment, si (si)}<span style={styleToString(runStyle(segment))}>{segment.text}</span>{/each}
			</div>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-wordart { position: absolute; inset: 0; overflow: visible; pointer-events: none; }
	.pptx-svelte-wordart-css { display: flex; flex-direction: column; align-items: center; justify-content: center; white-space: pre-wrap; will-change: transform; }
	.pptx-svelte-wordart-line { width: 100%; }
</style>
