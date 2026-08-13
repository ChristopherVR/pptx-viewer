<script lang="ts">
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
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';
	import { anchoredPopup } from '../anchored-popup';

	const {
		editor,
		findReplace,
	}: { editor: EditorState; findReplace: FindReplaceState } = $props();
	const t = useTranslator();

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

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.editing.find')}>
	<div class="pptx-svelte-rgroup-cluster">
		<div class="pptx-svelte-rgroup-row">
			<button
				type="button"
				aria-label={t('pptx.editing.find')}
				title={t('pptx.editing.find')}
				aria-pressed={findReplace.open}
				onclick={() => findReplace.toggle()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M9.5 9.5 13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
			</button>
			<button
				type="button"
				aria-label={t('pptx.ribbon.replace')}
				title={t('pptx.ribbon.replace')}
				aria-pressed={findReplace.open}
				onclick={() => findReplace.toggle()}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5h7l-2-2M13.5 11h-7l2 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
			</button>
		</div>
		<!-- Outside `.pptx-svelte-rgroup-row` on purpose: that row is
		     `overflow: hidden`, which would clip the popover (the same trap the
		     Angular port documents). -->
		<div class="pptx-svelte-select-host" bind:this={selectHost}>
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
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.5 6 8l6-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /><rect x="1.5" y="1.5" width="13" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1" /></svg>
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

	.pptx-svelte-rgroup-row {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: hidden;
	}

	.pptx-svelte-rgroup-row button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 5px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-rgroup-row button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-row button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rgroup-row svg {
		width: 14px;
		height: 14px;
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
