<script lang="ts">
	/**
	 * CropControls: the Home tab Arrange group's "Crop" toggle plus its
	 * dropdown (Crop to Aspect Ratio presets, Fill, Fit), PowerPoint's Picture
	 * Format > Crop split button. The toggle enters / commits the on-canvas
	 * crop mode (`editor.cropOps`); every menu entry is one shared
	 * `picture-crop` computation applied as one undoable update.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import {
		CROP_ASPECT_GROUP_LABEL_KEYS,
		CROP_ASPECT_LABEL_KEY,
		CROP_ASPECT_PRESETS,
		CROP_FILL_LABEL_KEY,
		CROP_FIT_LABEL_KEY,
		CROP_LABEL_KEY,
		cropFill,
		cropFit,
		cropToAspectRatio,
	} from 'pptx-viewer-shared';
	import type { CropAspectPreset, CropElementUpdate, NaturalImageSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup, refocusViewerRoot } from '../anchored-popup';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	let open = $state(false);
	// eslint-disable-next-line prefer-const
	let anchor: HTMLElement | undefined = $state();

	const cropping = $derived(editor.cropOps.active);
	const enabled = $derived(cropping || editor.cropOps.canCrop);
	const title = $derived(enabled ? t(CROP_LABEL_KEY) : t('pptx.image.cropHint'));
	$effect(() => {
		if (!enabled) {
			open = false;
		}
	});

	// Consecutive presets of one group sit under that group's heading.
	const GROUPS = (['square', 'portrait', 'landscape'] as const).map((group) => ({
		group,
		presets: CROP_ASPECT_PRESETS.filter((preset) => preset.group === group),
	}));

	/** The rendered bitmap's natural size, when its <img> is on the canvas. */
	function naturalSizeOf(element: PptxElement): NaturalImageSize | undefined {
		const img =
			typeof document === 'undefined'
				? null
				: document.querySelector<HTMLImageElement>(
						`[data-element-id="${CSS.escape(element.id)}"] img`,
					);
		return img && img.naturalWidth > 0 && img.naturalHeight > 0
			? { width: img.naturalWidth, height: img.naturalHeight }
			: undefined;
	}

	function apply(compute: (element: PptxElement) => CropElementUpdate): void {
		open = false;
		refocusViewerRoot(anchor);
		const element = editor.selectedElement;
		if (element) {
			editor.cropOps.applyOnce(compute(element));
		}
	}

	const aspect = (preset: CropAspectPreset): void =>
		apply((el) => cropToAspectRatio(el, preset.ratioWidth, preset.ratioHeight));

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}
</script>

<div class="pptx-svelte-crop" bind:this={anchor} onfocusout={onFocusOut}>
	<button
		type="button"
		data-pptx-ribbon-control="crop"
		class:pptx-svelte-crop-on={cropping}
		disabled={!enabled}
		aria-pressed={cropping}
		aria-label={t(CROP_LABEL_KEY)}
		{title}
		onclick={() => editor.cropOps.toggle()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1v11h11M1 4h11v11" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		<span>{t(CROP_LABEL_KEY)}</span>
	</button>
	<button
		type="button"
		class="pptx-svelte-crop-caret"
		data-pptx-ribbon-control="crop-menu"
		disabled={!enabled}
		aria-haspopup="menu"
		aria-expanded={open}
		aria-label={t(CROP_ASPECT_LABEL_KEY)}
		title={enabled ? t(CROP_ASPECT_LABEL_KEY) : t('pptx.image.cropHint')}
		onclick={() => (open = !open)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	{#if open}
		<div class="pptx-svelte-crop-pop" role="menu" aria-label={t(CROP_ASPECT_LABEL_KEY)} use:anchoredPopup={{ anchor }}>
			<div class="pptx-svelte-crop-title">{t(CROP_ASPECT_LABEL_KEY)}</div>
			{#each GROUPS as entry (entry.group)}
				<div class="pptx-svelte-crop-heading" role="presentation">{t(CROP_ASPECT_GROUP_LABEL_KEYS[entry.group])}</div>
				{#each entry.presets as preset (preset.id)}
					<button type="button" role="menuitem" data-pptx-crop-aspect={preset.id} onclick={() => aspect(preset)}>{preset.id}</button>
				{/each}
			{/each}
			<div class="pptx-svelte-crop-sep" role="separator"></div>
			<button type="button" role="menuitem" data-pptx-crop-action="fill" onclick={() => apply((el) => cropFill(el, naturalSizeOf(el)))}>{t(CROP_FILL_LABEL_KEY)}</button>
			<button type="button" role="menuitem" data-pptx-crop-action="fit" onclick={() => apply((el) => cropFit(el, naturalSizeOf(el)))}>{t(CROP_FIT_LABEL_KEY)}</button>
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-crop {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.pptx-svelte-crop button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 26px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-crop button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-crop button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-crop .pptx-svelte-crop-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-crop svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-crop .pptx-svelte-crop-caret {
		padding: 0 3px;
	}

	.pptx-svelte-crop .pptx-svelte-crop-caret svg {
		width: 9px;
		height: 9px;
	}

	.pptx-svelte-crop-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		display: flex;
		min-width: 150px;
		max-height: 70vh;
		overflow-y: auto;
		flex-direction: column;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-crop-pop button {
		width: 100%;
		padding: 5px 10px 5px 18px;
		text-align: left;
	}

	.pptx-svelte-crop-title,
	.pptx-svelte-crop-heading {
		padding: 5px 10px 2px;
		font-size: 10.5px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-crop-title {
		font-weight: 600;
	}

	.pptx-svelte-crop-sep {
		height: 1px;
		margin: 4px 0;
		background: var(--pptx-border, #33334d);
	}
</style>
