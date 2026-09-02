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
		ARTISTIC_EFFECTS,
		DUOTONE_PRESETS,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const adjustments = $derived(imageAdjustmentsStateOf(el));
	const crop = $derived(imageCropStateOf(el));
	const effects = $derived('imageEffects' in el ? el.imageEffects : undefined);
	function setEffects(next: Record<string, unknown>): void {
		editor.patchSelected({ imageEffects: { ...effects, ...next } } as Partial<PptxElement>);
	}

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
	function replaceImage(file: File | undefined): void {
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => editor.patchSelected({ imageData: String(reader.result), imagePath: undefined } as Partial<PptxElement>);
		reader.readAsDataURL(file);
	}
	function resetImage(): void {
		editor.patchSelected({ cropLeft: 0, cropTop: 0, cropRight: 0, cropBottom: 0, imageEffects: undefined } as Partial<PptxElement>);
	}
</script>

<div class="pptx-svelte-image-actions"><label>Replace<input type="file" accept="image/*" onchange={(event) => replaceImage(event.currentTarget.files?.[0])} /></label><button type="button" onclick={resetImage}>Reset picture</button></div>

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

<label class="pptx-svelte-field"><span>{t('pptx.image.artisticEffects')}</span><select aria-label={t('pptx.image.artisticEffects')} value={effects?.artisticEffect ?? 'none'} onchange={(e) => setEffects({ artisticEffect: e.currentTarget.value === 'none' ? undefined : e.currentTarget.value })}>{#each ARTISTIC_EFFECTS as preset}<option value={preset[0]}>{t(preset[1])}</option>{/each}</select></label>
<div class="pptx-svelte-duotone"><span>{t('pptx.image.duotone')}</span>{#each DUOTONE_PRESETS as preset}<button type="button" title={t(preset.labelKey)} style={`--shadow:${preset.shadow};--highlight:${preset.highlight}`} onclick={() => setEffects({ duotone: { color1: preset.shadow, color2: preset.highlight } })}></button>{/each}<button type="button" title={t('pptx.image.duotoneClear')} onclick={() => setEffects({ duotone: undefined })}>×</button></div>
<label class="pptx-svelte-field"><span>Transparency {100 - (effects?.alphaModFix ?? 100)}%</span><input type="range" min="0" max="100" value={100 - (effects?.alphaModFix ?? 100)} oninput={(event) => setEffects({ alphaModFix: 100 - Number(event.currentTarget.value) })} /></label>
<label class="pptx-svelte-field"><span>Bi-level threshold {effects?.biLevel ?? 0}%</span><input type="range" min="0" max="100" value={effects?.biLevel ?? 0} oninput={(event) => setEffects({ biLevel: Number(event.currentTarget.value) || undefined })} /></label>
<label class="pptx-svelte-field-checkbox"><input type="checkbox" checked={Boolean(effects?.colorWash)} onchange={(event) => setEffects({ colorWash: event.currentTarget.checked ? { color: '#0066cc', opacity: 40 } : undefined })} /><span>Color wash</span></label>
{#if effects?.colorWash}<div class="pptx-svelte-inspector-grid"><label><span>Wash color</span><input type="color" value={effects.colorWash.color} onchange={(event) => { setEffects({ colorWash: { ...effects.colorWash, color: event.currentTarget.value } }); editor.recordRecentColor(event.currentTarget.value); }} /></label><label><span>Wash opacity</span><input type="number" min="0" max="100" value={effects.colorWash.opacity ?? 40} onchange={(event) => setEffects({ colorWash: { ...effects.colorWash, opacity: Number(event.currentTarget.value) } })} /></label></div>{/if}

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
	.pptx-svelte-field select{height:26px;border:1px solid var(--pptx-border);border-radius:6px;background:var(--pptx-background);color:inherit}.pptx-svelte-duotone{display:flex;align-items:center;flex-wrap:wrap;gap:4px;margin-top:10px}.pptx-svelte-duotone>span{width:100%;color:var(--pptx-muted-foreground);font-size:10px}.pptx-svelte-duotone button{width:24px;height:24px;border:1px solid var(--pptx-border);border-radius:50%;background:linear-gradient(135deg,var(--shadow) 50%,var(--highlight) 50%);color:inherit}
	.pptx-svelte-image-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.pptx-svelte-image-actions label,.pptx-svelte-image-actions button{display:grid;place-items:center;min-height:28px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-muted);color:inherit;font-size:10px}.pptx-svelte-image-actions input{position:absolute;width:1px;height:1px;opacity:0}.pptx-svelte-field-checkbox{display:flex;align-items:center;gap:5px;margin-top:8px}
</style>
