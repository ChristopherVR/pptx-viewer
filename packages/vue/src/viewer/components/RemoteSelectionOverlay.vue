<script lang="ts">
/**
 * RemoteSelectionOverlay - presentational overlay that draws a coloured
 * rectangle around each element a remote collaborator has selected, labelled
 * with that peer's name in their colour (Google-Slides-style presence).
 *
 * Like {@link CollaborationCursors}, this component owns no Yjs/network logic.
 * The integrator supplies the reactive list of {@link RemotePresence} entries
 * (from the collaboration composable), the elements on the active slide, the
 * active slide index, and the current `zoom`. Only peers whose `activeSlide`
 * matches `activeSlideIndex` are drawn, and only for selected ids that resolve
 * to an element on the slide.
 *
 * Element `x`/`y`/`width`/`height` are *unscaled* slide coordinates (px); this
 * component multiplies by `zoom` so it can be mounted inside the scaled
 * slide-stage host while receiving raw slide-space geometry.
 *
 * The overlay sets `pointer-events: none` so it never intercepts canvas input.
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { RemotePresence } from '../composables/useCollaboration';

/** A single resolved remote selection box, in unscaled slide coordinates. */
export interface RemoteSelectionBox {
	/** Stable key (peer clientId + element id). */
	key: string;
	/** Peer display name shown in the label chip. */
	userName: string;
	/** Outline + chip colour. */
	color: string;
	/** Unscaled slide-space geometry of the selected element. */
	x: number;
	y: number;
	width: number;
	height: number;
}
</script>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

const props = defineProps<{
	/** Remote collaborators' presence (cursor + selection + active slide). */
	presences: RemotePresence[];
	/** Elements on the active slide (used to resolve selected ids → geometry). */
	elements: PptxElement[];
	/** The current slide index: only peers on this slide are drawn. */
	activeSlideIndex: number;
	/** Current canvas zoom factor; geometry scales by this. */
	zoom: number;
}>();

/** Build a quick id → element lookup for the active slide. */
const elementMap = computed(() => {
	const map = new Map<string, PptxElement>();
	for (const el of props.elements) {
		map.set(el.id, el);
	}
	return map;
});

/** Resolve every remote peer's selection on this slide into drawable boxes. */
const boxes = computed<RemoteSelectionBox[]>(() => {
	const result: RemoteSelectionBox[] = [];
	for (const peer of props.presences) {
		if (peer.activeSlide !== props.activeSlideIndex) {
			continue;
		}
		for (const id of peer.selectionIds) {
			const el = elementMap.value.get(id);
			if (!el) {
				continue;
			}
			result.push({
				key: `${peer.clientId}-${id}`,
				userName: peer.userName,
				color: peer.color,
				x: el.x,
				y: el.y,
				width: el.width,
				height: el.height,
			});
		}
	}
	return result;
});

/** Clamp/format the label so very long names don't overflow the chip. */
const MAX_LABEL_CHARS = 20;
function labelFor(userName: string): string {
	return userName.length > MAX_LABEL_CHARS
		? `${userName.slice(0, MAX_LABEL_CHARS - 1)}…`
		: userName;
}

/** Absolute position + size for a box, scaled into the host's pixel space. */
function boxStyle(box: RemoteSelectionBox): CSSProperties {
	return {
		transform: `translate(${box.x * props.zoom}px, ${box.y * props.zoom}px)`,
		width: `${box.width * props.zoom}px`,
		height: `${box.height * props.zoom}px`,
		borderColor: box.color,
	};
}
</script>

<template>
	<div class="pptx-vue-remote-selections" aria-hidden="true" data-export-ignore="true">
		<div
			v-for="box in boxes"
			:key="box.key"
			class="pptx-vue-remote-selection"
			:data-element-id="box.key"
			:style="boxStyle(box)"
		>
			<span class="pptx-vue-remote-selection-label" :style="{ backgroundColor: box.color }">
				{{ labelFor(box.userName) }}
			</span>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-remote-selections {
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: visible;
	z-index: 9997;
}

.pptx-vue-remote-selection {
	position: absolute;
	top: 0;
	left: 0;
	box-sizing: border-box;
	border: 2px solid currentcolor;
	border-radius: 2px;
	pointer-events: none;
	will-change: transform;
	transition: transform 90ms linear;
}

.pptx-vue-remote-selection-label {
	position: absolute;
	top: -18px;
	left: -2px;
	max-width: 150px;
	padding: 1px 5px;
	border-radius: 3px;
	color: #ffffff;
	font-family: system-ui, sans-serif;
	font-size: 9px;
	font-weight: 500;
	line-height: 1.3;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
</style>
