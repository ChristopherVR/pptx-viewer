<script lang="ts">
	import type { PptxTheme } from 'pptx-viewer-core';
	import { themeEditorLabels } from 'pptx-viewer-shared';
	import type { ThemeEditorApplyEvent, ThemeEditorEdit } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';

	const { theme, canEdit, onapply, onclose, inline = false }: {
		theme: PptxTheme | undefined; canEdit: boolean;
		onapply: (edit: ThemeEditorEdit) => void;
		onclose?: () => void; inline?: boolean;
	} = $props();
	const t = useTranslator();
</script>

<pptx-ui-theme-editor {theme} labels={themeEditorLabels(t)} disabled={!canEdit} inline={inline ? '' : undefined}
	ontheme-editor-apply={(event: Event) => onapply((event as ThemeEditorApplyEvent).detail)}
	ontheme-editor-close={onclose}></pptx-ui-theme-editor>
