<script lang="ts">
	import { hasTextProperties } from 'pptx-viewer-core';
	import { fontHomeControls } from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import {
		adjustFontSizePatch,
		clearFormattingPatch,
		hasTextShadow,
		toggleStrikethroughPatch,
		toggleTextFlagPatch,
		toggleTextShadowPatch,
	} from '../../../editor';
	import FontExtrasGroup from './FontExtrasGroup.svelte';

	/**
	 * The Home Font group's character strip (toggles, Text Shadow, size steps,
	 * Clear Formatting) is the shared `pptx-ui-ribbon-home-font` element; every
	 * edit still goes through `EditorState.patchSelected`. The family, case,
	 * spacing and colour controls stay native beside it.
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
		}),
		translate: t,
	});

	function request(event: RibbonHomeRequestEvent): void {
		const id = event.detail.id.replace('home.font.', '');
		switch (id) {
			case 'bold':
			case 'italic':
			case 'underline':
				editor.patchSelected((current) => toggleTextFlagPatch(current, id));
				break;
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
		}
	}
</script>

<div data-pptx-chrome="font-controls">
	<pptx-ui-ribbon-home-font {state} onhome-request={request}></pptx-ui-ribbon-home-font>
	<FontExtrasGroup {editor} showFamily={false} />
</div>
