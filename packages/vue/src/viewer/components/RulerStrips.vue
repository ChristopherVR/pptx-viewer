<script setup lang="ts">
/**
 * RulerStrips - horizontal + vertical rulers (View ▸ Rulers), drawn along the
 * top and left edges of the slide. Tick positions come from the pure
 * `generateTicks` helper (scaled px from the slide origin), so they track the
 * zoom. Positioned absolutely inside `SlideCanvas`'s slide wrapper, so they sit
 * just outside the slide and scale with it. Vue port of React's `Ruler` /
 * `RulerStrips`.
 */
import { computed } from 'vue';

import { generateTicks, RULER_FONT_SIZE, RULER_THICKNESS } from '../composables/ruler-utils';
import type { RulerUnit } from '../composables/ruler-utils';
import type { CanvasSize } from '../types';

const props = withDefaults(
	defineProps<{ canvasSize: CanvasSize; scale: number; unit?: RulerUnit }>(),
	{ unit: 'inches' },
);

const stripW = computed(() => props.canvasSize.width * props.scale);
const stripH = computed(() => props.canvasSize.height * props.scale);
const hTicks = computed(() => generateTicks(props.canvasSize.width, props.scale, props.unit));
const vTicks = computed(() => generateTicks(props.canvasSize.height, props.scale, props.unit));
const T = RULER_THICKNESS;
const FS = RULER_FONT_SIZE;
</script>

<template>
	<!-- Corner -->
	<div
		class="absolute bg-secondary border-r border-b border-border"
		:style="{ top: `-${T}px`, left: `-${T}px`, width: `${T}px`, height: `${T}px` }"
		aria-hidden="true"
	/>
	<!-- Horizontal ruler -->
	<svg
		class="absolute bg-secondary border-b border-border pointer-events-none text-muted-foreground"
		:style="{ top: `-${T}px`, left: '0px' }"
		:width="stripW"
		:height="T"
		aria-hidden="true"
	>
		<template v-for="(t, i) in hTicks" :key="i">
			<line
				:x1="t.position"
				:x2="t.position"
				:y1="t.isMajor ? T - 8 : T - 4"
				:y2="T"
				stroke="currentColor"
				stroke-width="0.5"
			/>
			<text v-if="t.label" :x="t.position + 2" :y="FS" :font-size="FS" fill="currentColor">
				{{ t.label }}
			</text>
		</template>
	</svg>
	<!-- Vertical ruler -->
	<svg
		class="absolute bg-secondary border-r border-border pointer-events-none text-muted-foreground"
		:style="{ top: '0px', left: `-${T}px` }"
		:width="T"
		:height="stripH"
		aria-hidden="true"
	>
		<template v-for="(t, i) in vTicks" :key="i">
			<line
				:y1="t.position"
				:y2="t.position"
				:x1="t.isMajor ? T - 8 : T - 4"
				:x2="T"
				stroke="currentColor"
				stroke-width="0.5"
			/>
			<text
				v-if="t.label"
				:x="FS"
				:y="t.position + 2"
				:font-size="FS"
				fill="currentColor"
				:transform="`rotate(-90, ${FS}, ${t.position + 2})`"
			>
				{{ t.label }}
			</text>
		</template>
	</svg>
</template>
