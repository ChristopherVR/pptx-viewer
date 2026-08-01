<script lang="ts">
	/**
	 * The presenter console's control strip.
	 *
	 * Every slot, its order, its accessible-name key and its icon come from
	 * `pptx-viewer-shared`'s `PRESENTER_CONSOLE_CONTROLS`, so this binding cannot
	 * drift from the other four. The strip this replaced hard-coded English
	 * ("Pause", "All slides", "Zoom -", "B", "Captions", "End"), was untranslatable
	 * in every locale, and was missing the reset-zoom and swap-displays slots
	 * entirely.
	 *
	 * Measurements arrive as CSS custom properties on the console root, because a
	 * Svelte scoped style block is compiled ahead of time and cannot read a
	 * TypeScript value; same seam `PresentationToolbar.svelte` uses for
	 * `presentToolbarStyleAttr()`. Custom properties inherit, so this component
	 * reads the vars its parent set without needing them re-applied here.
	 */
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import Captions from '@lucide/svelte/icons/captions';
	import CirclePause from '@lucide/svelte/icons/circle-pause';
	import CirclePlay from '@lucide/svelte/icons/circle-play';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Grid2x2 from '@lucide/svelte/icons/grid-2x2';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import Monitor from '@lucide/svelte/icons/monitor';
	import MonitorOff from '@lucide/svelte/icons/monitor-off';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import PenTool from '@lucide/svelte/icons/pen-tool';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Scan from '@lucide/svelte/icons/scan';
	import X from '@lucide/svelte/icons/x';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import { PRESENTER_CONSOLE_CONTROLS, PRESENTER_LAYOUT_METRICS } from 'pptx-viewer-shared';
	import type { PresentationSnapshot } from 'pptx-viewer-shared';
	import type { Component } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import { presenterControlActive, presenterControlDisabled } from './presenter-console-strip';

	const {
		snapshot,
		audienceOpen,
		onselect,
	}: {
		snapshot: PresentationSnapshot;
		audienceOpen: boolean;
		/** Fired with the shared control id; the console owns what each one does. */
		onselect: (controlId: string) => void;
	} = $props();

	const t = useTranslator();

	/** Shared inventory icon name (kebab-case) -> Lucide component. */
	const ICONS: Record<string, Component> = {
		'arrow-left-right': ArrowLeftRight,
		captions: Captions,
		'circle-pause': CirclePause,
		'circle-play': CirclePlay,
		eraser: Eraser,
		'grid-2x2': Grid2x2,
		highlighter: Highlighter,
		monitor: Monitor,
		'monitor-off': MonitorOff,
		'mouse-pointer-2': MousePointer2,
		'pen-tool': PenTool,
		'rotate-ccw': RotateCcw,
		scan: Scan,
		x: X,
		'zoom-in': ZoomIn,
		'zoom-out': ZoomOut,
	};

	const iconSize = PRESENTER_LAYOUT_METRICS.controlIconSize;
	const state = $derived({ snapshot, audienceOpen });
</script>

<!--
	`data-pptx-presenter-strip` is the scoping hook. The rail's controls carry the
	same `data-pptx-presenter-control` attribute (all five bindings share one
	attribute so a framework-neutral spec can query one selector), so anything
	asserting the STRIP's inventory or its order must scope to this root rather
	than sweeping the document.
-->
<div
	class="pptx-svelte-presenter-strip"
	data-pptx-presenter-strip
	role="toolbar"
	aria-label={t('pptx.presenter.presenterView')}
>
	{#each PRESENTER_CONSOLE_CONTROLS as control (control.id)}
		{#if control.kind === 'divider'}
			<span class="pptx-svelte-presenter-divider" data-pptx-presenter-control={control.id}></span>
		{:else if control.kind === 'spacer'}
			<span class="pptx-svelte-presenter-spacer" data-pptx-presenter-control={control.id}></span>
		{:else}
			{@const active = presenterControlActive(control.id, state)}
			{@const labelKey = (active ? control.activeLabelKey : undefined) ?? control.labelKey}
			{@const label = labelKey === undefined ? '' : t(labelKey)}
			{@const iconName = (active ? control.activeIcon : undefined) ?? control.icon}
			{@const Icon = iconName === undefined ? undefined : ICONS[iconName]}
			<button
				type="button"
				class="pptx-svelte-presenter-control"
				class:active={active && control.kind === 'toggle'}
				data-pptx-presenter-control={control.id}
				aria-label={label}
				title={label}
				aria-pressed={control.kind === 'toggle' ? active : undefined}
				disabled={presenterControlDisabled(control.id, state)}
				onclick={() => onselect(control.id)}
			>
				{#if Icon}<Icon size={iconSize} aria-hidden="true" />{/if}
				<!-- PowerPoint's literal B / W screen switches. The glyph is decoration:
				     the accessible name above stays the translated "Black Screen", or a
				     screen reader announces the control as the letter "B". -->
				{#if control.glyph}<span aria-hidden="true">{control.glyph}</span>{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.pptx-svelte-presenter-strip {
		display: flex;
		flex-wrap: wrap;
		flex-shrink: 0;
		align-items: center;
		gap: var(--pptx-pv-strip-gap);
		padding: var(--pptx-pv-strip-pad-y) var(--pptx-pv-strip-pad-x);
		border-bottom: 1px solid var(--pptx-border, #ffffff1a);
		background: var(--pptx-card, #020617);
	}

	.pptx-svelte-presenter-control {
		display: inline-flex;
		min-width: var(--pptx-pv-control);
		height: var(--pptx-pv-control);
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 0 8px;
		border: 0;
		border-radius: var(--pptx-pv-control-radius);
		background: var(--pptx-secondary, #334155);
		color: inherit;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}

	.pptx-svelte-presenter-control:hover:not(:disabled) {
		background: var(--pptx-accent, #475569);
	}

	.pptx-svelte-presenter-control.active {
		background: var(--pptx-primary, #38bdf8);
		color: var(--pptx-primary-foreground, #082f49);
	}

	.pptx-svelte-presenter-control:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-presenter-divider {
		width: var(--pptx-pv-divider-w);
		height: var(--pptx-pv-divider-h);
		margin: 0 var(--pptx-pv-divider-mx);
		background: var(--pptx-border, #334155);
	}

	.pptx-svelte-presenter-spacer {
		flex: 1;
	}
</style>
