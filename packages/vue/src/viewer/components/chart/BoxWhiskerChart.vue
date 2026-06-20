<script setup lang="ts">
import type { PptxChartData } from 'pptx-viewer-core';
import type { PlotLayout, ValueRange } from 'pptx-viewer-shared';
import { paletteColor, valueToY } from 'pptx-viewer-shared';
import { computed } from 'vue';

/**
 * BoxWhiskerChart: Vue port of React `chart-bar.tsx` box-whisker variant.
 * Rendered inside the parent chart `<svg>` (emits a `<g>` group).
 * Cross-series values per category form the whisker statistics.
 */
const props = defineProps<{
	chartData: PptxChartData;
	layout: PlotLayout;
	range: ValueRange;
	categories: ReadonlyArray<string>;
}>();

const styleId = computed(() => props.chartData.style?.styleId);
const colorPalette = computed(() => props.chartData.colorPalette);

interface BoxDraw {
	/** whisker top line */
	wTop: { x1: number; y1: number; x2: number; y2: number };
	/** whisker bottom line */
	wBottom: { x1: number; y1: number; x2: number; y2: number };
	/** cap top */
	capTop: { x1: number; y1: number; x2: number; y2: number };
	/** cap bottom */
	capBottom: { x1: number; y1: number; x2: number; y2: number };
	/** box rect */
	box: { x: number; y: number; width: number; height: number; fill: string };
	/** median line */
	median: { x1: number; y1: number; x2: number; y2: number };
}

const boxes = computed<BoxDraw[]>(() => {
	const l = props.layout;
	const range = props.range;
	const catCount = Math.max(props.categories.length, 1);
	const boxGroupW = l.plotWidth / catCount;
	const boxW = boxGroupW * 0.5;
	const boxOffset = (boxGroupW - boxW) / 2;
	const out: BoxDraw[] = [];

	for (let ci = 0; ci < catCount; ci++) {
		const catVals = props.chartData.series.map((s) => s.values[ci] ?? 0).sort((a, b) => a - b);

		if (catVals.length < 2) {
			continue;
		}

		const minV = catVals[0];
		const maxV = catVals[catVals.length - 1];
		const q1 = catVals[Math.floor(catVals.length * 0.25)];
		const q3 = catVals[Math.floor(catVals.length * 0.75)];
		const median = catVals[Math.floor(catVals.length * 0.5)];

		const x = l.plotLeft + boxGroupW * ci + boxOffset;
		const xMid = x + boxW / 2;

		const yMin = valueToY(minV, range, l.plotTop, l.plotBottom);
		const yMax = valueToY(maxV, range, l.plotTop, l.plotBottom);
		const yQ1 = valueToY(q1, range, l.plotTop, l.plotBottom);
		const yQ3 = valueToY(q3, range, l.plotTop, l.plotBottom);
		const yMed = valueToY(median, range, l.plotTop, l.plotBottom);

		out.push({
			wTop: { x1: xMid, y1: yMax, x2: xMid, y2: yQ3 },
			wBottom: { x1: xMid, y1: yQ1, x2: xMid, y2: yMin },
			capTop: { x1: x + boxW * 0.25, y1: yMax, x2: x + boxW * 0.75, y2: yMax },
			capBottom: { x1: x + boxW * 0.25, y1: yMin, x2: x + boxW * 0.75, y2: yMin },
			box: {
				x,
				y: Math.min(yQ1, yQ3),
				width: boxW,
				height: Math.abs(yQ1 - yQ3),
				fill: paletteColor(ci, styleId.value, colorPalette.value),
			},
			median: { x1: x, y1: yMed, x2: x + boxW, y2: yMed },
		});
	}
	return out;
});
</script>

<template>
	<g class="pptx-vue-boxwhisker-chart">
		<template v-for="(b, i) in boxes" :key="`bw-${i}`">
			<!-- Whisker lines -->
			<line
				:x1="b.wTop.x1"
				:y1="b.wTop.y1"
				:x2="b.wTop.x2"
				:y2="b.wTop.y2"
				stroke="#64748b"
				stroke-width="1"
			/>
			<line
				:x1="b.wBottom.x1"
				:y1="b.wBottom.y1"
				:x2="b.wBottom.x2"
				:y2="b.wBottom.y2"
				stroke="#64748b"
				stroke-width="1"
			/>
			<!-- Caps -->
			<line
				:x1="b.capTop.x1"
				:y1="b.capTop.y1"
				:x2="b.capTop.x2"
				:y2="b.capTop.y2"
				stroke="#64748b"
				stroke-width="1"
			/>
			<line
				:x1="b.capBottom.x1"
				:y1="b.capBottom.y1"
				:x2="b.capBottom.x2"
				:y2="b.capBottom.y2"
				stroke="#64748b"
				stroke-width="1"
			/>
			<!-- IQR box -->
			<rect
				:x="b.box.x"
				:y="b.box.y"
				:width="b.box.width"
				:height="b.box.height"
				:fill="b.box.fill"
				stroke="#334155"
				stroke-width="1"
				opacity="0.8"
				rx="1"
			/>
			<!-- Median line -->
			<line
				:x1="b.median.x1"
				:y1="b.median.y1"
				:x2="b.median.x2"
				:y2="b.median.y2"
				stroke="#1e293b"
				stroke-width="2"
			/>
		</template>
	</g>
</template>
