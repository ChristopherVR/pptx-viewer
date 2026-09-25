<script lang="ts">
	/**
	 * CropOverlay: the on-canvas crop-mode chrome for the picture in
	 * `editor.cropOps` (Picture Format > Crop). Thin presentation over the
	 * shared `buildCropOverlay` descriptor: the dimmed whole-image ghost, the
	 * frame outline, and the eight black crop handles.
	 *
	 * This overlay stack is UNSCALED (see `SelectionOverlay`), so the root sits
	 * at the picture's box multiplied by the stage scale, rotated like the
	 * element, and an inner layer scaled back to slide pixels holds the
	 * descriptor's boxes as-is (its handle sizes are already divided by zoom).
	 *
	 * Handle drags map to `dragCropHandle`, drags on the ghost or inside the
	 * frame to `panCropImage`; both write the picture live through
	 * `cropOps.preview`, so the normal renderer shows the crop as it changes.
	 * Pointer-downs are left to bubble: the stage handler re-arms the keyboard
	 * and ignores anything inside `[data-pptx-crop-overlay]`.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import type { CropHandleId } from 'pptx-viewer-shared';
	import {
		CROP_HANDLE_ARIA_KEY,
		beginCropDrag,
		buildCropOverlay,
		dragCropHandle,
		panCropImage,
		toElementAxes,
	} from 'pptx-viewer-shared';
	import { onDestroy, untrack } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import { getImageSrc } from '../style';

	const {
		editor,
		scale,
		mediaDataUrls,
	}: { editor: EditorState; scale: number; mediaDataUrls: Map<string, string> } = $props();
	const t = useTranslator();

	const crop = $derived(editor.cropOps);
	const element = $derived<PptxElement | undefined>(crop.active ? crop.element : undefined);
	const zoom = $derived(scale > 0 ? scale : 1);
	const overlay = $derived(element ? buildCropOverlay(element, zoom) : null);
	const imageSrc = $derived(element ? getImageSrc(element, mediaDataUrls) : undefined);

	// Selecting something else or leaving the slide commits the crop.
	$effect(() => {
		const ids = editor.selection.ids;
		const slide = editor.currentSlideIndex;
		untrack(() => crop.syncContext(ids, slide));
	});
	onDestroy(() => crop.commit());

	function beginDrag(event: PointerEvent, handle: CropHandleId | null): void {
		const target = crop.element;
		if (!target || event.button !== 0) {
			return;
		}
		event.preventDefault();
		const start = beginCropDrag(target);
		const originX = event.clientX;
		const originY = event.clientY;
		const onMove = (moveEvent: PointerEvent): void => {
			const { dx, dy } = toElementAxes(
				(moveEvent.clientX - originX) / zoom,
				(moveEvent.clientY - originY) / zoom,
				start.rotation,
			);
			crop.preview(
				handle ? dragCropHandle(start, handle, dx, dy) : panCropImage(start, dx, dy),
			);
		};
		const onUp = (): void => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
	}
</script>

{#if element && overlay}
	<div
		class="pptx-svelte-crop-overlay"
		data-pptx-crop-overlay="true"
		style:left={`${element.x * zoom}px`}
		style:top={`${element.y * zoom}px`}
		style:width={`${element.width * zoom}px`}
		style:height={`${element.height * zoom}px`}
		style:transform={element.rotation ? `rotate(${element.rotation}deg)` : undefined}
	>
		<div
			class="pptx-svelte-crop-layer"
			style:width={`${element.width}px`}
			style:height={`${element.height}px`}
			style:transform={`scale(${zoom})`}
		>
			<div
				class="pptx-svelte-crop-ghost"
				role="presentation"
				style:left={`${overlay.ghost.left}px`}
				style:top={`${overlay.ghost.top}px`}
				style:width={`${overlay.ghost.width}px`}
				style:height={`${overlay.ghost.height}px`}
				style:clip-path={overlay.ghost.clipPath}
				style:opacity={overlay.ghost.opacity}
				onpointerdown={(event) => beginDrag(event, null)}
			>
				{#if imageSrc}
					<img
						src={imageSrc}
						alt=""
						draggable="false"
						style:transform={overlay.ghost.transform || undefined}
					/>
				{/if}
			</div>
			<div
				class="pptx-svelte-crop-frame"
				data-pptx-crop-frame
				role="presentation"
				style:width={`${overlay.frame.width}px`}
				style:height={`${overlay.frame.height}px`}
				style:border-width={`${1 / zoom}px`}
				onpointerdown={(event) => beginDrag(event, null)}
			></div>
			{#each overlay.handles as handle (handle.id)}
				<button
					type="button"
					tabindex="-1"
					class="pptx-svelte-crop-handle"
					data-pptx-crop-handle={handle.id}
					aria-label={t(CROP_HANDLE_ARIA_KEY)}
					style:left={`${handle.left}px`}
					style:top={`${handle.top}px`}
					style:width={`${handle.width}px`}
					style:height={`${handle.height}px`}
					style:cursor={handle.cursor}
					onpointerdown={(event) => beginDrag(event, handle.id)}
				>
					<svg
						viewBox={`0 0 ${handle.width} ${handle.height}`}
						width="100%"
						height="100%"
						overflow="visible"
						aria-hidden="true"
					>
						<path d={handle.path} fill="#000" stroke="#fff" stroke-width={1 / zoom} />
					</svg>
				</button>
			{/each}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-crop-overlay {
		position: absolute;
		z-index: 59;
		overflow: visible;
		pointer-events: none;
		transform-origin: center;
	}

	.pptx-svelte-crop-layer {
		position: absolute;
		left: 0;
		top: 0;
		overflow: visible;
		transform-origin: 0 0;
	}

	.pptx-svelte-crop-ghost {
		position: absolute;
		overflow: hidden;
		pointer-events: auto;
		cursor: move;
	}

	.pptx-svelte-crop-ghost img {
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
		user-select: none;
	}

	.pptx-svelte-crop-frame {
		position: absolute;
		left: 0;
		top: 0;
		box-sizing: border-box;
		border: 1px solid rgb(0 0 0 / 60%);
		outline: 1px dashed rgb(255 255 255 / 70%);
		outline-offset: -1px;
		pointer-events: auto;
		cursor: move;
	}

	.pptx-svelte-crop-handle {
		position: absolute;
		display: block;
		margin: 0;
		padding: 0;
		border: none;
		background: transparent;
		pointer-events: auto;
		touch-action: none;
	}

	.pptx-svelte-crop-handle svg {
		display: block;
	}
</style>
