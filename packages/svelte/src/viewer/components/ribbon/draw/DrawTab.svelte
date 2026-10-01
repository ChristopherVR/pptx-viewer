<script lang="ts">
 import type { RibbonDrawRequestEvent } from 'pptx-viewer-shared';
 import { useTranslator } from '../../../../i18n/context';
 import type { EditorState } from '../../../editor/editor-state.svelte';

 const { editor }: { editor: EditorState } = $props();
 const t = useTranslator();
 const state = $derived({
  tool: editor.inkOps.tool, color: editor.inkOps.color, width: editor.inkOps.width,
  editable: editor.editable, recentColors: editor.mruColors, translate: t,
 });
 function request(event: RibbonDrawRequestEvent): void {
  if (!editor.editable) {return;}
  const intent = event.detail;
  switch (intent.kind) {
   case 'tool': editor.inkOps.setTool(intent.value); break;
   case 'width': editor.inkOps.setWidth(intent.value); break;
   case 'color':
    editor.inkOps.setColor(intent.value);
    if (intent.committed) {editor.recordRecentColor(intent.value);}
  }
 }
</script>

<pptx-ui-ribbon-draw {state} ondraw-request={request}></pptx-ui-ribbon-draw>
