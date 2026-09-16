<script lang="ts">
	import { hasTextProperties } from 'pptx-viewer-core';
	import { buildFontCatalog, resolveDefaultFontFamily } from 'pptx-viewer-shared';

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
</script>

<!-- This edits selected text; it does not configure future inserted text. -->
<select
	class="pptx-svelte-ribbon-select pptx-svelte-fontx-family"
	aria-label={t('pptx.ribbon.fontFamily')}
	disabled={!editor.editable || !active}
	title={t('pptx.ribbon.fontFamily')}
	value={fontFamily}
	onchange={(e) => el && editor.patchSelected((current) => setFontFamilyPatch(current, e.currentTarget.value))}
>
	{#each fontGroups as group (group.id)}
		<optgroup label={t(group.labelKey)}>
			{#each group.entries as entry (entry.family)}
				<option value={entry.family} style:font-family={entry.family}
					>{entry.family}{entry.themeRole
						? ` (${t(`pptx.font.role.${entry.themeRole}`)})`
						: ''}</option
				>
			{/each}
		</optgroup>
	{/each}
</select>

<style>
	/* Look and feel comes from the shared `.pptx-svelte-ribbon-select` class
	   (defined once in Ribbon.svelte); only the width cap is local. */
	.pptx-svelte-fontx-family {
		max-width: 120px;
	}
</style>
