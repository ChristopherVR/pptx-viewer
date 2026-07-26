<script lang="ts">
	/**
	 * CollaborationCursors: presentational overlay that renders remote
	 * collaborators' cursors above the slide canvas. Svelte port of the Vue
	 * `CollaborationCursors.vue`; owns no network/Yjs logic.
	 *
	 * `cursors` come from `CollaborationController.cursors` (unscaled slide-space
	 * px); this component multiplies by `zoom` so it can be mounted inside the
	 * scaled slide-stage host (alongside `EditorLayer`'s selection overlay) while
	 * still receiving raw slide-space coordinates. The overlay sets
	 * `pointer-events: none` so it never intercepts canvas input.
	 */
	import type { RemoteCursor } from 'pptx-viewer-shared';
	import { formatCursorLabel } from 'pptx-viewer-shared';

	import type { CollaborationCursorsProps } from './props';

	const { cursors, zoom }: CollaborationCursorsProps = $props();

	function cursorTransform(cursor: RemoteCursor): string {
		return `translate(${cursor.x * zoom}px, ${cursor.y * zoom}px)`;
	}
</script>

<div class="pptx-svelte-collab-cursors" aria-hidden="true" data-export-ignore="true">
	{#each cursors as cursor (cursor.clientId)}
		<div
			class="pptx-svelte-collab-cursor"
			data-client-id={cursor.clientId}
			data-pptx-remote-cursor={cursor.clientId}
			style={`transform: ${cursorTransform(cursor)}`}
		>
			<svg
				class="pptx-svelte-collab-pointer"
				width="20"
				height="22"
				viewBox="0 0 20 22"
				focusable="false"
			>
				<path
					d="M0 0 L0 16 L4.5 12.5 L8 20 L10.5 19 L7 11.5 L12 11 Z"
					fill={cursor.color}
					stroke="#ffffff"
					stroke-width="1"
				/>
			</svg>
			<span class="pptx-svelte-collab-label" style={`background-color: ${cursor.color}`}>
				{formatCursorLabel(cursor.userName)}
			</span>
		</div>
	{/each}
</div>

<style>
	.pptx-svelte-collab-cursors {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: visible;
		z-index: 9999;
	}

	.pptx-svelte-collab-cursor {
		position: absolute;
		top: 0;
		left: 0;
		pointer-events: none;
		will-change: transform;
		transition: transform 90ms linear;
	}

	.pptx-svelte-collab-pointer {
		display: block;
		filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.35));
	}

	.pptx-svelte-collab-label {
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
