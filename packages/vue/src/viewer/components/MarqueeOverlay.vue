<script setup lang="ts">
/**
 * MarqueeOverlay: the rubber-band rectangle drawn while dragging across empty
 * canvas. Rendered inside the scaled stage, so its geometry is raw slide-space
 * and must not be multiplied by the zoom.
 */
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import type { MarqueeRect } from '../composables/useMarqueeSelection';

const props = defineProps<{ rect: MarqueeRect | null }>();

const style = computed<CSSProperties>(() => ({
	left: `${props.rect?.x ?? 0}px`,
	top: `${props.rect?.y ?? 0}px`,
	width: `${props.rect?.width ?? 0}px`,
	height: `${props.rect?.height ?? 0}px`,
}));
</script>

<template>
	<div
		v-if="rect"
		class="pptx-vue-marquee pointer-events-none absolute z-50 border border-primary bg-primary/10"
		aria-hidden="true"
		:style="style"
	/>
</template>
