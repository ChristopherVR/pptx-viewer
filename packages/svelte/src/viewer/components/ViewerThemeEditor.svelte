<script lang="ts">
  import type { PptxTheme } from 'pptx-viewer-core';
  import type { EditorState } from '../editor/editor-state.svelte';
  import DeckThemeEditor from './inspector/DeckThemeEditor.svelte';

  const { editor, onthemechange }: { editor: EditorState; onthemechange: (theme: PptxTheme) => void } = $props();
  const handler = $derived(editor.themeEditorOpen ? editor.getHandler() : null);
</script>

{#if handler}
  <DeckThemeEditor {editor} {handler} theme={editor.theme} inline={false}
    onthemechange={(next) => { editor.theme = next; onthemechange(next); }}
    onclose={() => (editor.themeEditorOpen = false)} />
{/if}
