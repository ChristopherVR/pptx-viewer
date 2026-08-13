<script lang="ts">
	/**
	 * MotionPathRow: the animation panel's motion-path row (Svelte port of
	 * React's `inspector/MotionPathRow.tsx`). Pick a catalogue path, clear it, or
	 * see that the applied path was hand-dragged.
	 *
	 * WHY the extra "Custom Path" option: dragging the end handle on the canvas
	 * produces geometry that matches no catalogue entry any more. Without this
	 * option the select would snap back to whichever preset the path started
	 * from, misreporting what will actually play; re-selecting it is a no-op
	 * rather than a reset, so the row can never silently discard a drag.
	 */
	import {
		MOTION_PATH_FAMILIES,
		motionPathFamilyLabelKey,
		motionPathPresetIdForPath,
		motionPathPresetLabelKey,
		motionPathPresetsByFamily,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		motionPath,
		canEdit,
		onchange,
	}: {
		/** The path currently applied to the selected element, if any. */
		motionPath: string | undefined;
		canEdit: boolean;
		/** Receives a catalogue preset id, `'none'` to clear, or `'custom'`. */
		onchange: (presetId: string) => void;
	} = $props();

	const t = useTranslator();

	const presetId = $derived(motionPathPresetIdForPath(motionPath));
	const isCustom = $derived(Boolean(motionPath) && !presetId);
	const value = $derived(isCustom ? 'custom' : (presetId ?? 'none'));
</script>

<label class="pptx-svelte-motionpath-row">
	<span>{t('pptx.animation.motionPath.label')}</span>
	<select
		aria-label={t('pptx.animation.motionPath.label')}
		class="pptx-svelte-animp-motionpath"
		disabled={!canEdit}
		{value}
		onchange={(event) => onchange(event.currentTarget.value)}
	>
		<option value="none">{t('pptx.animation.motionPath.none')}</option>
		{#if isCustom}<option value="custom">{t('pptx.animation.motionPath.custom')}</option>{/if}
		{#each MOTION_PATH_FAMILIES as family (family)}
			<optgroup label={t(motionPathFamilyLabelKey(family))}>
				{#each motionPathPresetsByFamily(family) as preset (preset.id)}
					<option value={preset.id}>{t(motionPathPresetLabelKey(preset.id))}</option>
				{/each}
			</optgroup>
		{/each}
	</select>
	{#if motionPath}
		<small>{t('pptx.animation.motionPath.editHint')}</small>
	{/if}
</label>

<style>
	/* Matches the sibling rows in AnimationPanel, which are scoped there. */
	.pptx-svelte-motionpath-row {
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.pptx-svelte-motionpath-row > span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-motionpath-row select {
		width: 100%;
		height: 26px;
		box-sizing: border-box;
		padding: 0 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-motionpath-row small {
		font-size: 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
