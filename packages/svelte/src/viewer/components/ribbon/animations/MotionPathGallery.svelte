<script lang="ts">
	/**
	 * MotionPathGallery: the Animations tab's motion-path gallery (Svelte port of
	 * React's `toolbar/MotionPathGallery.tsx`), offering PowerPoint's Lines /
	 * Arcs / Turns / Shapes / Loops families with every path as a real button.
	 *
	 * WHY it is a sibling of the entrance/emphasis/exit gallery rather than a
	 * fourth column of it: a motion path is not one of those three buckets, it is
	 * geometry that coexists with them on the SAME animation entry. Folding it
	 * into the preset columns would imply an either/or choice the model does not
	 * make, and clicking a path would then look like it replaced the entrance.
	 *
	 * The catalogue, the label keys and the apply mutation all come from
	 * `pptx-viewer-shared`, so every binding's gallery lists the same paths under
	 * the same accessible names (an e2e spec diffs them against React).
	 */
	import {
		MOTION_PATH_FAMILIES,
		motionPathFamilyLabelKey,
		motionPathPresetLabelKey,
		motionPathPresetsByFamily,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';

	const {
		disabled,
		onapply,
	}: {
		disabled: boolean;
		/** Applies a catalogue motion path to the selected element by preset id. */
		onapply?: (presetId: string) => void;
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-motionpaths" aria-label={t('pptx.animations.motionPathGalleryAria')}>
	{#each MOTION_PATH_FAMILIES as family (family)}
		<div class="pptx-svelte-motionpaths-family">
			<span class="pptx-svelte-motionpaths-label">{t(motionPathFamilyLabelKey(family))}</span>
			<div class="pptx-svelte-motionpaths-row">
				{#each motionPathPresetsByFamily(family) as preset (preset.id)}
					<button
						type="button"
						{disabled}
						title={t(motionPathPresetLabelKey(preset.id))}
						onclick={() => onapply?.(preset.id)}
					>
						<!-- Decorative arrow only: the button's accessible name must stay
						     exactly the preset label, byte for byte with React's. -->
						<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h11M11 6.5 14.5 10 11 13.5" /></svg>
						<span>{t(motionPathPresetLabelKey(preset.id))}</span>
					</button>
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	/*
	 * `max-width: 420px` + `overflow-x: auto` matches the cap React applies to
	 * the RibbonGroup that wraps `MotionPathGallery` (`max-w-[420px]
	 * overflow-hidden`). Without a width cap here, the five family columns
	 * (Lines/Arcs/Turns/Shapes/Loops) laid out in a single un-wrapped row could
	 * run past 800px, pushing the Advanced Animation and Timing groups after it
	 * off the ribbon's visible row (reachable only via a second, easy-to-miss
	 * nested horizontal scrollbar: the reported Animations-tab clipping).
	 * `overflow-x: auto` (rather than React's `overflow-hidden` on its
	 * wrapper) keeps every family reachable via a small scrollbar instead of
	 * silently hiding the columns a hard clip would cut off.
	 */
	.pptx-svelte-motionpaths {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		max-width: 420px;
		max-height: 62px;
		overflow-x: auto;
		overflow-y: auto;
		padding: 2px 4px;
		border: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--pptx-muted, #2a2a3d) 40%, transparent);
	}

	.pptx-svelte-motionpaths-family {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.pptx-svelte-motionpaths-label {
		font-size: 9px;
		font-weight: 600;
		line-height: 12px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-motionpaths-row {
		display: flex;
		flex-wrap: wrap;
		gap: 2px;
		max-width: 150px;
	}

	.pptx-svelte-motionpaths-row button {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 1px 4px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 9px;
		line-height: 12px;
		white-space: nowrap;
	}

	.pptx-svelte-motionpaths-row button svg {
		width: 10px;
		height: 10px;
		fill: none;
		stroke: #0ea5e9;
		stroke-width: 1.6;
	}

	.pptx-svelte-motionpaths-row button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-motionpaths-row button:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
