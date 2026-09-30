<script lang="ts">
	import { hasTextProperties } from 'pptx-viewer-core';
	import { buildFontCatalog, resolveDefaultFontFamily } from 'pptx-viewer-shared';
	import type { PptxUiSelectElement } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import { setFontFamilyPatch } from '../../../editor';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasTextProperties(el));
	/**
	 * The dropdown's contents, grouped the way PowerPoint groups them: theme
	 * fonts first, then anything the deck embeds, then fonts added this session
	 * via File > Options > Fonts, then the full catalogue.
	 */
	const themeFonts = $derived({
		heading: editor.theme?.fontScheme?.majorFont?.latin,
		body: editor.theme?.fontScheme?.minorFont?.latin,
	});
	const fontGroups = $derived(
		buildFontCatalog({
			themeFonts,
			embeddedFonts: editor.embeddedFontFamilies,
			customFonts: editor.customFontFamilies,
		}),
	);

	// With nothing overriding it on the element, the box shows the family the
	// deck would actually render rather than a hardcoded "Segoe UI", which
	// misreported every themed deck.
	const fontFamily = $derived(
		(el && hasTextProperties(el) ? el.textStyle?.fontFamily : undefined) ??
			resolveDefaultFontFamily(
				(el as { placeholderType?: string } | undefined)?.placeholderType,
				themeFonts,
			),
	);
	function setFamily(event: Event): void {
		const family = (event.currentTarget as PptxUiSelectElement).value;
		if (editor.editable && active) {
			editor.patchSelected((current) => setFontFamilyPatch(current, family));
		}
	}
</script>

<!-- This edits selected text; it does not configure future inserted text. -->
<pptx-ui-select variant="ribbon-font" data-font-picker="family"
	class="pptx-svelte-ribbon-select pptx-svelte-fontx-family"
	data-ribbon-control="home.font.fontFamily"
	aria-label={t('pptx.ribbon.fontFamily')}
	disabled={!editor.editable || !active}
	title={t('pptx.ribbon.fontFamily')}
	value={fontFamily}
	onchange={setFamily}
>
	{#each fontGroups as group (group.id)}
		<optgroup label={t(group.labelKey)}>
			{#each group.entries as entry (entry.family)}
				<option value={entry.family} style:font-family={entry.family} data-display-label={entry.family} data-description={entry.themeRole ? t(`pptx.font.role.${entry.themeRole}`) : undefined}
					>{entry.family}{entry.themeRole
						? ` (${t(`pptx.font.role.${entry.themeRole}`)})`
						: ''}</option
				>
			{/each}
		</optgroup>
	{/each}
</pptx-ui-select>
