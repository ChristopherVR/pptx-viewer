<script setup lang="ts">
/**
 * SnapLinesOverlay - transient red alignment lines shown while dragging with
 * View ▸ Snap to Shape on. Vue port of React's `SnapLinesOverlay`. Lines are in
 * authored slide pixels (`axis: 'x'` → vertical line at left=position) and live
 * inside the scaled {@link SlideStage} slot, so the parent transform handles zoom.
 */
const props = defineProps<{ snapLines: Array<{ axis: 'x' | 'y'; position: number }> }>();
</script>

<template>
	<div
		v-for="(line, i) in props.snapLines"
		:key="i"
		class="absolute bg-red-500 pointer-events-none z-50"
		:style="
			line.axis === 'x'
				? { left: `${line.position}px`, top: '0px', width: '1px', height: '100%' }
				: { left: '0px', top: `${line.position}px`, width: '100%', height: '1px' }
		"
	/>
</template>
