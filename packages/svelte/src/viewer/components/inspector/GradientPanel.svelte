<script lang="ts">
	/**
	 * GradientPanel: linear/radial fill-gradient sub-panel (angle + colour stops),
	 * built entirely on the shared `gradient-picker.ts` reader/patch-builder pair
	 * (`gradientStateOf` / `gradientStatePatch` / `addGradientStopPatch` /
	 * `updateGradientStopPatch` / `removeGradientStopPatch`), matching the
	 * vanilla binding's gradient sub-panel. Rendered by `FillStrokeSection` only
	 * while the gradient toggle is on.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		addGradientStopPatch,
		gradientStateOf,
		gradientStatePatch,
		removeGradientStopPatch,
		updateGradientStopPatch,
	} from 'pptx-viewer-shared';
	import type { GradientState } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const gradient = $derived(gradientStateOf(el));

	function setType(type: GradientState['type']): void {
		editor.patchSelected(gradientStatePatch(el, { ...gradient, type }));
	}
	function setAngle(value: string): void {
		const angle = Number(value);
		if (Number.isFinite(angle)) {
			editor.patchSelected(gradientStatePatch(el, { ...gradient, angle }));
		}
	}
	function addStop(): void {
		const stops = gradient.stops;
		const lastPos = stops[stops.length - 1]?.position ?? 100;
		const prevPos = stops[stops.length - 2]?.position ?? 0;
		editor.patchSelected(addGradientStopPatch(el, '#ffffff', Math.round((lastPos + prevPos) / 2)));
	}
	function updateStopColor(index: number, color: string): void {
		editor.patchSelected(updateGradientStopPatch(el, index, { color }));
		editor.recordRecentColor(color);
	}
	function updateStopPosition(index: number, value: string): void {
		const position = Number(value);
		if (Number.isFinite(position)) {
			editor.patchSelected(updateGradientStopPatch(el, index, { position }));
		}
	}
	function removeStop(index: number): void {
		const patch = removeGradientStopPatch(el, index);
		if (patch) {
			editor.patchSelected(patch);
		}
	}
</script>

<div class="pptx-svelte-gradient">
	<div class="pptx-svelte-gradient-type">
		<button
			type="button"
			class:pptx-svelte-gradient-on={gradient.type === 'linear'}
			onclick={() => setType('linear')}
		>
			{t('pptx.gradient.linear')}
		</button>
		<button
			type="button"
			class:pptx-svelte-gradient-on={gradient.type === 'radial'}
			onclick={() => setType('radial')}
		>
			{t('pptx.gradient.radial')}
		</button>
	</div>

	<label class="pptx-svelte-gradient-angle">
		<span>{t('pptx.gradient.angle')}</span>
		<input
			type="number"
			min="0"
			max="360"
			value={gradient.angle}
			disabled={gradient.type === 'radial'}
			onchange={(e) => setAngle(e.currentTarget.value)}
		/>
	</label>

	<div class="pptx-svelte-gradient-stops">
		{#each gradient.stops as stop, index (index)}
			<div class="pptx-svelte-gradient-stop">
				<input
					type="color"
					aria-label={t('pptx.gradient.stops')}
					value={stop.color}
					onchange={(e) => updateStopColor(index, e.currentTarget.value)}
				/>
				<input
					type="number"
					min="0"
					max="100"
					aria-label={t('pptx.gradient.position')}
					value={stop.position}
					onchange={(e) => updateStopPosition(index, e.currentTarget.value)}
				/>
				<button
					type="button"
					class="pptx-svelte-gradient-remove"
					disabled={gradient.stops.length <= 2}
					aria-label={t('pptx.gradient.removeStop')}
					title={t('pptx.gradient.removeStop')}
					onclick={() => removeStop(index)}
				>
					&#10005;
				</button>
			</div>
		{/each}
	</div>

	<button type="button" class="pptx-svelte-gradient-add" onclick={addStop}>
		{t('pptx.gradient.addStop')}
	</button>
</div>

<style>
	.pptx-svelte-gradient {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--pptx-border, #33334d);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.pptx-svelte-gradient-type {
		display: flex;
		gap: 6px;
	}

	.pptx-svelte-gradient-type button {
		flex: 1;
		height: 26px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-gradient-on {
		background: var(--pptx-primary, #6366f1) !important;
		color: #fff !important;
		border-color: var(--pptx-primary, #6366f1) !important;
	}

	.pptx-svelte-gradient-angle {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-gradient-angle span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-gradient-angle input {
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-gradient-stops {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.pptx-svelte-gradient-stop {
		display: grid;
		grid-template-columns: 32px 1fr 24px;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-gradient-stop input[type='color'] {
		width: 32px;
		height: 24px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-gradient-stop input[type='number'] {
		height: 24px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-gradient-remove {
		width: 24px;
		height: 24px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-gradient-remove:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-gradient-add {
		height: 26px;
		border: 1px dashed var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}
</style>
