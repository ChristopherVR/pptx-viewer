<script lang="ts">
	import RibbonIcon from '../RibbonIcon.svelte';
	/**
	 * FontExtrasGroup: the native part of the Home tab's Font group: font
	 * family, change case, character spacing, and swatch-grid font-colour /
	 * highlight-colour pickers. The character toggles, Text Shadow, size steps
	 * and Clear Formatting are the shared `pptx-ui-ribbon-home-font` strip. Split
	 * out so no single file needs to own every font control (300-LOC budget).
	 */
	import './font-extras.css';
	import { hasTextProperties } from 'pptx-viewer-core';
	import {
		CHANGE_CASE_OPTIONS,
		CHARACTER_SPACING_OPTIONS,
		textColorOf,
		transformInlineListCase,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import {
		changeCasePatch,
		highlightColorOf,
		setCharacterSpacingPatch,
		setHighlightColorPatch,
		setTextColorPatch,
	} from '../../../editor';
	import FontFamilySelect from './FontFamilySelect.svelte';
	import SwatchColorPicker from '../SwatchColorPicker.svelte';

	const { editor, showFamily = true }: { editor: EditorState; showFamily?: boolean } = $props();
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
	const textColor = $derived(el ? textColorOf(el) : '#000000');
	const textColorRef = $derived(
		el && hasTextProperties(el) ? el.textStyle?.colorRef : undefined,
	);
	const highlight = $derived(el ? highlightColorOf(el) || '#ffff00' : '#ffff00');

	function apply(patch: Parameters<EditorState['patchSelected']>[0]): void {
		editor.patchSelected(patch);
	}
</script>

<div class="pptx-svelte-fontx" data-pptx-chrome={!showFamily ? 'font-controls-fragment' : undefined} role="group" aria-label={t('pptx.ribbon.font')}>
	{#if showFamily}<FontFamilySelect {editor} />{/if}

	<div class="pptx-svelte-fontx-menu" data-ribbon-control="home.font.characterSpacing" bind:this={spacingMenuEl} onfocusout={onFocusOut}>
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
			<RibbonIcon name="home.font.characterSpacing" />
		</button>
		{#if openMenu === 'spacing'}
			<div class="pptx-svelte-fontx-pop" role="menu" use:anchoredPopup={{ anchor: spacingMenuEl }}>
				{#each CHARACTER_SPACING_OPTIONS as option (option.value)}
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							if (el) {
								apply((current) => setCharacterSpacingPatch(current, Number(option.value)));
							}
							openMenu = null;
						}}
					>{t(option.i18nKey)}</button>
				{/each}
			</div>
		{/if}
	</div>

	<div class="pptx-svelte-fontx-menu" data-ribbon-control="home.font.changeCase" bind:this={caseMenuEl} onfocusout={onFocusOut}>
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
			<RibbonIcon name="home.font.changeCase" />
		</button>
		{#if openMenu === 'case'}
			<div class="pptx-svelte-fontx-pop" role="menu" use:anchoredPopup={{ anchor: caseMenuEl }}>
				{#each CHANGE_CASE_OPTIONS as option (option.value)}
					<button
						type="button"
						role="menuitem"
						onclick={() => {
							if (el) {
								apply((current, snapshot) => {
									if (!snapshot) return changeCasePatch(current, option.value);
									const { text, textSegments } = transformInlineListCase(snapshot, null, option.value);
									return { text, textSegments };
								});
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
		label={t('pptx.text.fontColor')}
		control="home.font.fontColor"
		title={t('pptx.textProperties.textColor')}
		glyph="A"
		recentColors={editor.mruColors}
		themeColorMap={editor.themeColorMap}
		currentRef={textColorRef}
		onselect={(hex) => {
			if (el) {
				apply((current) => setTextColorPatch(current, hex));
			}
			editor.recordRecentColor(hex);
		}}
		onselectTheme={(commit) => {
			if (el) {
				apply((current) => setTextColorPatch(current, commit.hex, commit.ref));
			}
			editor.recordRecentColor(commit.hex);
		}}
	/>
	<SwatchColorPicker
		value={highlight}
		disabled={!active}
		label={t('pptx.text.highlightColor')}
		control="home.font.highlightColor"
		glyph="H"
		swatches={['#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080']}
		onselect={(hex) => {
			if (el) {
				apply((current) => setHighlightColorPatch(current, hex));
			}
			editor.recordRecentColor(hex);
		}}
	/>
</div>
