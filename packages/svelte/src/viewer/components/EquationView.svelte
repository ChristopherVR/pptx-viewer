<script lang="ts">
	import { hasTextProperties } from 'pptx-viewer-core';
	import type { OmmlNode } from 'pptx-viewer-shared';
	import { convertOmmlToMathMl, sanitizeMathMl } from 'pptx-viewer-shared';

	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex, interactive = false }: ElementRendererProps = $props();
	const equations = $derived.by(() => {
		if (!hasTextProperties(element)) {
			return [];
		}
		return (element.textSegments ?? []).flatMap((segment, index) => {
			if (!segment.equationXml) {
				return [];
			}
			const markup = convertOmmlToMathMl(segment.equationXml as OmmlNode);
			return markup
				? [{ key: `${element.id}-eq-${index}`, markup: sanitizeMathMl(markup), number: segment.equationNumber }]
				: [];
		});
	});
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
</script>

<div class="pptx-svelte-element pptx-svelte-equation-wrapper" style={containerStyle} data-element-id={element.id} data-pptx-element={interactive ? 'true' : undefined}>
	{#each equations as equation (equation.key)}
		{#if equation.number}
			<span class="pptx-svelte-equation-numbered">
				<span class="pptx-svelte-equation-number-spacer" aria-hidden="true">({equation.number})</span>
				<span class="pptx-svelte-equation pptx-svelte-equation-centered">{@html equation.markup}</span>
				<span class="pptx-svelte-equation-number">({equation.number})</span>
			</span>
		{:else}
			<span class="pptx-svelte-equation">{@html equation.markup}</span>
		{/if}
	{/each}
</div>

<style>
	.pptx-svelte-equation-wrapper { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25em; }
	.pptx-svelte-equation { display: inline-block; vertical-align: middle; font-family: 'Cambria Math', 'STIX Two Math', serif; }
	.pptx-svelte-equation-numbered { display: flex; align-items: center; justify-content: space-between; width: 100%; }
	.pptx-svelte-equation-centered { flex: 1; text-align: center; }
	.pptx-svelte-equation-number-spacer { visibility: hidden; white-space: nowrap; }
	.pptx-svelte-equation-number { white-space: nowrap; font-family: 'Cambria Math', 'STIX Two Math', serif; }
</style>
