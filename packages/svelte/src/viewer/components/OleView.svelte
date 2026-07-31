<script lang="ts">
	/**
	 * OleView: renders `ole` (embedded object) elements (Svelte port of the
	 * vanilla / Vue OLE renderer, viewer subset):
	 *
	 * - Preview image (`previewImageData`) with a small type badge overlay.
	 * - Otherwise a type-specific placeholder box (brand colour, icon, display
	 *   name + type sublabel) via the shared OLE type-resolution helpers.
	 * - When core recovered the embedded payload (`oleEmbeddedData`), an
	 *   action bar exposes a Download link, an Open-in-new-tab button for
	 *   browser-renderable MIME types, and a compact size caption; the full
	 *   info caption doubles as the tooltip.
	 */
	import { openUrlInNewTab } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { buildOleView, getOleIconShapes } from '../render';
	import { getContainerStyle, styleToString } from '../style';
	import type { ElementRendererProps } from './props';

	const { element, zIndex, interactive = false }: ElementRendererProps = $props();
	const t = useTranslator();

	const view = $derived(element.type === 'ole' ? buildOleView(element) : undefined);
	const containerStyle = $derived(styleToString(getContainerStyle(element, zIndex)));

	/**
	 * Swallow pointer interactions so a click on an action never bubbles into
	 * host-level element selection / drag handlers.
	 */
	function stop(event: Event): void {
		event.stopPropagation();
	}
</script>

{#if view}
	<div
		class="pptx-svelte-element pptx-svelte-ole"
		style={containerStyle}
		data-element-id={element.id}
		data-pptx-element={interactive ? 'true' : undefined}
		role="group"
		aria-label={view.ariaLabel}
		title={view.titleText}
	>
		{#if view.previewSrc}
			<div class="pptx-svelte-ole-preview">
				<img class="pptx-svelte-ole-img" src={view.previewSrc} alt={view.ariaLabel} draggable="false" />
				<!-- Decorative badge overlay: never intercepts action-bar clicks. -->
				<svg class="pptx-svelte-ole-badge" width="24" height="24" viewBox="0 0 24 24">
					<rect x="2" y="2" width="20" height="20" rx="3" fill={view.typeColor} />
					<text x="12" y="16" text-anchor="middle" fill="white" font-size={view.badgeFontSize} font-weight="bold">
						{view.badgeLabel}
					</text>
				</svg>
			</div>
		{:else}
			<div class="pptx-svelte-ole-placeholder" style={view.placeholderStyle}>
				<svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					{#each getOleIconShapes(view.type) as shape, i (i)}
						{#if shape.tag === 'rect'}
							<rect {...shape.attrs} stroke={view.typeColor} />
						{:else if shape.tag === 'line'}
							<line {...shape.attrs} stroke={view.typeColor} />
						{:else}
							<text {...shape.attrs} fill={view.typeColor}>{shape.text}</text>
						{/if}
					{/each}
				</svg>
				<span class="pptx-svelte-ole-name" style={`color: ${view.typeColor}`}>{view.displayName}</span>
				{#if view.sublabel}
					<span class="pptx-svelte-ole-sublabel">{view.sublabel}</span>
				{/if}
			</div>
		{/if}
		{#if view.embeddedData}
			{@const embeddedData = view.embeddedData}
			<!-- The bar only swallows bubbling; the link/button inside are the interactive controls. -->
			<!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
			<div class="pptx-svelte-ole-actions" onpointerdown={stop} onmousedown={stop} onclick={stop}>
				{#if view.size}
					<span class="pptx-svelte-ole-meta">{view.size}</span>
				{/if}
				<a
					class="pptx-svelte-ole-action"
					href={embeddedData}
					download={view.downloadName}
					aria-label={t('pptx.ole.downloadName', { name: view.downloadName })}
					title={t('pptx.ole.downloadName', { name: view.downloadName })}
				>{t('pptx.ole.download')}</a>
				{#if view.canOpen}
					<button
						type="button"
						class="pptx-svelte-ole-action"
						aria-label={t('pptx.ole.openName', { name: view.downloadName })}
						title={t('pptx.ole.openName', { name: view.downloadName })}
						onclick={() => openUrlInNewTab(embeddedData)}
					>{t('pptx.ole.open')}</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-ole-preview {
		position: relative;
		width: 100%;
		height: 100%;
	}

	.pptx-svelte-ole-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		pointer-events: none;
		user-select: none;
		display: block;
	}

	.pptx-svelte-ole-badge {
		position: absolute;
		bottom: 4px;
		right: 4px;
		z-index: 10;
		pointer-events: none;
	}

	.pptx-svelte-ole-name {
		margin-top: 8px;
		font-size: 12px;
		font-weight: 500;
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ole-sublabel {
		margin-top: 2px;
		font-size: 10px;
		color: rgba(0, 0, 0, 0.45);
		max-width: 90%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ole-actions {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 6px;
		padding: 4px 6px;
		box-sizing: border-box;
		background: rgba(255, 255, 255, 0.82);
		border-top: 1px solid rgba(0, 0, 0, 0.08);
		font-size: 11px;
		pointer-events: auto;
	}

	.pptx-svelte-ole-meta {
		margin-right: auto;
		color: rgba(0, 0, 0, 0.55);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-ole-action {
		flex: none;
		padding: 2px 8px;
		border: 1px solid rgba(0, 0, 0, 0.18);
		border-radius: 4px;
		background: #fff;
		color: #1a1a1a;
		font: inherit;
		font-size: 11px;
		line-height: 1.4;
		cursor: pointer;
		text-decoration: none;
	}
</style>
