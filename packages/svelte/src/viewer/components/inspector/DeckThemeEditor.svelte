<script lang="ts">
	import type { PptxHandler, PptxTheme } from 'pptx-viewer-core';
	import type { ThemeEditorEdit } from 'pptx-viewer-shared';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import { applyThemePreset } from '../../editor/editor-theme-scheme';
	import ThemeEditorPanel from './ThemeEditorPanel.svelte';

	const { editor, handler, theme, onthemechange, onclose, inline = true }: {
		editor: EditorState; handler: PptxHandler; theme: PptxTheme | undefined;
		onthemechange: (theme: PptxTheme) => void; onclose?: () => void; inline?: boolean;
	} = $props();
	let busy = $state(false);
	async function apply(edit: ThemeEditorEdit): Promise<void> {
		if (busy || !editor.editable) {
			return;
		}
		busy = true;
		try {
			onthemechange(await applyThemePreset(editor, handler, theme, { id: 'custom', ...edit }));
			onclose?.();
		} finally {
			busy = false;
		}
	}
</script>

<ThemeEditorPanel {theme} {inline} canEdit={editor.editable && !busy} onapply={(edit) => void apply(edit)} {onclose} />
