<script lang="ts">
	/**
	 * EffectsPanel: the shape effects section (Outer Shadow, Inner Shadow, Glow,
	 * Reflection, Soft Edge), built entirely on the shared, framework-agnostic
	 * `effects-helpers.ts` / `effects-shadow-helpers.ts` reader + patch-builder
	 * pair (`effectsStateOf`, `enable*Patch` / `disable*Patch` / `update*Patch`).
	 * Bevel/3D is out of scope here (no shared decision function yet). Rendered
	 * by `InspectorPanel` alongside `FillStrokeSection` for shape-property
	 * elements only.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		disableGlowPatch,
		disableInnerShadowPatch,
		disableOuterShadowPatch,
		disableReflectionPatch,
		disableSoftEdgePatch,
		effectsStateOf,
		enableGlowPatch,
		enableInnerShadowPatch,
		enableOuterShadowPatch,
		enableReflectionPatch,
		enableSoftEdgePatch,
		updateGlowPatch,
		updateInnerShadowPatch,
		updateOuterShadowPatch,
		updateReflectionPatch,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const effects = $derived(effectsStateOf(el));
</script>

<div class="pptx-svelte-effects">
	<!-- Outer Shadow -->
	<label class="pptx-svelte-effects-toggle">
		<input
			type="checkbox"
			checked={effects.outerShadow.enabled}
			onchange={(e) =>
				editor.patchSelected(
					e.currentTarget.checked
						? enableOuterShadowPatch(el, effects.outerShadow)
						: disableOuterShadowPatch(el),
				)}
		/>
		<span>{t('pptx.effects.outerShadow')}</span>
	</label>
	{#if effects.outerShadow.enabled}
		<div class="pptx-svelte-effects-fields">
			<label>{t('pptx.effects.color')}<input type="color" value={effects.outerShadow.color} onchange={(e) => editor.patchSelected(updateOuterShadowPatch(el, { color: e.currentTarget.value }))} /></label>
			<label>{t('pptx.effects.opacityPercent', { value: Math.round(effects.outerShadow.opacity * 100) })}<input type="range" min="0" max="100" value={Math.round(effects.outerShadow.opacity * 100)} oninput={(e) => editor.patchSelected(updateOuterShadowPatch(el, { opacity: Number(e.currentTarget.value) / 100 }))} /></label>
			<label>{t('pptx.effects.blur')}<input type="number" min="0" max="96" value={Math.round(effects.outerShadow.blur)} onchange={(e) => editor.patchSelected(updateOuterShadowPatch(el, { blur: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.angle')}<input type="number" min="0" max="359" value={Math.round(effects.outerShadow.angle)} onchange={(e) => editor.patchSelected(updateOuterShadowPatch(el, { angle: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.distance')}<input type="number" min="0" max="200" value={Math.round(effects.outerShadow.distance)} onchange={(e) => editor.patchSelected(updateOuterShadowPatch(el, { distance: Number(e.currentTarget.value) }))} /></label>
			<label class="pptx-svelte-effects-check">
				<input type="checkbox" checked={effects.outerShadow.rotateWithShape} onchange={(e) => editor.patchSelected(updateOuterShadowPatch(el, { rotateWithShape: e.currentTarget.checked }))} />
				<!-- No dedicated i18n key yet (see report); plain text mirrors React's own unlocalised label. -->
				<span>Rotate with Shape</span>
			</label>
		</div>
	{/if}

	<!-- Inner Shadow -->
	<label class="pptx-svelte-effects-toggle">
		<input
			type="checkbox"
			checked={effects.innerShadow.enabled}
			onchange={(e) =>
				editor.patchSelected(
					e.currentTarget.checked
						? enableInnerShadowPatch(el, effects.innerShadow)
						: disableInnerShadowPatch(el),
				)}
		/>
		<span>{t('pptx.effects.innerShadow')}</span>
	</label>
	{#if effects.innerShadow.enabled}
		<div class="pptx-svelte-effects-fields">
			<label>{t('pptx.effects.color')}<input type="color" value={effects.innerShadow.color} onchange={(e) => editor.patchSelected(updateInnerShadowPatch(el, { color: e.currentTarget.value }))} /></label>
			<label>{t('pptx.effects.opacityPercent', { value: Math.round(effects.innerShadow.opacity * 100) })}<input type="range" min="0" max="100" value={Math.round(effects.innerShadow.opacity * 100)} oninput={(e) => editor.patchSelected(updateInnerShadowPatch(el, { opacity: Number(e.currentTarget.value) / 100 }))} /></label>
			<label>{t('pptx.effects.blur')}<input type="number" min="0" max="96" value={Math.round(effects.innerShadow.blur)} onchange={(e) => editor.patchSelected(updateInnerShadowPatch(el, { blur: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.offsetX')}<input type="number" min="-96" max="96" value={Math.round(effects.innerShadow.offsetX)} onchange={(e) => editor.patchSelected(updateInnerShadowPatch(el, { offsetX: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.offsetY')}<input type="number" min="-96" max="96" value={Math.round(effects.innerShadow.offsetY)} onchange={(e) => editor.patchSelected(updateInnerShadowPatch(el, { offsetY: Number(e.currentTarget.value) }))} /></label>
		</div>
	{/if}

	<!-- Glow -->
	<label class="pptx-svelte-effects-toggle">
		<input
			type="checkbox"
			checked={effects.glow.enabled}
			onchange={(e) =>
				editor.patchSelected(
					e.currentTarget.checked ? enableGlowPatch(el, effects.glow) : disableGlowPatch(el),
				)}
		/>
		<span>{t('pptx.effects.glow')}</span>
	</label>
	{#if effects.glow.enabled}
		<div class="pptx-svelte-effects-fields">
			<label>{t('pptx.effects.color')}<input type="color" value={effects.glow.color} onchange={(e) => editor.patchSelected(updateGlowPatch(el, { color: e.currentTarget.value }))} /></label>
			<label>{t('pptx.effects.radius')}<input type="number" min="0" max="96" value={Math.round(effects.glow.radius)} onchange={(e) => editor.patchSelected(updateGlowPatch(el, { radius: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.opacityPercent', { value: Math.round(effects.glow.opacity * 100) })}<input type="range" min="0" max="100" value={Math.round(effects.glow.opacity * 100)} oninput={(e) => editor.patchSelected(updateGlowPatch(el, { opacity: Number(e.currentTarget.value) / 100 }))} /></label>
		</div>
	{/if}

	<!-- Reflection -->
	<label class="pptx-svelte-effects-toggle">
		<input
			type="checkbox"
			checked={effects.reflection.enabled}
			onchange={(e) =>
				editor.patchSelected(
					e.currentTarget.checked
						? enableReflectionPatch(el, effects.reflection)
						: disableReflectionPatch(el),
				)}
		/>
		<span>{t('pptx.effects.reflection')}</span>
	</label>
	{#if effects.reflection.enabled}
		<div class="pptx-svelte-effects-fields">
			<label>{t('pptx.effects.blur')}<input type="number" min="0" max="96" value={Math.round(effects.reflection.blurRadius)} onchange={(e) => editor.patchSelected(updateReflectionPatch(el, { blurRadius: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.startPercent')}<input type="number" min="0" max="100" value={Math.round(effects.reflection.startOpacity)} onchange={(e) => editor.patchSelected(updateReflectionPatch(el, { startOpacity: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.endPercent')}<input type="number" min="0" max="100" value={Math.round(effects.reflection.endOpacity)} onchange={(e) => editor.patchSelected(updateReflectionPatch(el, { endOpacity: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.distance')}<input type="number" min="0" max="96" value={Math.round(effects.reflection.distance)} onchange={(e) => editor.patchSelected(updateReflectionPatch(el, { distance: Number(e.currentTarget.value) }))} /></label>
			<label>{t('pptx.effects.direction')}<input type="number" min="0" max="359" value={Math.round(effects.reflection.direction)} onchange={(e) => editor.patchSelected(updateReflectionPatch(el, { direction: Number(e.currentTarget.value) }))} /></label>
		</div>
	{/if}

	<!-- Soft Edge -->
	<label class="pptx-svelte-effects-toggle">
		<input
			type="checkbox"
			checked={effects.softEdge.enabled}
			onchange={(e) =>
				editor.patchSelected(
					e.currentTarget.checked
						? enableSoftEdgePatch(el, effects.softEdge.radius || 2.5)
						: disableSoftEdgePatch(el),
				)}
		/>
		<span>{t('pptx.effects.softEdge')}</span>
	</label>
	{#if effects.softEdge.enabled}
		<div class="pptx-svelte-effects-fields">
			<label>{t('pptx.effects.radius')}<input type="number" min="0" max="96" step="0.5" value={effects.softEdge.radius} onchange={(e) => editor.patchSelected(enableSoftEdgePatch(el, Number(e.currentTarget.value)))} /></label>
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-effects {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 6px;
	}

	.pptx-svelte-effects-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 8px;
		cursor: pointer;
	}

	.pptx-svelte-effects-fields {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-left: 4px;
	}

	.pptx-svelte-effects-fields label {
		display: grid;
		gap: 3px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	.pptx-svelte-effects-check {
		grid-column: 1 / -1;
		display: flex !important;
		flex-direction: row !important;
		align-items: center;
		gap: 6px;
	}

	.pptx-svelte-effects-fields input:not([type='checkbox']) {
		height: 26px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #0f172a);
		color: inherit;
	}
</style>
