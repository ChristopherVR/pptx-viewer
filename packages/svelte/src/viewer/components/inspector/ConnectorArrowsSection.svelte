<script lang="ts">
	/**
	 * ConnectorArrowsSection: a connector's arrowheads, at parity with React's
	 * `inspector/ConnectorArrowsSection.tsx` and Vue's `ConnectorArrowsPanel`.
	 *
	 * WHY it exists: Svelte offered only the two `type` pickers, so a user could
	 * choose a triangle head but never its size. A connector's arrowheads are six
	 * editable properties (`a:ln/a:headEnd` and `a:ln/a:tailEnd`, each with a
	 * `type` plus a `w` width and `len` length step) and Svelte's renderer already
	 * honoured all six on paint; only four of the editing surfaces were missing.
	 *
	 * The control list, option order, fallbacks and caption keys all come from
	 * `pptx-viewer-shared`, so this component stays presentation: it renders
	 * descriptors and relays a merged `shapeStyle` patch through the editor, which
	 * is what records the undo step and repaints the line.
	 */
	import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
	import type { ConnectorArrowControl } from 'pptx-viewer-shared';
	import {
		canInteractWithElement,
		CONNECTOR_ARROW_CONTROLS,
		connectorArrowPatch,
		connectorArrowValue,
		schemaLabel,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const {
		editor,
		style,
		el,
	}: { editor: EditorState; style: ShapeStyle | undefined; el?: PptxElement } = $props();
	const t = useTranslator();

	// G9: `arrowheadsChangeable` (`a:cxnSpLocks/@noChangeArrowheads`) already
	// existed on `element-locks.ts` but nothing here consulted it.
	const changeable = $derived(canInteractWithElement(el, 'changeArrowheads'));

	function onChange(control: ConnectorArrowControl, raw: string): void {
		if (!changeable) {
			return;
		}
		editor.patchSelected({
			shapeStyle: { ...style, ...connectorArrowPatch(control, raw) },
		} as Partial<PptxElement>);
	}
</script>

<div class="grid">
	{#each CONNECTOR_ARROW_CONTROLS as control (control.styleKey)}
		<label
			>{t(control.labelKey)}<select
				aria-label={t(control.labelKey)}
				value={connectorArrowValue(control, style)}
				disabled={!changeable}
				onchange={(event) => onChange(control, event.currentTarget.value)}
				>{#each control.values as value (value)}<option {value}
						>{schemaLabel(control.optionLabelKeys, value, t)}</option
					>{/each}</select
			></label
		>
	{/each}
</div>

<style>
	label {
		display: grid;
		gap: 3px;
		margin-top: 7px;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
	}
	select {
		height: 26px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-background);
		color: inherit;
	}
	.grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}
</style>
