<script setup lang="ts">
import type { ContentPartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	buildContentPartStrokes,
	contentPartViewBox,
	getContentPartReplayStyles,
	INK_REPLAY_KEYFRAMES,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, watchEffect } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import { useSafeTranslate } from '../composables/useSafeTranslate';

/**
 * ContentPartRenderer: renders `p:contentPart` ink (InkML strokes bound through
 * `mc:AlternateContent`).
 *
 * Vue had NO contentPart branch at all: the element fell through to the
 * "unsupported" placeholder, and its own test asserted that as expected
 * behaviour. Real PowerPoint ink now reaches the decoder, so the placeholder
 * would have been what a user actually saw on any inked slide.
 *
 * The per-stroke view model (path vs pressure circles, colour, width, opacity)
 * is the shared `buildContentPartStrokes` decision function, identical in all
 * five bindings.
 */
const props = defineProps<{
	element: PptxElement;
	zIndex: number;
	presenting?: boolean;
}>();

const t = useSafeTranslate();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

const contentPart = computed<ContentPartPptxElement | undefined>(() =>
	props.element.type === 'contentPart' ? props.element : undefined,
);

const strokes = computed(() =>
	contentPart.value ? buildContentPartStrokes(contentPart.value) : [],
);

const viewBox = computed(() =>
	contentPart.value ? contentPartViewBox(contentPart.value) : '0 0 1 1',
);

const replayStyles = computed(() =>
	props.presenting && contentPart.value
		? getContentPartReplayStyles(contentPart.value.inkStrokes ?? [])
		: [],
);

watchEffect((onCleanup) => {
	if (!props.presenting || typeof document === 'undefined') {
		return;
	}
	const style = document.createElement('style');
	style.dataset.pptxInkReplay = props.element.id;
	style.textContent = INK_REPLAY_KEYFRAMES;
	document.head.appendChild(style);
	onCleanup(() => style.remove());
});

function replayStyle(index: number): CSSProperties | undefined {
	const replay = replayStyles.value[index];
	return replay
		? {
				animation: replay.animation,
				strokeDasharray: replay.strokeDasharray,
				strokeDashoffset: replay.strokeDashoffset,
				'--ink-path-length': String(replay.pathLength),
			}
		: undefined;
}
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-contentpart"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<svg
			v-if="strokes.length > 0"
			class="pptx-vue-contentpart-svg"
			:viewBox="viewBox"
			preserveAspectRatio="none"
		>
			<template v-for="(s, i) in strokes" :key="s.key">
				<g v-if="s.circles" :opacity="s.opacity">
					<circle
						v-for="(c, j) in s.circles"
						:key="`${s.key}-pc-${j}`"
						:cx="c.cx"
						:cy="c.cy"
						:r="c.r"
						:fill="s.color"
					/>
				</g>
				<path
					v-else
					:d="s.d"
					fill="none"
					:stroke="s.color"
					:stroke-width="s.width"
					:stroke-opacity="s.opacity"
					stroke-linecap="round"
					stroke-linejoin="round"
					vector-effect="non-scaling-stroke"
					:style="replayStyle(i)"
				/>
			</template>
		</svg>
		<div v-else class="pptx-vue-contentpart-fallback">
			<span class="pptx-vue-contentpart-fallback-label">{{
				t('pptx.ink.contentPartFallback')
			}}</span>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-contentpart-svg {
	width: 100%;
	height: 100%;
	pointer-events: none;
	display: block;
}

.pptx-vue-contentpart-fallback {
	width: 100%;
	height: 100%;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px dashed rgba(100, 116, 139, 0.6);
	border-radius: 4px;
	background: rgba(148, 163, 184, 0.08);
}

.pptx-vue-contentpart-fallback-label {
	font-size: 11px;
	font-family: system-ui, sans-serif;
	color: rgba(100, 116, 139, 0.9);
	text-transform: uppercase;
	letter-spacing: 0.08em;
}
</style>
