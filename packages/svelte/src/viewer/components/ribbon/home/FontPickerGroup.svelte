<script lang="ts">
	/**
	 * FontPickerGroup: the Home > Font family and size selects as the shared
	 * `pptx-ui-ribbon-home-font-picker` element. The element renders the group
	 * wrapper, caption and both `pptx-ui-select` fields; this adapter supplies
	 * the deck's font lists and the current values and applies picked values
	 * through `EditorState.patchSelected`.
	 */
	import { hasTextProperties } from 'pptx-viewer-core';
	import {
		fontPickerHomeControls,
		fontSizeOf,
		homeSnapshotTranslator,
		resolveDefaultFontFamily,
	} from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import { setFontFamilyPatch, setFontSizePatch } from '../../../editor';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const el = $derived(editor.selectedElement);
	const active = $derived(el !== undefined && hasTextProperties(el));
	const themeFonts = $derived({
		heading: editor.theme?.fontScheme?.majorFont?.latin,
		body: editor.theme?.fontScheme?.minorFont?.latin,
	});
	// With nothing overriding it, the box shows the family the deck would render.
	const fontFamily = $derived(
		(el && hasTextProperties(el) ? el.textStyle?.fontFamily : undefined) ??
			resolveDefaultFontFamily(
				(el as { placeholderType?: string } | undefined)?.placeholderType,
				themeFonts,
			),
	);
	const state = $derived({
		controls: fontPickerHomeControls(
			{
				enabled: editor.editable && active,
				fontFamily,
				fontSize: el ? fontSizeOf(el) : 24,
				themeFonts,
				embeddedFonts: editor.embeddedFontFamilies,
				customFonts: editor.customFontFamilies,
			},
			t,
		),
		translate: homeSnapshotTranslator(['font-picker'], t),
	});

	function request(event: RibbonHomeRequestEvent): void {
		const { id, value } = event.detail;
		if (!editor.editable || !active) {
			return;
		}
		if (id === 'home.font.fontFamily') {
			editor.patchSelected((current) => setFontFamilyPatch(current, String(value)));
		} else if (id === 'home.font.fontSize') {
			const next = Number(value);
			if (Number.isFinite(next) && next > 0) {
				editor.patchSelected((current) => setFontSizePatch(current, next));
			}
		}
	}
</script>

<pptx-ui-ribbon-home-font-picker {state} onhome-request={request}></pptx-ui-ribbon-home-font-picker>
