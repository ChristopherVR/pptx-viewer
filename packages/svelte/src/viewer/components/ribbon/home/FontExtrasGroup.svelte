<script lang="ts">
	/**
	 * FontExtrasGroup: the rest of the Home tab's Font group beyond
	 * bold/italic/underline/size (which stay in `TextFormatGroup`): font
	 * family, strikethrough, clear formatting, change case, character
	 * spacing, and swatch-grid font-colour / highlight-colour pickers. Split
	 * out so no single file needs to own every font control (300-LOC budget).
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import { hasTextProperties } from 'pptx-viewer-core';
	import {
		CHANGE_CASE_OPTIONS,
		CHARACTER_SPACING_OPTIONS,
		COMMON_FONT_FAMILIES,
		textColorOf,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import {
		changeCasePatch,
		clearFormattingPatch,
		highlightColorOf,
		setCharacterSpacingPatch,
		setFontFamilyPatch,
		setHighlightColorPatch,
		setTextColorPatch,
		toggleStrikethroughPatch,
	} from '../../../editor';
	import SwatchColorPicker from '../SwatchColorPicker.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	// React renders change-case ("Aa") and character-spacing ("AV") as compact
	// icon-trigger dropdowns rather than labelled selects; mirror that here.
	let openMenu = $state<'case' | 'spacing' | null>(null);
	// eslint-disable-next-line prefer-const
	let caseMenuEl: HTMLElement | undefined = $state();
	// eslint-disable-next-line prefer-const
	let spacingMenuEl: HTMLElement | undefined = $state();

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			openMenu = null;
		}
	}

	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasTextProperties(el));
	const fontFamily = $derived(
		el && hasTextProperties(el) ? (el.textStyle?.fontFamily ?? 'Segoe UI') : 'Segoe UI',
	);
	const strikethrough = $derived(
		el && hasTextProperties(el) ? Boolean(el.textStyle?.strikethrough) : false,
	);
	const textColor = $derived(el ? textColorOf(el) : '#000000');
	const highlight = $derived(el ? highlightColorOf(el) || '#ffff00' : '#ffff00');

	function apply(patch: Partial<PptxElement>): void {
		editor.patchSelected(patch);
	}
</script>

<div class="pptx-svelte-fontx" role="group" aria-label={t('pptx.ribbon.font')}>
	<select
		class="pptx-svelte-ribbon-select pptx-svelte-fontx-family"
		disabled={!active}
		aria-label={t('pptx.text.fontFamily')}
		title={t('pptx.text.fontFamily')}
		value={fontFamily}
		onchange={(e) => el && apply(setFontFamilyPatch(el, e.currentTarget.value))}
	>
		{#each COMMON_FONT_FAMILIES as family (family)}
			<option value={family}>{family}</option>
		{/each}
	</select>

	<button
		type="button"
		class="pptx-svelte-fontx-btn"
		class:pptx-svelte-fontx-on={strikethrough}
		disabled={!active}
		aria-pressed={strikethrough}
		aria-label={t('pptx.textPanel.strikethrough')}
		title={t('pptx.textPanel.strikethrough')}
		onclick={() => el && apply(toggleStrikethroughPatch(el))}
	>
		<span style="text-decoration: line-through">S</span>
	</button>

	<button
		type="button"
		class="pptx-svelte-fontx-btn"
		disabled={!active}
		aria-label={t('pptx.text.clearFormatting')}
		title={t('pptx.text.clearFormatting')}
		onclick={() => el && apply(clearFormattingPatch(el))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h7l3 3-7 7-3-3z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /><path d="M3 13h10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
	</button>

	<div class="pptx-svelte-fontx-menu" bind:this={caseMenuEl} onfocusout={onFocusOut}>
		<button
			type="button"
			class="pptx-svelte-fontx-btn"
			class:pptx-svelte-fontx-on={openMenu === 'case'}
			disabled={!active}
			aria-haspopup="menu"
			aria-expanded={openMenu === 'case'}
			aria-label={t('pptx.text.changeCase')}
			title={t('pptx.text.changeCase')}
			onclick={() => (openMenu = openMenu === 'case' ? null : 'case')}
		>
			<span class="pptx-svelte-fontx-glyph">Aa</span>
		</button>
		{#if openMenu === 'case'}
			<div class="pptx-svelte-fontx-pop" role="menu" use:anchoredPopup={{ anchor: caseMenuEl }}>
				{#each CHANGE_CASE_OPTIONS as option (option.value)}
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							if (el) {
								apply(changeCasePatch(el, option.value));
							}
							openMenu = null;
						}}
					>{t(option.i18nKey)}</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="pptx-svelte-fontx-menu" bind:this={spacingMenuEl} onfocusout={onFocusOut}>
		<button
			type="button"
			class="pptx-svelte-fontx-btn"
			class:pptx-svelte-fontx-on={openMenu === 'spacing'}
			disabled={!active}
			aria-haspopup="menu"
			aria-expanded={openMenu === 'spacing'}
			aria-label={t('pptx.text.characterSpacing')}
			title={t('pptx.text.characterSpacing')}
			onclick={() => (openMenu = openMenu === 'spacing' ? null : 'spacing')}
		>
			<span class="pptx-svelte-fontx-glyph">AV</span>
		</button>
		{#if openMenu === 'spacing'}
			<div class="pptx-svelte-fontx-pop" role="menu" use:anchoredPopup={{ anchor: spacingMenuEl }}>
				{#each CHARACTER_SPACING_OPTIONS as option (option.value)}
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							if (el) {
								apply(setCharacterSpacingPatch(el, Number(option.value)));
							}
							openMenu = null;
						}}
					>{t(option.i18nKey)}</button>
				{/each}
			</div>
		{/if}
	</div>

	<SwatchColorPicker
		value={textColor}
		disabled={!active}
		label={t('pptx.textProperties.textColor')}
		glyph="A"
		onselect={(hex) => el && apply(setTextColorPatch(el, hex))}
	/>
	<SwatchColorPicker
		value={highlight}
		disabled={!active}
		label={t('pptx.text.highlightColor')}
		glyph="H"
		swatches={['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080']}
		onselect={(hex) => el && apply(setHighlightColorPatch(el, hex))}
	/>
</div>

<style>
	.pptx-svelte-fontx {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	/* Look and feel comes from the shared `.pptx-svelte-ribbon-select` class
	   (defined once in Ribbon.svelte); only the width cap is local. */
	.pptx-svelte-fontx-family {
		max-width: 120px;
	}

	.pptx-svelte-fontx-btn {
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
		font-size: 12px;
	}

	.pptx-svelte-fontx-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-fontx-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-fontx-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-fontx-btn svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-fontx-glyph {
		font-size: 12px;
		font-weight: 700;
		line-height: 1;
	}

	.pptx-svelte-fontx-menu {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-fontx-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 148px;
		flex-direction: column;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		padding: 4px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-fontx-pop button {
		display: block;
		width: 100%;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		padding: 6px 10px;
		text-align: left;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.pptx-svelte-fontx-pop button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}
</style>
