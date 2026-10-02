<script lang="ts">
	import RibbonIcon from '../RibbonIcon.svelte';
	/**
	 * EditingGroup: the Home tab's Editing group. Find/Replace opens the
	 * docked `FindReplacePanel` (both buttons toggle the same panel, matching
	 * React); Select is a MENU whose "Select All" command selects every element
	 * on the current slide.
	 *
	 * The Select control used to be a plain button labelled "Select" that
	 * selected everything on click. React, Vue and Angular all render a trigger
	 * plus a menu, and the product specs address ribbon commands by accessible
	 * name, so this binding had no control called "Select All" at all: the
	 * cross-binding effects spec had to skip it. Same shape as the others now.
	 */
	import { editingHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
	import { anchoredPopup } from '../anchored-popup';

	const {
		editor,
		findReplace,
	}: { editor: EditorState; findReplace: FindReplaceState } = $props();
	const t = useTranslator();

	// Find and Replace are the shared strip; both toggle the docked panel.
	const stripState = $derived({
		controls: editingHomeControls({ findOpen: findReplace.open }),
		translate: homeSnapshotTranslator(['editing'], t),
	});

	let selectMenuOpen = $state(false);
	// The template's `bind:this` writes these (invisible to the linter).
	// eslint-disable-next-line prefer-const
	let selectHost: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let selectTrigger: HTMLButtonElement | undefined = $state();

	/** Close on an outside press, like every other ribbon menu in this binding. */
	function onWindowPointerDown(event: PointerEvent): void {
		if (selectMenuOpen && !selectHost?.contains(event.target as Node)) {
			selectMenuOpen = false;
		}
	}

	function selectAll(): void {
		selectMenuOpen = false;
		editor.selection.setAll(editor.activeElements.map((element) => element.id));
	}
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.editing.find')} data-ribbon-group="home.editing">
	<div class="pptx-svelte-rgroup-cluster" data-pptx-chrome="editing-controls">
		<pptx-ui-ribbon-home-editing state={stripState} onhome-request={() => findReplace.toggle()}></pptx-ui-ribbon-home-editing>
		<!-- Outside the shared strip on purpose: its joined cluster is
		     `overflow: hidden`, which would clip the popover (the same trap the
		     Angular port documents). -->
		<div class="pptx-svelte-select-host" data-ribbon-control="home.editing.select" bind:this={selectHost}>
			<button
				bind:this={selectTrigger}
				type="button"
				disabled={editor.slides.length === 0}
				aria-label={t('pptx.ribbon.tool.select')}
				title={t('pptx.ribbon.tool.select')}
				aria-haspopup="menu"
				aria-expanded={selectMenuOpen}
				onclick={() => (selectMenuOpen = !selectMenuOpen)}
			>
				<RibbonIcon name="home.editing.select" />
			</button>
			{#if selectMenuOpen}
				<!-- `anchoredPopup` pins the menu with `position: fixed`, the pattern
				     every other menu in this ribbon uses: the content row scrolls
				     horizontally and clips an absolutely-positioned popup. -->
				<div class="pptx-svelte-select-menu" use:anchoredPopup={{ anchor: selectTrigger }}>
					<!-- `onmousedown` preventDefault is load-bearing: without it the click
					     blurs the canvas and the deselect-on-outside-click handler wipes
					     the selection this command has just made. -->
					<button
						type="button"
						class="pptx-svelte-select-item"
						onmousedown={(e) => e.preventDefault()}
						onclick={selectAll}
					>
						{t('pptx.editing.selectAll')}
					</button>
				</div>
			{/if}
		</div>
	</div>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.editing')}</span>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
	}

	.pptx-svelte-rgroup-cluster {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.pptx-svelte-select-host {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-select-host > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 5px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-select-host > button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-select-host > button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-select-host > button svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-select-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		z-index: 40;
		min-width: 128px;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
	}

	.pptx-svelte-select-menu .pptx-svelte-select-item {
		display: block;
		width: 100%;
		height: auto;
		padding: 6px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 12px;
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}

	.pptx-svelte-select-menu .pptx-svelte-select-item:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
