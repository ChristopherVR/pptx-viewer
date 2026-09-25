<script lang="ts">
	/**
	 * FreeformToolButtons: Insert > Shapes' click-to-place drawing tools
	 * (Freeform: Shape, Curve), matching React's `toolbar/FreeformToolButtons`.
	 * A press arms the tool (press again to disarm); the drawing itself happens
	 * on the canvas overlay. Hosts can hide either through `hiddenDrawingTools`.
	 */
	import { FREEFORM_TOOL_IDS, FREEFORM_TOOL_LABEL_KEYS, isDrawingToolVisible } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { useViewerCustomization } from '../../../state/viewer-customization.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const customization = useViewerCustomization();
	const tools = $derived(
		FREEFORM_TOOL_IDS.filter((tool) => isDrawingToolVisible(customization.resolved, tool)),
	);
</script>

{#each tools as tool (tool)}
	{@const active = editor.outlineOps.freeformTool === tool}
	<button
		type="button"
		disabled={!editor.editable}
		aria-pressed={active}
		data-pptx-drawing-tool={tool}
		class:is-active={active}
		title={t(FREEFORM_TOOL_LABEL_KEYS[tool])}
		onclick={() => editor.outlineOps.armFreeformTool(active ? null : tool)}
	>
		{#if tool === 'curve'}
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 12c2-7 5-7 6-4s4 3 6-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		{:else}
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 12.5 5 4l4 5 4.5-6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
		{/if}
		<span>{t(FREEFORM_TOOL_LABEL_KEYS[tool])}</span>
	</button>
{/each}

<style>
	.is-active {
		background: var(--pptx-accent, #33334d);
	}
</style>
