<script lang="ts">
	import { hasShapeProperties } from 'pptx-viewer-core';
	import { getDuotoneSvgFilter } from 'pptx-viewer-shared';

	import type { ElementRendererProps } from './props';

	const { element }: ElementRendererProps = $props();
	const duotone = $derived(
		hasShapeProperties(element) && element.shapeStyle?.dagDuotone
			? getDuotoneSvgFilter(element.shapeStyle, element.id)
			: undefined,
	);
</script>

{#if duotone}
	<svg width="0" height="0" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
		<defs>{@html duotone.filterMarkup}</defs>
	</svg>
{/if}
