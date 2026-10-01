<script lang="ts">
	/**
	 * ClipboardGroup: Paste / Cut / Copy / Format Painter for the Home tab. The
	 * markup, gating and styles are the shared `pptx-ui-ribbon-home-clipboard`
	 * element; every mutation still routes through `EditorState`
	 * (`clipboardOps`, `formatPainter`) so undo/redo covers each action.
	 */
	import { clipboardHomeControls } from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const state = $derived({
		controls: clipboardHomeControls({
			editable: editor.editable,
			hasSelection: editor.selectedElementId !== null,
			hasClipboard: editor.hasClipboard,
			formatPainterActive: editor.formatPainter.active,
			canFormatPaint: editor.formatPainter.enabled,
			showFormatPainter: true,
		}),
		translate: t,
	});

	function request(event: RibbonHomeRequestEvent): void {
		switch (event.detail.id) {
			case 'home.clipboard.paste':
				editor.clipboardOps.pasteClipboard();
				break;
			case 'home.clipboard.cut':
				editor.clipboardOps.cutSelected();
				break;
			case 'home.clipboard.copy':
				editor.clipboardOps.copySelected();
				break;
			case 'home.clipboard.formatPainter':
				editor.formatPainter.toggle();
		}
	}
</script>

<pptx-ui-ribbon-home-clipboard {state} onhome-request={request}></pptx-ui-ribbon-home-clipboard>
