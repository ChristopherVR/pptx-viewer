<script lang="ts">
	/**
	 * SlideSizeSection: SLIDE SIZE card, the Svelte port of Vue's `SlideSizeCard`
	 * (React `inspector/PresentationSettingsCards.tsx`).
	 *
	 * Three controls over one selection: PowerPoint's preset dropdown, its
	 * Landscape/Portrait toggle, and the raw W/H pixel inputs. The selection
	 * itself is decided by the shared `resolveSlideSizeSelection`, so the EMU
	 * size wins whenever it still agrees with the pixels (Ledger is 12179300 EMU
	 * = 1278.5px, and a pixel round-trip would cost the deck its preset
	 * identity) and the pixels win once the user has typed into W/H.
	 */
	import type {
		CanvasSize,
		SlideSizeEmu,
		SlideSizeOrientation,
		SlideSizeRescaleMode,
	} from 'pptx-viewer-shared';
	import {
		resolveSlideSizeSelection,
		SLIDE_SIZE_PRESETS,
		slideSizeFromPreset,
		withSlideSizeOrientation,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import SlideSizeRescalePrompt from './SlideSizeRescalePrompt.svelte';

	const {
		canvasSize,
		slideSize,
		canEdit = true,
		hasContent = false,
		onupdate,
		onupdateslidesize,
	}: {
		canvasSize: CanvasSize;
		/** The deck's `p:sldSz`, when one has been loaded or picked. */
		slideSize?: SlideSizeEmu | undefined;
		canEdit?: boolean;
		/** Whether any slide has at least one element; gates the rescale prompt. */
		hasContent?: boolean;
		onupdate: (size: CanvasSize) => void;
		onupdateslidesize?: (size: SlideSizeEmu, rescaleMode?: SlideSizeRescaleMode) => void;
	} = $props();
	const t = useTranslator();

	/**
	 * PowerPoint's Maximize/Ensure Fit prompt: held here rather than applied
	 * immediately whenever the picked size differs from the current one AND the
	 * deck actually has content to rescale. An empty deck (or a size that
	 * happens to match already) applies directly, matching today's behaviour.
	 */
	let pendingSize = $state<SlideSizeEmu | null>(null);

	/** Whether two EMU sizes differ, ignoring `type` (a preset id carries no geometry of its own). */
	function sizesDiffer(a: SlideSizeEmu, b: SlideSizeEmu): boolean {
		return a.widthEmu !== b.widthEmu || a.heightEmu !== b.heightEmu;
	}

	function applyOrPromptSize(nextSize: SlideSizeEmu): void {
		if (hasContent && sizesDiffer(selection.size, nextSize)) {
			pendingSize = nextSize;
			return;
		}
		onupdateslidesize?.(nextSize);
	}

	function chooseRescale(mode: SlideSizeRescaleMode): void {
		if (!pendingSize) {
			return;
		}
		onupdateslidesize?.(pendingSize, mode);
		pendingSize = null;
	}

	const FIELDS = [
		['W', 'width'],
		['H', 'height'],
	] as const;

	/** The value the `<option>` list uses for "no preset matches this size". */
	const CUSTOM_VALUE = '__custom__';

	const ORIENTATIONS: readonly (readonly [SlideSizeOrientation, string])[] = [
		['landscape', 'pptx.slideSize.landscape'],
		['portrait', 'pptx.slideSize.portrait'],
	];

	const selection = $derived(resolveSlideSizeSelection({ current: slideSize, canvas: canvasSize }));
	const presetValue = $derived(selection.preset?.labelKey ?? CUSTOM_VALUE);

	function commit(key: 'width' | 'height', raw: string): void {
		const value = Number(raw);
		if (!Number.isFinite(value)) {
			return;
		}
		onupdate({ ...canvasSize, [key]: value });
	}

	function pickPreset(labelKey: string): void {
		const preset = SLIDE_SIZE_PRESETS.find((entry) => entry.labelKey === labelKey);
		if (!preset) {
			return;
		}
		applyOrPromptSize(slideSizeFromPreset(preset, selection.orientation));
	}

	function pickOrientation(orientation: SlideSizeOrientation): void {
		applyOrPromptSize(withSlideSizeOrientation(selection.size, orientation));
	}
</script>

{#if onupdateslidesize}
	<label class="pptx-svelte-slide-size-preset">
		<span>{t('pptx.slideSize.presets')}</span>
		<select
			aria-label={t('pptx.slideSize.presets')}
			data-pptx-slide-size-preset
			disabled={!canEdit}
			value={presetValue}
			onchange={(event) => pickPreset(event.currentTarget.value)}
		>
			{#if selection.preset === undefined}
				<option value={CUSTOM_VALUE}>{t('pptx.slideSize.customSize')}</option>
			{/if}
			{#each SLIDE_SIZE_PRESETS as preset (preset.labelKey)}
				<option value={preset.labelKey}>{t(`pptx.slideSize.preset.${preset.labelKey}`)}</option>
			{/each}
		</select>
	</label>
	<div
		class="pptx-svelte-slide-size-orientation"
		role="group"
		aria-label={t('pptx.slideSize.orientation')}
	>
		{#each ORIENTATIONS as [value, labelKey] (value)}
			<button
				type="button"
				data-pptx-slide-size-orientation={value}
				aria-pressed={selection.orientation === value}
				class:active={selection.orientation === value}
				disabled={!canEdit}
				onclick={() => pickOrientation(value)}
			>
				{t(labelKey)}
			</button>
		{/each}
	</div>
{#if pendingSize}
	<SlideSizeRescalePrompt onchoose={chooseRescale} />
{/if}
{/if}
<div class="pptx-svelte-slide-size">
	{#each FIELDS as [label, key] (key)}
		<label>
			<span>{label}</span>
			<input
				type="number"
				aria-label={`${t('pptx.slideSize.title')} ${label}`}
				disabled={!canEdit}
				value={canvasSize[key]}
				oninput={(event) => commit(key, event.currentTarget.value)}
			/>
		</label>
	{/each}
</div>

<style>
	.pptx-svelte-slide-size {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	.pptx-svelte-slide-size-preset {
		display: grid;
		gap: 4px;
		margin-bottom: 8px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	.pptx-svelte-slide-size-preset select {
		width: 100%;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, inherit);
	}

	.pptx-svelte-slide-size-orientation {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
		margin-bottom: 8px;
	}

	.pptx-svelte-slide-size-orientation button {
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font-size: 11px;
	}

	.pptx-svelte-slide-size-orientation button.active {
		border-color: var(--pptx-primary, #c43b32);
		background: var(--pptx-primary, #c43b32);
		color: #fff;
	}

	.pptx-svelte-slide-size-orientation button:disabled {
		opacity: 0.5;
	}

	label {
		display: flex;
		align-items: center;
		gap: 5px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	input {
		min-width: 0;
		width: 100%;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}
</style>
