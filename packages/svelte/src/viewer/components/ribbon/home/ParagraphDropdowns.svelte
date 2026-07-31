<script lang="ts">
	/**
	 * ParagraphDropdowns: the Home tab's Text Direction and Columns menus, the
	 * Svelte twin of React's `ParagraphDropdowns`.
	 *
	 * Both write `a:bodyPr` properties (`@vert`, `@numCol`) at the element's
	 * `textStyle` level through the pure builders in
	 * `editor-text-body-mutations.ts`, so they behave like every other Home-tab
	 * control: one patch, one history entry, no local copy of the state.
	 *
	 * Split into its own file rather than added to `ParagraphGroup.svelte`
	 * because both controls need popup state and the group file is already at
	 * the point where another popup would push it past the 300-LOC budget.
	 */
	import type { PptxElement, TextStyle } from 'pptx-viewer-core';
	import { hasTextProperties } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { setColumnCountPatch, setTextDirectionPatch } from '../../../editor';
	import { anchoredPopup } from '../anchored-popup';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasTextProperties(el));

	let openMenu = $state<'direction' | 'columns' | null>(null);
	// eslint-disable-next-line prefer-const
	let directionAnchor: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let columnsAnchor: HTMLElement | undefined = $state();

	const DIRECTIONS: ReadonlyArray<{ label: string; value: TextStyle['textDirection'] }> = [
		{ label: 'Horizontal', value: 'horizontal' },
		{ label: 'Rotate 90°', value: 'vertical' },
		{ label: 'Rotate 270°', value: 'vertical270' },
		{ label: 'Stacked', value: 'wordArtVert' },
	];

	const COLUMNS: ReadonlyArray<{ label: string; value: number }> = [
		{ label: '1 Column', value: 1 },
		{ label: '2 Columns', value: 2 },
		{ label: '3 Columns', value: 3 },
	];

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			openMenu = null;
		}
	}

	function apply(patch: Partial<PptxElement>): void {
		editor.patchSelected(patch);
		openMenu = null;
	}
</script>

<div class="pptx-svelte-paradd" bind:this={directionAnchor} onfocusout={onFocusOut}>
	<button
		type="button"
		disabled={!active}
		aria-haspopup="menu"
		aria-expanded={openMenu === 'direction'}
		aria-label={t('pptx.paragraph.textDirection')}
		title={t('pptx.paragraph.textDirection')}
		onclick={() => (openMenu = openMenu === 'direction' ? null : 'direction')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><text x="1.5" y="11.5" font-size="8" fill="currentColor">A</text><path d="M11 4c2 0 2 2.6 0 2.6M11 6.6l1-1M11 6.6l-1-1" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
	</button>
	{#if openMenu === 'direction'}
		<div class="pptx-svelte-paradd-pop" role="menu" use:anchoredPopup={{ anchor: directionAnchor }}>
			{#each DIRECTIONS as option (option.value)}
				<button
					type="button"
					role="menuitem"
					onclick={() => el && apply(setTextDirectionPatch(el, option.value))}
				>{option.label}</button>
			{/each}
		</div>
	{/if}
</div>

<div class="pptx-svelte-paradd" bind:this={columnsAnchor} onfocusout={onFocusOut}>
	<button
		type="button"
		disabled={!active}
		aria-haspopup="menu"
		aria-expanded={openMenu === 'columns'}
		title={t('pptx.paragraph.columns')}
		onclick={() => (openMenu = openMenu === 'columns' ? null : 'columns')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.5h3.5v11h-3.5zM10 2.5h3.5v11H10z" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
	</button>
	{#if openMenu === 'columns'}
		<div class="pptx-svelte-paradd-pop" role="menu" use:anchoredPopup={{ anchor: columnsAnchor }}>
			{#each COLUMNS as option (option.value)}
				<button
					type="button"
					role="menuitem"
					onclick={() => el && apply(setColumnCountPatch(el, option.value))}
				>{option.label}</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-paradd {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-paradd > button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-paradd > button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-paradd > button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-paradd svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-paradd-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 140px;
		flex-direction: column;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-paradd-pop button {
		display: block;
		width: 100%;
		padding: 6px 10px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		text-align: left;
	}

	.pptx-svelte-paradd-pop button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
