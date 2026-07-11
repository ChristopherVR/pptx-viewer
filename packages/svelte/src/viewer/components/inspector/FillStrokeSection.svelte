<script lang="ts">
	/**
	 * FillStrokeSection: flat fill/stroke colour (as before), plus fill/stroke
	 * opacity sliders and a gradient-fill toggle. When the gradient toggle is on,
	 * {@link GradientPanel} renders the linear/radial + angle + stop editor built
	 * on the shared `gradient-picker.ts`, matching the vanilla binding's scope.
	 * Shown only for elements that pass `hasShapeProperties`.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		fillColorOf,
		gradientStateOf,
		gradientStatePatch,
		hasGradientFill,
		strokeColorOf,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import {
		fillOpacityOf,
		setFillOpacityPatch,
		setSolidFillPatch,
		setStrokeColorPatch,
		setStrokeOpacityPatch,
		strokeOpacityOf,
	} from '../../editor';
	import GradientPanel from './GradientPanel.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const fill = $derived(fillColorOf(el));
	const stroke = $derived(strokeColorOf(el));
	const fillOpacity = $derived(fillOpacityOf(el));
	const strokeOpacity = $derived(strokeOpacityOf(el));
	const gradientOn = $derived(hasGradientFill(el));

	function pct(value: number): string {
		return `${Math.round(value * 100)}%`;
	}

	function toggleGradient(checked: boolean): void {
		if (checked) {
			editor.patchSelected(gradientStatePatch(el, gradientStateOf(el)));
		} else {
			editor.patchSelected(setSolidFillPatch(el, fill));
		}
	}
</script>

<div class="pptx-svelte-inspector-color-row">
	<label class="pptx-svelte-inspector-color">
		<span>{t('pptx.inspector.fill')}</span>
		<input
			type="color"
			value={/^#/.test(fill) ? fill : '#ffffff'}
			onchange={(e) => editor.patchSelected(setSolidFillPatch(el, e.currentTarget.value))}
		/>
	</label>
	<label class="pptx-svelte-inspector-color">
		<span>{t('pptx.inspector.line')}</span>
		<input
			type="color"
			value={/^#/.test(stroke) ? stroke : '#000000'}
			onchange={(e) => editor.patchSelected(setStrokeColorPatch(el, e.currentTarget.value))}
		/>
	</label>
</div>

<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label"
		>{t('pptx.strokeEffects.fillOpacity')} <b>{pct(fillOpacity)}</b></span
	>
	<input
		type="range"
		min="0"
		max="1"
		step="0.01"
		value={fillOpacity}
		oninput={(e) => editor.patchSelected(setFillOpacityPatch(el, Number(e.currentTarget.value)))}
	/>
</label>
<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label"
		>{t('pptx.strokeEffects.strokeOpacity')} <b>{pct(strokeOpacity)}</b></span
	>
	<input
		type="range"
		min="0"
		max="1"
		step="0.01"
		value={strokeOpacity}
		oninput={(e) => editor.patchSelected(setStrokeOpacityPatch(el, Number(e.currentTarget.value)))}
	/>
</label>

<label class="pptx-svelte-field-checkbox">
	<input
		type="checkbox"
		checked={gradientOn}
		onchange={(e) => toggleGradient(e.currentTarget.checked)}
	/>
	<span>{t('pptx.fill.gradient')}</span>
</label>

{#if gradientOn}
	<GradientPanel {editor} {el} />
{/if}

<style>
	.pptx-svelte-inspector-color-row {
		display: flex;
		gap: 12px;
	}

	.pptx-svelte-inspector-color {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-inspector-color span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-color input[type='color'] {
		width: 40px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 10px;
	}

	.pptx-svelte-field-label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-field-label b {
		color: inherit;
		font-weight: 600;
	}

	.pptx-svelte-field input[type='range'] {
		width: 100%;
	}

	.pptx-svelte-field-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		cursor: pointer;
	}
</style>
