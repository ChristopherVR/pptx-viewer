<script lang="ts">
	/**
	 * ImageSection: brightness/contrast/saturation adjustment sliders and a
	 * basic four-edge numeric crop (each edge as a 0-90% inset), for
	 * `isImageLikeElement` elements. Built entirely on the shared
	 * `image-adjustments.ts` reader/patch-builder pair.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		imageAdjustmentsPatch,
		imageAdjustmentsStateOf,
		imageCropPatch,
		imageCropStateOf,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const adjustments = $derived(imageAdjustmentsStateOf(el));
	const crop = $derived(imageCropStateOf(el));

	function pct(value: number): string {
		return `${Math.round(value)}%`;
	}

	function setBrightness(value: string): void {
		editor.patchSelected(imageAdjustmentsPatch(el, { brightness: Number(value) }));
	}
	function setContrast(value: string): void {
		editor.patchSelected(imageAdjustmentsPatch(el, { contrast: Number(value) }));
	}
	function setSaturation(value: string): void {
		editor.patchSelected(imageAdjustmentsPatch(el, { saturation: Number(value) }));
	}
	function setCrop(edge: 'cropLeft' | 'cropTop' | 'cropRight' | 'cropBottom', value: string): void {
		const n = Number(value);
		if (Number.isFinite(n)) {
			editor.patchSelected(imageCropPatch(el, { [edge]: n / 100 }));
		}
	}
</script>

<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label"
		>{t('pptx.imageAdjustments.brightness')} <b>{pct(adjustments.brightness)}</b></span
	>
	<input
		type="range"
		min="-100"
		max="100"
		value={adjustments.brightness}
		oninput={(e) => setBrightness(e.currentTarget.value)}
	/>
</label>
<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label"
		>{t('pptx.imageAdjustments.contrast')} <b>{pct(adjustments.contrast)}</b></span
	>
	<input
		type="range"
		min="-100"
		max="100"
		value={adjustments.contrast}
		oninput={(e) => setContrast(e.currentTarget.value)}
	/>
</label>
<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label"
		>{t('pptx.image.saturation')} <b>{pct(adjustments.saturation)}</b></span
	>
	<input
		type="range"
		min="-100"
		max="100"
		value={adjustments.saturation}
		oninput={(e) => setSaturation(e.currentTarget.value)}
	/>
</label>

<div class="pptx-svelte-inspector-grid">
	<label>
		<span>{t('pptx.image.cropLeft')}</span>
		<input
			type="number"
			min="0"
			max="90"
			value={Math.round(crop.cropLeft * 100)}
			onchange={(e) => setCrop('cropLeft', e.currentTarget.value)}
		/>
	</label>
	<label>
		<span>{t('pptx.image.cropTop')}</span>
		<input
			type="number"
			min="0"
			max="90"
			value={Math.round(crop.cropTop * 100)}
			onchange={(e) => setCrop('cropTop', e.currentTarget.value)}
		/>
	</label>
	<label>
		<span>{t('pptx.image.cropRight')}</span>
		<input
			type="number"
			min="0"
			max="90"
			value={Math.round(crop.cropRight * 100)}
			onchange={(e) => setCrop('cropRight', e.currentTarget.value)}
		/>
	</label>
	<label>
		<span>{t('pptx.image.cropBottom')}</span>
		<input
			type="number"
			min="0"
			max="90"
			value={Math.round(crop.cropBottom * 100)}
			onchange={(e) => setCrop('cropBottom', e.currentTarget.value)}
		/>
	</label>
</div>

<style>
	.pptx-svelte-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 10px;
	}

	.pptx-svelte-field:first-child {
		margin-top: 0;
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

	.pptx-svelte-inspector-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 10px;
	}

	.pptx-svelte-inspector-grid label {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-inspector-grid span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-inspector-grid input {
		width: 100%;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}
</style>
