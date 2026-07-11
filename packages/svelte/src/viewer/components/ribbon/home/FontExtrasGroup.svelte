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
		class="pptx-svelte-fontx-family"
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

	<select
		class="pptx-svelte-fontx-select"
		disabled={!active}
		aria-label={t('pptx.text.changeCase')}
		title={t('pptx.text.changeCase')}
		onchange={(e) => {
			if (el && e.currentTarget.value) {
				apply(changeCasePatch(el, e.currentTarget.value as (typeof CHANGE_CASE_OPTIONS)[number]['value']));
			}
			e.currentTarget.value = '';
		}}
	>
		<option value="">{t('pptx.text.changeCase')}</option>
		{#each CHANGE_CASE_OPTIONS as option (option.value)}
			<option value={option.value}>{t(option.i18nKey)}</option>
		{/each}
	</select>

	<select
		class="pptx-svelte-fontx-select"
		disabled={!active}
		aria-label={t('pptx.text.characterSpacing')}
		title={t('pptx.text.characterSpacing')}
		onchange={(e) => {
			if (el && e.currentTarget.value) {
				apply(setCharacterSpacingPatch(el, Number(e.currentTarget.value)));
			}
		}}
	>
		<option value="">{t('pptx.text.characterSpacing')}</option>
		{#each CHARACTER_SPACING_OPTIONS as option (option.value)}
			<option value={option.value}>{t(option.i18nKey)}</option>
		{/each}
	</select>

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

	.pptx-svelte-fontx-family {
		height: 28px;
		max-width: 96px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 11.5px;
	}

	.pptx-svelte-fontx-select {
		height: 28px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		font-size: 11px;
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

	.pptx-svelte-fontx-btn:disabled,
	.pptx-svelte-fontx-family:disabled,
	.pptx-svelte-fontx-select:disabled {
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
</style>
