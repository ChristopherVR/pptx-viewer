<script lang="ts">
	/**
	 * ZoomView: renders `zoom` (Slide Zoom / Section Zoom) elements, Svelte
	 * port of Vue's `ZoomRenderer.vue` / vanilla's `renderZoomElement`
	 * (static-tile subset):
	 *
	 * - The element's own preview thumbnail (`imageData`) renders when
	 *   available; otherwise a fallback tile shows the target slide number
	 *   (and the section id for section zooms).
	 * - A small "Slide Zoom" / "Section Zoom" badge is drawn in the corner.
	 * - `data-zoom-type` / `data-zoom-target` are exposed for hosts and tests.
	 *
	 * Not ported (host-state dependent in Vue/React): presentation-mode
	 * click-to-navigate and the target-slide background/section-name lookup.
	 */
	import { useTranslator } from '../../i18n/context';
	import { resolveZoomView } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex }: ElementRendererProps = $props();
	const t = useTranslator();

	const zoom = $derived(element.type === 'zoom' ? element : undefined);
	const view = $derived(zoom ? resolveZoomView(zoom) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const ariaLabel = $derived(
		view === undefined
			? undefined
			: view.zoomType === 'section' && view.sectionId
				? t('pptx.zoom.ariaLabelSection', { number: view.target + 1, section: view.sectionId })
				: t('pptx.zoom.ariaLabel', { number: view.target + 1 }),
	);
	const badgeLabel = $derived(
		view === undefined
			? ''
			: t(view.zoomType === 'section' ? 'pptx.zoom.sectionZoom' : 'pptx.zoom.slideZoom'),
	);
</script>

{#if zoom && view}
	<div
		class="pptx-svelte-element pptx-svelte-zoom"
		style={containerStyle}
		data-element-id={element.id}
		data-zoom-type={view.zoomType}
		data-zoom-target={view.target}
		aria-label={ariaLabel}
	>
		<div class="pptx-svelte-zoom-tile">
			{#if view.imageSrc}
				<img
					class="pptx-svelte-zoom-img"
					src={view.imageSrc}
					alt={t('pptx.zoom.slidePreviewAlt', { number: view.target + 1 })}
					draggable="false"
				/>
			{:else}
				<div class="pptx-svelte-zoom-thumbnail">
					<div class="pptx-svelte-zoom-slide-label">
						{t('pptx.notes.slideN', { n: view.target + 1 })}
					</div>
					{#if view.sectionId}
						<div class="pptx-svelte-zoom-section-label">{view.sectionId}</div>
					{/if}
				</div>
			{/if}
			<div class="pptx-svelte-zoom-badge">{badgeLabel}</div>
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-zoom-tile {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.pptx-svelte-zoom-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
		user-select: none;
		display: block;
	}

	.pptx-svelte-zoom-thumbnail {
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: #f0f0f0;
		border: 1px solid rgba(0, 0, 0, 0.1);
	}

	.pptx-svelte-zoom-slide-label {
		font-size: 14px;
		font-weight: 600;
		color: rgba(0, 0, 0, 0.5);
		margin-bottom: 4px;
	}

	.pptx-svelte-zoom-section-label {
		font-size: 10px;
		color: rgba(0, 0, 0, 0.4);
	}

	.pptx-svelte-zoom-badge {
		position: absolute;
		bottom: 4px;
		right: 4px;
		font-size: 9px;
		padding: 1px 4px;
		border-radius: 2px;
		background-color: rgba(0, 0, 0, 0.5);
		color: #fff;
		pointer-events: none;
		line-height: 1.4;
	}
</style>
