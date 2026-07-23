<script lang="ts">
/**
 * CollaborationCursors: presentational overlay that renders remote
 * collaborators' cursors above the slide canvas.
 *
 * This component is purely visual: it owns no network/Yjs logic. The
 * integrator supplies a reactive list of {@link RemoteCursor} entries (via the
 * collaboration composable). Each entry is drawn as an absolutely-positioned
 * pointer SVG plus a name-label chip in the user's colour, placed at `(x, y)`.
 *
 * `x`/`y` are *unscaled* slide coordinates (px) and are used as-is: the
 * overlay is mounted inside the scaled slide-stage host (like the local
 * selection overlay), so the stage's CSS `transform: scale()` applies the zoom
 * exactly once. Multiplying by zoom here as well would double-apply the scale
 * and misplace cursors at any zoom other than 100%.
 *
 * The overlay sets `pointer-events: none` so it never intercepts canvas input.
 */

/** A single remote collaborator's cursor, in unscaled slide coordinates. */
export interface RemoteCursor {
	/** Stable id for the remote client (awareness clientId or peer id). */
	clientId: number | string;
	/** Display name shown in the label chip. */
	userName: string;
	/** Cursor + chip colour (any CSS colour string). */
	color: string;
	/** Unscaled slide-space X coordinate (px). */
	x: number;
	/** Unscaled slide-space Y coordinate (px). */
	y: number;
	/** Optional ids of elements this user has selected. */
	selectionIds?: string[];
}
</script>

<script setup lang="ts">
import type { CSSProperties } from 'vue';

const props = defineProps<{
	/** Remote collaborators to render, in unscaled slide coordinates. */
	cursors: RemoteCursor[];
	/**
	 * @deprecated Unused. The scaled slide-stage host already applies the zoom
	 * via its CSS transform, so cursor coordinates are rendered as-is.
	 */
	zoom?: number;
}>();

/** Clamp/format the label so very long names don't overflow the chip. */
const MAX_LABEL_CHARS = 20;
function labelFor(userName: string): string {
	return userName.length > MAX_LABEL_CHARS
		? `${userName.slice(0, MAX_LABEL_CHARS - 1)}…`
		: userName;
}

/** Absolute position for a cursor, in raw slide-space pixels. */
function cursorStyle(cursor: RemoteCursor): CSSProperties {
	return {
		transform: `translate(${cursor.x}px, ${cursor.y}px)`,
	};
}
</script>

<template>
	<div class="pptx-vue-collab-cursors" aria-hidden="true" data-export-ignore="true">
		<div
			v-for="cursor in props.cursors"
			:key="cursor.clientId"
			class="pptx-vue-collab-cursor"
			:data-client-id="cursor.clientId"
			:style="cursorStyle(cursor)"
		>
			<svg
				class="pptx-vue-collab-pointer"
				width="20"
				height="22"
				viewBox="0 0 20 22"
				focusable="false"
			>
				<path
					d="M0 0 L0 16 L4.5 12.5 L8 20 L10.5 19 L7 11.5 L12 11 Z"
					:fill="cursor.color"
					stroke="#ffffff"
					stroke-width="1"
				/>
			</svg>
			<span class="pptx-vue-collab-label" :style="{ backgroundColor: cursor.color }">
				{{ labelFor(cursor.userName) }}
			</span>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-collab-cursors {
	position: absolute;
	inset: 0;
	pointer-events: none;
	overflow: visible;
	z-index: 9999;
}

.pptx-vue-collab-cursor {
	position: absolute;
	top: 0;
	left: 0;
	pointer-events: none;
	will-change: transform;
	transition: transform 90ms linear;
}

.pptx-vue-collab-pointer {
	display: block;
	filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
}

.pptx-vue-collab-label {
	position: absolute;
	top: 16px;
	left: 12px;
	max-width: 150px;
	padding: 2px 6px;
	border-radius: 4px;
	color: #ffffff;
	font-family: system-ui, sans-serif;
	font-size: 10px;
	font-weight: 500;
	line-height: 1.2;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
</style>
