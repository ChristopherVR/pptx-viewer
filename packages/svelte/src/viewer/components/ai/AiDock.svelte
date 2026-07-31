<script lang="ts">
	/**
	 * AiDock: the panel's placement inside the viewer root, and the lazy boundary
	 * that keeps `@ai-sdk/svelte` + the optional `ai` SDK out of the main bundle.
	 * The dynamic `import()` below is the ONLY reference to `AiChatPanel`, so the
	 * assistant's dependencies load the first time a user opens it.
	 *
	 * Split out of `PowerPointViewer.svelte` (with its own placement styles) to
	 * keep that file within the repo's file-size budget.
	 */
	import type { PptxAiBridge, PptxAiConfig } from 'pptx-viewer-shared/ai';

	import type { AiPanelController } from '../../ai/ai-panel-controller.svelte';

	const {
		bridge,
		config,
		aiPanel,
		onclose,
	}: {
		bridge: PptxAiBridge;
		config: PptxAiConfig;
		aiPanel: AiPanelController;
		onclose: () => void;
	} = $props();
</script>

<div class="pptx-svelte-ai-dock">
	{#await import('./AiChatPanel.svelte') then { default: AiChatPanel }}
		<AiChatPanel {bridge} {config} {aiPanel} {onclose} />
	{/await}
</div>

<style>
	.pptx-svelte-ai-dock {
		position: absolute;
		top: 0;
		right: 0;
		z-index: 30;
		height: 100%;
		box-shadow: -8px 0 24px -12px rgba(0, 0, 0, 0.5);
	}

	/*
	 * Mobile (<768px): a bottom sheet, not a full-screen overlay. A full-height
	 * panel (inset: 0) covered the whole canvas, so AI-created/selected elements
	 * could not be tapped ("the whole clicking flow is dead"). Anchor the dock to
	 * the bottom edge so the top of the canvas stays visible + interactive above
	 * it; the panel itself fixes its own height (75dvh) and rounds its top
	 * corners. Matches the app's other mobile bottom sheets.
	 */
	@media (max-width: 767px) {
		.pptx-svelte-ai-dock {
			top: auto;
			right: 0;
			bottom: 0;
			left: 0;
			height: auto;
			box-shadow: 0 -8px 24px -12px rgba(0, 0, 0, 0.5);
		}
	}
</style>
