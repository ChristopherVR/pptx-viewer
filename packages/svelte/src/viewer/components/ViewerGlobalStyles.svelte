<script lang="ts">
	// No props, no markup: this component exists only so its style block below
	// is emitted whenever the viewer is mounted. See the comment above that block.
	export {};
</script>

<!--
	ViewerGlobalStyles: the viewer's document-level (`:global`) chrome rules,
	split out of `PowerPointViewer.svelte` to keep that file under the repo's
	file-size budget.

	This component renders nothing; it exists only so its style block is emitted
	whenever the viewer is mounted. Every rule here is deliberately global: it
	targets descendants rendered by other components (focus rings, touch-target
	minimums, the reduced-motion escape hatch, the grid overlay, and the
	small-viewport chrome hiding), which a component-scoped rule in the viewer
	root cannot reach.
-->

<style>
	:global(.pptx-svelte-viewer :is(button, a, input, select, textarea, [tabindex]):focus-visible) {
		outline: 2px solid var(--pptx-ring, #818cf8) !important;
		outline-offset: 2px;
	}

	:global(.pptx-svelte-viewer :is(button, [role='button']):not([role='switch']):not([data-pptx-compact])) {
		min-width: 24px;
		min-height: 24px;
		touch-action: manipulation;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.pptx-svelte-viewer *),
		:global(.pptx-svelte-viewer *::before),
		:global(.pptx-svelte-viewer *::after) {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
			scroll-behavior: auto !important;
		}
	}

	:global(.pptx-svelte-reduced-motion *) {
		animation-duration: 0.01ms !important;
		transition-duration: 0.01ms !important;
	}

	:global(.pptx-svelte-show-grid .pptx-svelte-stage-holder)::after {
		position: absolute;
		inset: 0;
		z-index: 4;
		pointer-events: none;
		background-image: linear-gradient(#64748b22 1px, transparent 1px),
			linear-gradient(90deg, #64748b22 1px, transparent 1px);
		/*
		 * `--pptx-grid-size` is set inline on `.pptx-svelte-stage-holder` from
		 * the deck's authored `viewProperties.gridSpacing` (via
		 * `computeGridSpacingPx`); 12px matches this binding's existing default
		 * when the deck has none.
		 */
		background-size: var(--pptx-grid-size, 12px) var(--pptx-grid-size, 12px);
		content: '';
	}

	@media (forced-colors: active) {
		:global(.pptx-svelte-viewer :is(button, a, input, select, textarea, [tabindex]):focus-visible) {
			outline-color: Highlight;
		}
	}

	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		:global(.pptx-svelte-titlebar),
		:global(.pptx-svelte-ribbon),
		:global(.pptx-svelte-toolbar),
		:global(.pptx-svelte-statusbar),
		:global(.pptx-svelte-thumbs),
		:global(.pptx-svelte-inspector) {
			display: none !important;
		}

		:global(.pptx-svelte-viewport) {
			padding-bottom: 64px;
		}
	}
</style>
