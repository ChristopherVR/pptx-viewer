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
	 * During presentation the tile is keyboard/click navigable, and fallback
	 * thumbnails use the target slide's background, number, and section label.
	 */
	import { useTranslator } from '../../i18n/context';
	import { buildSummaryZoomView } from 'pptx-viewer-shared';
	import { resolveZoomView } from '../render';
	import { resolveZoomTargetInfo, useZoomNavigation } from '../state/zoom-navigation-context';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	// The `interactive` prop is aliased to `markElement` here to keep it apart
	// from this view's own `clickable`: a zoom tile is clickable only while
	// PRESENTING (it navigates to its target slide), whereas the prop means
	// "this node takes part in the neutral element contract" and is set on the
	// editing canvas instead. The two are never true together.
	const {
		element,
		zIndex,
		presenting = false,
		interactive: markElement = false,
	}: ElementRendererProps = $props();
	const t = useTranslator();
	const navigation = useZoomNavigation();

	const zoom = $derived(element.type === 'zoom' ? element : undefined);
	const view = $derived(zoom ? resolveZoomView(zoom) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));
	const targetInfo = $derived(view ? resolveZoomTargetInfo(navigation, view.target) : undefined);
	const summaryView = $derived(
		zoom
			? buildSummaryZoomView(zoom, (index) => resolveZoomTargetInfo(navigation, index))
			: undefined,
	);
	const clickable = $derived(Boolean(presenting && navigation && view));
	const slideNumber = $derived(targetInfo?.slideNumber ?? (view?.target ?? 0) + 1);
	const sectionLabel = $derived(targetInfo?.sectionName ?? view?.sectionId);
	const thumbnailStyle = $derived(
		targetInfo?.backgroundColor ? `background-color: ${targetInfo.backgroundColor}` : undefined,
	);
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

	function activate(): void {
		if (clickable && view) {
			navigation?.navigateToZoomTarget(view.target);
		}
	}

	function activateSummary(event: Event, target: number): void {
		if (!clickable) {return;}
		event.preventDefault();
		event.stopPropagation();
		navigation?.navigateToZoomTarget(target);
	}

	function onClick(event: MouseEvent): void {
		if (!clickable) {
			return;
		}
		event.stopPropagation();
		activate();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!clickable || (event.key !== 'Enter' && event.key !== ' ')) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		activate();
	}
</script>

{#if zoom && view}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -- role and tabindex activate together only in presentation mode -->
	<div
		class="pptx-svelte-element pptx-svelte-zoom"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={markElement ? 'true' : undefined}
		data-zoom-type={view.zoomType}
		data-zoom-target={view.target}
		aria-label={summaryView?.ariaLabel ?? ariaLabel}
		role={summaryView ? 'group' : clickable ? 'button' : undefined}
		tabindex={!summaryView && clickable ? 0 : undefined}
		class:pptx-svelte-zoom-interactive={clickable}
		onclick={onClick}
		onkeydown={onKeydown}
	>
		{#if summaryView}
			<div class="pptx-svelte-summary-zoom" style={styleToString(summaryView.containerStyle)}>
				{#each summaryView.tiles as tile (tile.key)}
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div
						class="pptx-svelte-summary-zoom-tile"
						style={styleToString({ ...tile.style, backgroundColor: tile.backgroundColor })}
						data-zoom-target={tile.targetSlideIndex}
						data-section-id={tile.sectionId}
						aria-label={tile.ariaLabel}
						role={clickable ? 'button' : undefined}
						tabindex={clickable ? 0 : undefined}
						onclick={(event) => activateSummary(event, tile.targetSlideIndex)}
						onkeydown={(event) => {
							if (event.key === 'Enter' || event.key === ' ') activateSummary(event, tile.targetSlideIndex);
						}}
					>
						{#if tile.imageSrc}<img src={tile.imageSrc} alt={tile.ariaLabel} draggable="false" />{:else}<div>{tile.label}</div><div>{tile.slideLabel}</div>{/if}
					</div>
				{/each}
				<div class="pptx-svelte-zoom-badge">Summary Zoom</div>
			</div>
		{:else}
		<div class="pptx-svelte-zoom-tile">
			{#if view.imageSrc}
				<img
					class="pptx-svelte-zoom-img"
					src={view.imageSrc}
					alt={t('pptx.zoom.slidePreviewAlt', { number: view.target + 1 })}
					draggable="false"
				/>
			{:else}
				<div class="pptx-svelte-zoom-thumbnail" style={thumbnailStyle}>
					<div class="pptx-svelte-zoom-slide-label">
						{t('pptx.notes.slideN', { n: slideNumber })}
					</div>
					{#if sectionLabel}
						<div class="pptx-svelte-zoom-section-label">{sectionLabel}</div>
					{/if}
				</div>
			{/if}
			<div class="pptx-svelte-zoom-badge">{badgeLabel}</div>
		</div>
		{/if}
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

	.pptx-svelte-summary-zoom-tile {
		overflow: hidden;
		border: 1px solid rgba(0, 0, 0, 0.12);
	}

	.pptx-svelte-summary-zoom-tile img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.pptx-svelte-zoom-interactive {
		cursor: pointer;
	}

	.pptx-svelte-zoom-interactive:focus-visible {
		outline: 2px solid #2563eb;
		outline-offset: 2px;
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
