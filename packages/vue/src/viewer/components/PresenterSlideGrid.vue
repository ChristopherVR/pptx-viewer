<script setup lang="ts">
/**
 * PresenterSlideGrid - the presenter console's "See All Slides" navigator.
 *
 * Its headings were hard-coded English (`Slide navigator`, `See all slides`,
 * `Close`), so the overlay stayed English in every locale; they now resolve
 * through the shared {@link PRESENTER_NAVIGATOR_LABEL_KEYS}. The overlay's
 * geometry comes from the shared Tailwind tokens so the navigator is the same
 * size and stacking order in every binding (it sat at three different z-indexes
 * before they were shared).
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { PRESENTER_CONSOLE_CLASSES, PRESENTER_NAVIGATOR_LABEL_KEYS } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import type { CanvasSize } from '../types';
import SlideStage from './SlideStage.vue';

defineProps<{
	slides: PptxSlide[];
	current: number;
	canvasSize: CanvasSize;
	mediaDataUrls: Map<string, string>;
}>();
const emit = defineEmits<{ (e: 'select', index: number): void; (e: 'close'): void }>();

const { t } = useI18n();
const navigatorKeys = PRESENTER_NAVIGATOR_LABEL_KEYS;
const classes = PRESENTER_CONSOLE_CLASSES;
</script>
<template>
	<div class="slide-grid" :class="classes.navigator" data-pptx-presenter-navigator>
		<header>
			<div>
				<small>{{ t(navigatorKeys.title) }}</small>
				<h2>{{ t(navigatorKeys.subtitle) }}</h2>
			</div>
			<button type="button" data-pptx-presenter-control="close-navigator" @click="emit('close')">
				{{ t(navigatorKeys.close) }}
			</button>
		</header>
		<main :class="classes.navigatorGrid">
			<button
				v-for="(slide, index) in slides"
				:key="slide.id ?? index"
				type="button"
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
/* Position, stacking and grid geometry come from the shared Tailwind tokens on
   the elements above; only the navigator's own chrome is styled here. */
.slide-grid {
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
