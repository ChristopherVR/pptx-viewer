<script setup lang="ts">
import type { SmartArtLayout } from 'pptx-viewer-core';
import { computed } from 'vue';

/**
 * SmartArtPreviews — a tiny SVG thumbnail for a SmartArt {@link SmartArtLayout}.
 *
 * Vue port of the React `SmartArtPreviews.tsx` `getPreviewForLayout` resolver.
 * Each layout maps to one of a handful of schematic glyphs (block list, chevron
 * process, cycle, radial, hierarchy, venn, or a generic fallback). Used by
 * `InsertSmartArtDialog.vue` to populate the gallery tiles.
 */
const props = defineProps<{
	/** The layout to draw a thumbnail for. */
	layout: SmartArtLayout;
}>();

const PREVIEW_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#eab308'];

/** Which schematic glyph to draw for the current layout. */
type PreviewKind =
	| 'blockList'
	| 'chevronProcess'
	| 'cycle'
	| 'radial'
	| 'hierarchy'
	| 'venn'
	| 'generic';

const kind = computed<PreviewKind>(() => {
	switch (props.layout) {
		case 'basicBlockList':
		case 'stackedList':
		case 'tableList':
		case 'horizontalBulletList':
			return 'blockList';
		case 'basicChevronProcess':
		case 'segmentedProcess':
		case 'continuousBlockProcess':
		case 'upwardArrow':
			return 'chevronProcess';
		case 'basicCycle':
		case 'basicPie':
			return 'cycle';
		case 'basicRadial':
		case 'convergingRadial':
			return 'radial';
		case 'hierarchy':
			return 'hierarchy';
		case 'basicVenn':
		case 'linearVenn':
			return 'venn';
		default:
			return 'generic';
	}
});

/** Pre-computed chevron polygon points (process glyph). */
const chevronPoints = computed(() =>
	[0, 1, 2].map((i) => {
		const x = 2 + i * 19;
		return {
			color: PREVIEW_COLORS[i],
			points: `${x},10 ${x + 14},10 ${x + 18},20 ${x + 14},30 ${x},30 ${i > 0 ? x + 4 : x},20`,
		};
	}),
);

/** Pre-computed cycle circle centres. */
const cycleCircles = computed(() =>
	[0, 1, 2, 3].map((i) => {
		const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
		return {
			color: PREVIEW_COLORS[i],
			cx: 30 + 13 * Math.cos(angle),
			cy: 20 + 10 * Math.sin(angle),
		};
	}),
);

/** Pre-computed radial spoke + node geometry. */
const radialSpokes = computed(() =>
	[0, 1, 2].map((i) => {
		const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
		return {
			color: PREVIEW_COLORS[i + 1],
			cx: 30 + 15 * Math.cos(angle),
			cy: 20 + 12 * Math.sin(angle),
		};
	}),
);

const blockRows = computed(() =>
	[0, 1, 2].map((i) => ({ color: PREVIEW_COLORS[i], y: 3 + i * 12 })),
);

const genericBars = computed(() =>
	[0, 1, 2].map((i) => ({ color: PREVIEW_COLORS[i], x: 4 + i * 18 })),
);
</script>

<template>
	<svg viewBox="0 0 60 40" class="pptx-vue-smartart-preview block h-full w-full" role="img">
		<!-- Block list -->
		<template v-if="kind === 'blockList'">
			<rect
				v-for="row in blockRows"
				:key="row.y"
				:x="4"
				:y="row.y"
				:width="52"
				:height="10"
				:rx="2"
				:fill="row.color"
				:opacity="0.85"
			/>
		</template>

		<!-- Chevron process -->
		<template v-else-if="kind === 'chevronProcess'">
			<polygon
				v-for="ch in chevronPoints"
				:key="ch.points"
				:points="ch.points"
				:fill="ch.color"
				:opacity="0.85"
			/>
		</template>

		<!-- Cycle -->
		<template v-else-if="kind === 'cycle'">
			<circle
				v-for="(c, i) in cycleCircles"
				:key="i"
				:cx="c.cx"
				:cy="c.cy"
				:r="6"
				:fill="c.color"
				:opacity="0.85"
			/>
		</template>

		<!-- Radial -->
		<template v-else-if="kind === 'radial'">
			<circle :cx="30" :cy="20" :r="7" :fill="PREVIEW_COLORS[0]" :opacity="0.85" />
			<template v-for="(s, i) in radialSpokes" :key="i">
				<line
					:x1="30"
					:y1="20"
					:x2="s.cx"
					:y2="s.cy"
					stroke="#94a3b8"
					:stroke-width="1"
					:opacity="0.5"
				/>
				<circle :cx="s.cx" :cy="s.cy" :r="5" :fill="s.color" :opacity="0.85" />
			</template>
		</template>

		<!-- Hierarchy -->
		<template v-else-if="kind === 'hierarchy'">
			<rect
				:x="20"
				:y="3"
				:width="20"
				:height="10"
				:rx="2"
				:fill="PREVIEW_COLORS[0]"
				:opacity="0.85"
			/>
			<line :x1="30" :y1="13" :x2="30" :y2="18" stroke="#94a3b8" :stroke-width="1" />
			<line :x1="15" :y1="18" :x2="45" :y2="18" stroke="#94a3b8" :stroke-width="1" />
			<rect
				:x="4"
				:y="20"
				:width="18"
				:height="10"
				:rx="2"
				:fill="PREVIEW_COLORS[1]"
				:opacity="0.85"
			/>
			<rect
				:x="38"
				:y="20"
				:width="18"
				:height="10"
				:rx="2"
				:fill="PREVIEW_COLORS[2]"
				:opacity="0.85"
			/>
			<line :x1="15" :y1="18" :x2="15" :y2="20" stroke="#94a3b8" :stroke-width="1" />
			<line :x1="45" :y1="18" :x2="45" :y2="20" stroke="#94a3b8" :stroke-width="1" />
		</template>

		<!-- Venn -->
		<template v-else-if="kind === 'venn'">
			<circle :cx="22" :cy="20" :r="14" :fill="PREVIEW_COLORS[0]" :opacity="0.3" />
			<circle :cx="38" :cy="20" :r="14" :fill="PREVIEW_COLORS[1]" :opacity="0.3" />
			<circle :cx="30" :cy="10" :r="14" :fill="PREVIEW_COLORS[2]" :opacity="0.3" />
		</template>

		<!-- Generic fallback -->
		<template v-else>
			<rect
				v-for="bar in genericBars"
				:key="bar.x"
				:x="bar.x"
				:y="8"
				:width="16"
				:height="24"
				:rx="3"
				:fill="bar.color"
				:opacity="0.85"
			/>
		</template>
	</svg>
</template>
