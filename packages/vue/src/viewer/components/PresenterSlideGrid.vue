<script setup lang="ts">
import type { PptxSlide } from 'pptx-viewer-core';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

defineProps<{
	slides: PptxSlide[];
	current: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
}>();
const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'close'): void }>();
</script>
<template>
	<div class="slide-grid">
		<header>
			<div>
				<small>Slide navigator</small>
				<h2>See all slides</h2>
			</div>
			<button @click="emit('close')">Close</button>
		</header>
		<main>
			<button
				v-for="(slide, index) in slides"
				:key="slide.id ?? index"
				:class="{ current: index === current, hidden: slide.hidden }"
				@click="emit('select', index)"
			>
				<div
					:style="{ width: '200px', height: `${canvasSize.height * (200 / canvasSize.width)}px` }"
				>
					<SlideStage
						:slide="slide"
						:canvas-size="canvasSize"
						:media-data-urls="mediaDataUrls"
						:scale="200 / canvasSize.width"
					/>
				</div>
				<span>{{ index + 1 }}{{ slide.hidden ? ' - hidden' : '' }}</span>
			</button>
		</main>
	</div>
</template>
<style scoped>
.slide-grid {
	position: absolute;
	inset: 0;
	z-index: 120;
	display: flex;
	flex-direction: column;
	background: #020617f9;
	color: #f8fafc;
}
.slide-grid header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 18px 24px;
	border-bottom: 1px solid #ffffff1a;
}
.slide-grid h2 {
	margin: 2px 0 0;
}
.slide-grid small {
	color: #7dd3fc;
	text-transform: uppercase;
	letter-spacing: 0.18em;
}
.slide-grid button {
	border: 0;
	border-radius: 6px;
	background: #ffffff12;
	color: inherit;
	padding: 9px;
	cursor: pointer;
}
.slide-grid main {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	gap: 20px;
	padding: 24px;
	overflow: auto;
}
.slide-grid main button {
	text-align: left;
}
.slide-grid main .current {
	outline: 2px solid #38bdf8;
}
.slide-grid main .hidden {
	opacity: 0.45;
}
.slide-grid main span {
	display: block;
	margin-top: 8px;
	color: #94a3b8;
}
</style>
