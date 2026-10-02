<script lang="ts">
	import { hasTextProperties } from 'pptx-viewer-core';
	import { fontHomeControls, homeSnapshotTranslator, textColorOf } from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import {
		adjustFontSizePatch,
		changeCasePatch,
		clearFormattingPatch,
		hasTextShadow,
		highlightColorOf,
		setCharacterSpacingPatch,
		setHighlightColorPatch,
		setTextColorPatch,
		toggleStrikethroughPatch,
		toggleTextFlagPatch,
		toggleTextShadowPatch,
	} from '../../../editor';
	import { transformInlineListCase } from 'pptx-viewer-shared';

	/**
	 * The whole Home Font strip is the shared `pptx-ui-ribbon-home-font` element:
	 * character toggles, Text Shadow, size steps, Clear Formatting, Character
	 * Spacing, Change Case and the font and highlight colour popovers. Every
	 * edit still goes through `EditorState.patchSelected`.
	 */
	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const element = $derived(editor.selectedElement);
	const active = $derived(editor.editable && element !== undefined && hasTextProperties(element));
	const style = $derived(element && hasTextProperties(element) ? element.textStyle : undefined);
	const state = $derived({
		controls: fontHomeControls({
			enabled: active,
			bold: Boolean(style?.bold),
			italic: Boolean(style?.italic),
			underline: Boolean(style?.underline),
			strikethrough: Boolean(style?.strikethrough),
			shadow: hasTextShadow(element),
			characterSpacing: style?.characterSpacing,
			fontColor: {
				value: element ? textColorOf(element) : '#000000',
				ref: style?.colorRef,
				themeColors: editor.themeColorMap,
				recent: editor.mruColors,
			},
			highlight: {
				value: (element ? highlightColorOf(element) : '') || '#ffff00',
				recent: editor.mruColors,
			},
		}),
		translate: homeSnapshotTranslator(['font'], t),
	});

	function request(event: RibbonHomeRequestEvent): void {
		const { id, value, ref } = event.detail;
		switch (id.replace('home.font.', '')) {
			case 'bold':
			case 'italic':
			case 'underline': {
				const flag = id.replace('home.font.', '') as 'bold' | 'italic' | 'underline';
				editor.patchSelected((current) => toggleTextFlagPatch(current, flag));
				break;
			}
			case 'strikethrough':
				editor.patchSelected((current) => toggleStrikethroughPatch(current));
				break;
			case 'shadow':
				editor.patchSelected((current) => toggleTextShadowPatch(current));
				break;
			case 'increaseFontSize':
				editor.patchSelected((current) => adjustFontSizePatch(current, 2));
				break;
			case 'decreaseFontSize':
				editor.patchSelected((current) => adjustFontSizePatch(current, -2));
				break;
			case 'clearFormatting':
				editor.patchSelected((current) => clearFormattingPatch(current));
				break;
			case 'characterSpacing':
				editor.patchSelected((current) => setCharacterSpacingPatch(current, Number(value)));
				break;
			case 'changeCase': {
				const mode = value as Parameters<typeof changeCasePatch>[1];
				editor.patchSelected((current, snapshot) => {
					if (!snapshot) return changeCasePatch(current, mode);
					const { text, textSegments } = transformInlineListCase(snapshot, null, mode);
					return { text, textSegments };
				});
				break;
			}
			case 'fontColor':
				editor.patchSelected((current) => setTextColorPatch(current, String(value), ref));
				editor.recordRecentColor(String(value));
				break;
			case 'highlightColor':
				editor.patchSelected((current) => setHighlightColorPatch(current, String(value)));
				editor.recordRecentColor(String(value));
		}
	}
</script>

<div data-pptx-chrome="font-controls">
	<pptx-ui-ribbon-home-font {state} onhome-request={request}></pptx-ui-ribbon-home-font>
</div>
