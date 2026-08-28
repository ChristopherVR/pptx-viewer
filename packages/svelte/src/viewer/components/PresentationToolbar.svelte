<script lang="ts">
	/**
	 * The slide-show toolbar: the floating, auto-hiding bar at the bottom centre
	 * of a running show.
	 *
	 * It replaces the bottom-right annotation strip this binding used to render,
	 * which offered five raw untranslated tool buttons and no navigation, no
	 * counter, no timer and (on a desktop, where the touch controls are hidden)
	 * no way out of the show at all. The inventory, order and measurements now
	 * come from `pptx-viewer-shared`'s `present-chrome` module, which React, Vue,
	 * Angular and Vanilla derive their bars from too.
	 *
	 * The metrics arrive as CSS custom properties on an inline `style` attribute
	 * because a Svelte scoped style block is compiled ahead of time and cannot
	 * read a TypeScript value; this is the same seam `TitleBar.svelte` uses.
	 * (Do not write the literal style tag in this comment: svelte2tsx, which
	 * `svelte-check` runs on, scans for it textually and would decide the script
	 * block ends here.)
	 */
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Eraser from '@lucide/svelte/icons/eraser';
	import Highlighter from '@lucide/svelte/icons/highlighter';
	import MousePointer2 from '@lucide/svelte/icons/mouse-pointer-2';
	import PanelRight from '@lucide/svelte/icons/panel-right';
	import PenTool from '@lucide/svelte/icons/pen-tool';
	import Presentation from '@lucide/svelte/icons/presentation';
	import Timer from '@lucide/svelte/icons/timer';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import {
		formatElapsed,
		formatSlideCounter,
		HIGHLIGHTER_COLORS,
		isBlackboardActive,
		PEN_COLORS,
		PRESENT_TOOLBAR_METRICS,
		presentToolbarStyleAttr,
		toggleBlackboard,
	} from 'pptx-viewer-shared';
	import type { PresentationBlackout } from 'pptx-viewer-shared';
	import type { Component } from 'svelte';

	import { useTranslator } from '../../i18n/context';
	import type { PresentationAnnotations } from '../presentation/presentation-annotations.svelte';
	import type { PresentPaletteKey } from './presentation-toolbar.svelte';
	import { PresentToolbarChrome } from './presentation-toolbar.svelte';

	const {
		annotations,
		chrome = new PresentToolbarChrome(),
		current,
		total,
		presenterMode,
		blackout = 'none',
		onblackoutchange,
		onmove,
		onpresenterview,
		onexit,
		popupToolbarEnabled = true,
	}: {
		annotations: PresentationAnnotations;
		/**
		 * Fade / auto-hide state. Injected by the viewer so PowerPoint's Ctrl+H can
		 * reach the SAME flag from the show's key handler; the default keeps this
		 * component usable on its own (and in its own tests).
		 */
		chrome?: PresentToolbarChrome;
		/** Zero-based index of the slide on screen. */
		current: number;
		total: number;
		presenterMode: boolean;
		/** The show's blackout state, mirrored from the presenter snapshot. */
		blackout?: PresentationBlackout;
		/** Route a blackout change back to the presenter session's snapshot. */
		onblackoutchange?: (value: PresentationBlackout) => void;
		/** Step the show forward (1) or back (-1). */
		onmove: (direction: 1 | -1) => void;
		onpresenterview: () => void;
		onexit: () => void;
		/** File > Options > Advanced > "Show popup toolbar" (default true). */
		popupToolbarEnabled?: boolean;
	} = $props();

	const t = useTranslator();
	const metricVars = presentToolbarStyleAttr();
	const icon = PRESENT_TOOLBAR_METRICS.iconSize;

	// bind:this writes these (invisible to the linter's prefer-const analysis).
	// eslint-disable-next-line prefer-const
	let wrapperEl = $state<HTMLDivElement | undefined>(undefined);
	// eslint-disable-next-line prefer-const
	let toolbarEl = $state<HTMLDivElement | undefined>(undefined);

	$effect(() =>
		chrome.attach({
			// `offsetParent` IS the positioned show surface the bar is absolutely
			// placed against, so the trigger zone needs no prop drilling.
			getContainer: () => (wrapperEl?.offsetParent as HTMLElement | null) ?? null,
			getToolbar: () => toolbarEl ?? null,
			popupToolbarEnabled: () => popupToolbarEnabled,
		}),
	);

	/** Choose a tool, or disarm it when it is already active (PowerPoint's toggle). */
	function chooseTool(tool: 'pen' | 'highlighter' | 'eraser' | 'laser'): void {
		annotations.tool = annotations.tool === tool ? 'none' : tool;
		chrome.closePalettes();
	}

	/** One click on Blackboard arms the black screen + pen together, or disarms both. */
	const blackboardActive = $derived(isBlackboardActive(blackout, annotations.tool));
	function clickBlackboard(): void {
		const next = toggleBlackboard(blackout, annotations.tool);
		annotations.tool = next.tool;
		onblackoutchange?.(next.blackout);
		chrome.closePalettes();
	}

	/** Picking a colour also arms its tool, matching React. */
	function pickColor(key: PresentPaletteKey, color: string): void {
		if (key === 'pen') {
			annotations.penColor = color;
		} else {
			annotations.highlighterColor = color;
		}
		chrome.closePalettes();
		annotations.tool = key;
	}

	/**
	 * Contain pointer traffic: without this a control press would ALSO reach the
	 * stage's click-to-advance handler and skip a slide. It has to be a template
	 * handler, not an action calling `addEventListener`: Svelte 5 delegates
	 * `click`/`pointerdown` from the app root, so a real listener on this
	 * container would stop propagation before the delegated walk ever reached
	 * the button that was actually pressed.
	 */
	function stop(event: Event): void {
		event.stopPropagation();
	}
</script>

{#snippet action(id: string, labelKey: string, Icon: Component, onpress: () => void, disabled = false, danger = false)}
	<button
		type="button"
		class="pptx-svelte-present-button"
		class:danger
		data-pptx-present-control={id}
		{disabled}
		aria-label={t(labelKey)}
		title={t(labelKey)}
		onclick={onpress}
	>
		<Icon size={icon} aria-hidden="true" />
	</button>
{/snippet}

{#snippet toggle(id: string, active: boolean, labelKey: string, Icon: Component, onpress: () => void)}
	<button
		type="button"
		class="pptx-svelte-present-toggle"
		class:active
		data-pptx-present-control={id}
		aria-pressed={active}
		aria-label={t(labelKey)}
		title={t(labelKey)}
		onclick={onpress}
	>
		<Icon size={icon} aria-hidden="true" />
	</button>
{/snippet}

{#snippet tool(id: string, name: 'pen' | 'highlighter' | 'eraser' | 'laser', labelKey: string, Icon: Component, bar?: string)}
	<button
		type="button"
		class="pptx-svelte-present-toggle"
		class:active={annotations.tool === name}
		data-pptx-present-control={id}
		aria-pressed={annotations.tool === name}
		aria-label={t(labelKey)}
		title={t(labelKey)}
		onclick={() => chooseTool(name)}
	>
		<Icon size={icon} aria-hidden="true" />
		{#if bar}<span class="pptx-svelte-present-swatch-bar" style={`background:${bar}`}></span>{/if}
	</button>
{/snippet}

<!--
	The caret and its popover, with NO wrapper of their own: the caller nests
	them in the same `.pptx-svelte-present-colorgroup` as the tool button they
	belong to. That grouping is what centres the popover over the tool+caret
	pair, as React does; anchoring it to the 28px caret alone put it 18px off.
-->
{#snippet palette(key: PresentPaletteKey, colors: readonly string[], selected: string, labelKey: string, valueKey: string)}
	<button
		type="button"
		class="pptx-svelte-present-caret"
		data-pptx-present-control={`${key}-color`}
		aria-expanded={chrome.palette === key}
		aria-label={t(labelKey)}
		title={t(labelKey)}
		onclick={() => chrome.togglePalette(key)}
	>
		<ChevronDown size={PRESENT_TOOLBAR_METRICS.caretIconSize} aria-hidden="true" />
	</button>
	{#if chrome.palette === key}
		<div class="pptx-svelte-present-palette">
			{#each colors as color (color)}
				<button
					type="button"
					class="pptx-svelte-present-swatch"
					class:selected={selected === color}
					style={`background:${color}`}
					aria-label={t(valueKey, { color })}
					onclick={() => pickColor(key, color)}
				></button>
			{/each}
		</div>
	{/if}
{/snippet}

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="pptx-svelte-present-wrapper"
	class:hidden={!chrome.visible}
	style={metricVars}
	bind:this={wrapperEl}
	onmouseenter={() => chrome.enter()}
	onmouseleave={() => chrome.leave()}
>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="pptx-svelte-present-toolbar"
		data-pptx-present-toolbar
		role="toolbar"
		aria-label={t('pptx.toolbar.presentationToolbarAria')}
		tabindex="-1"
		bind:this={toolbarEl}
		onclick={stop}
		onpointerdown={stop}
	>
		{@render action('previous', 'pptx.presenter.previousSlide', ChevronLeft, () => onmove(-1), current === 0)}
		<span class="pptx-svelte-present-counter" data-pptx-present-control="counter">
			{formatSlideCounter(current, total)}
		</span>
		{@render action('next', 'pptx.presenter.nextSlide', ChevronRight, () => onmove(1), current >= total - 1)}
		<div class="pptx-svelte-present-divider" data-pptx-present-control="divider-navigation"></div>
		<div
			class="pptx-svelte-present-timer"
			data-pptx-present-control="timer"
			aria-label={t('pptx.presenter.elapsed')}
			title={t('pptx.presenter.elapsed')}
		>
			<Timer size={PRESENT_TOOLBAR_METRICS.timerIconSize} aria-hidden="true" />
			<span>{formatElapsed(chrome.elapsedMs)}</span>
		</div>
		<div class="pptx-svelte-present-divider" data-pptx-present-control="divider-timer"></div>
		{@render tool('laser', 'laser', 'pptx.presentation.laserPointer', MousePointer2)}
		<div class="pptx-svelte-present-colorgroup">
			{@render tool('pen', 'pen', 'pptx.presentation.pen', PenTool, annotations.penColor)}
			{@render palette('pen', PEN_COLORS, annotations.penColor, 'pptx.presentationToolbar.penColor', 'pptx.presentationToolbar.penColorValue')}
		</div>
		<div class="pptx-svelte-present-colorgroup">
			{@render tool('highlighter', 'highlighter', 'pptx.presentation.highlighter', Highlighter, annotations.highlighterColor)}
			{@render palette('highlighter', HIGHLIGHTER_COLORS, annotations.highlighterColor, 'pptx.presentationToolbar.highlighterColor', 'pptx.presentationToolbar.highlighterColorValue')}
		</div>
		{@render tool('eraser', 'eraser', 'pptx.presentation.eraser', Eraser)}
		{@render toggle('blackboard', blackboardActive, 'pptx.presentation.blackboard', Presentation, clickBlackboard)}
		{@render action('clear', 'pptx.presentation.clearAnnotations', Trash2, () => annotations.clear(), annotations.count === 0)}
		<div class="pptx-svelte-present-divider" data-pptx-present-control="divider-tools"></div>
		{@render toggle('presenter-view', presenterMode, 'pptx.presenter.presenterView', PanelRight, onpresenterview)}
		{@render action('end', 'pptx.presenter.endPresentation', X, onexit, false, true)}
	</div>
</div>

<style>
	.pptx-svelte-present-wrapper { position: absolute; bottom: var(--pptx-pt-bottom); left: 50%; z-index: var(--pptx-pt-z); transform: translateX(-50%); transition: opacity var(--pptx-pt-fade) ease; }
	.pptx-svelte-present-wrapper.hidden { opacity: 0; pointer-events: none; }
	.pptx-svelte-present-toolbar { display: flex; align-items: center; gap: var(--pptx-pt-gap); padding: var(--pptx-pt-pad-y) var(--pptx-pt-pad-x); border: 1px solid var(--pptx-pt-border); border-radius: var(--pptx-pt-radius); background: var(--pptx-pt-bg); box-shadow: 0 25px 50px -12px rgb(0 0 0 / 40%); backdrop-filter: blur(12px); }
	.pptx-svelte-present-button,
	.pptx-svelte-present-toggle { display: flex; align-items: center; justify-content: center; width: var(--pptx-pt-button); height: var(--pptx-pt-button); padding: 0; border: 0; border-radius: var(--pptx-pt-control-radius); background: transparent; color: rgb(255 255 255 / 70%); cursor: pointer; transition: background-color .15s ease, color .15s ease; }
	.pptx-svelte-present-toggle { position: relative; }
	.pptx-svelte-present-button:hover:not(:disabled),
	.pptx-svelte-present-toggle:hover { background: rgb(255 255 255 / 10%); color: #fff; }
	.pptx-svelte-present-toggle.active { background: rgb(255 255 255 / 25%); color: #fff; }
	.pptx-svelte-present-button:disabled { color: rgb(255 255 255 / 20%); cursor: not-allowed; }
	.pptx-svelte-present-button.danger:hover:not(:disabled) { color: #f87171; }
	.pptx-svelte-present-swatch-bar { position: absolute; bottom: 2px; left: 50%; width: var(--pptx-pt-swatch-bar-w); height: var(--pptx-pt-swatch-bar-h); border-radius: 999px; transform: translateX(-50%); }
	.pptx-svelte-present-divider { width: var(--pptx-pt-divider-w); height: var(--pptx-pt-divider-h); margin: 0 var(--pptx-pt-divider-mx); background: var(--pptx-pt-divider-color); }
	.pptx-svelte-present-counter { min-width: var(--pptx-pt-counter-min); padding: 0 6px; color: rgb(255 255 255 / 80%); font: var(--pptx-pt-font-size) / var(--pptx-pt-line-height) ui-monospace, monospace; font-variant-numeric: tabular-nums; text-align: center; user-select: none; }
	.pptx-svelte-present-timer { display: flex; align-items: center; gap: var(--pptx-pt-timer-gap); padding: 0 4px; color: rgb(255 255 255 / 60%); font: var(--pptx-pt-font-size) / var(--pptx-pt-line-height) ui-monospace, monospace; font-variant-numeric: tabular-nums; user-select: none; }
	/* Holds a tool button and its colour caret as one gap-less pair, exactly as
	   React does: it is both what lets the caret overlap the button and what the
	   popover centres itself over. */
	.pptx-svelte-present-colorgroup { position: relative; display: flex; align-items: center; }
	.pptx-svelte-present-caret { display: flex; align-items: center; justify-content: center; width: var(--pptx-pt-caret); height: var(--pptx-pt-button); margin-left: calc(var(--pptx-pt-caret-overlap) * -1); padding: 0; border: 0; border-radius: 0 var(--pptx-pt-control-radius) var(--pptx-pt-control-radius) 0; background: transparent; color: rgb(255 255 255 / 50%); cursor: pointer; }
	.pptx-svelte-present-caret:hover { background: rgb(255 255 255 / 10%); color: #fff; }
	/* `width: max-content` is load-bearing: an abspos grid shrink-to-fits its
	   positioned ancestor (the 64px tool+caret pair), squeezing the four 36px
	   swatch columns into 50px until they overlap and cannot be clicked. */
	.pptx-svelte-present-palette { position: absolute; width: max-content; bottom: 100%; left: 50%; display: grid; grid-template-columns: repeat(var(--pptx-pt-palette-cols), auto); gap: var(--pptx-pt-palette-gap); margin-bottom: 8px; padding: var(--pptx-pt-palette-pad); border: 1px solid rgb(255 255 255 / 20%); border-radius: 8px; background: #262626; box-shadow: 0 20px 25px -5px rgb(0 0 0 / 40%); transform: translateX(-50%); }
	.pptx-svelte-present-swatch { width: var(--pptx-pt-swatch); height: var(--pptx-pt-swatch); padding: 0; border: 2px solid rgb(255 255 255 / 20%); border-radius: 50%; cursor: pointer; transition: transform .15s ease; }
	.pptx-svelte-present-swatch:hover { transform: scale(1.1); }
	.pptx-svelte-present-swatch.selected { border-color: #fff; }
</style>
