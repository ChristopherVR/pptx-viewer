<script lang="ts">
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import RibbonIcon from '../RibbonIcon.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();
	const canMutate = $derived(editor.editable && editor.selectedElementId !== null);
</script>

		<button
			type="button"
			disabled={!canMutate}
			data-ribbon-control="home.arrange.duplicate"
			aria-label={t('pptx.arrange.duplicate')}
			title={t('pptx.arrange.duplicate')}
			onclick={() => editor.duplicateSelected()}
		>
			<RibbonIcon name="home.arrange.duplicate" />
		<span>{t('pptx.arrange.duplicate')}</span></button>
		<button
			type="button"

			disabled={!canMutate}
			data-ribbon-control="home.arrange.delete"
			aria-label={t('pptx.arrange.delete')}
			title={t('pptx.arrange.delete')}
			onclick={() => editor.deleteSelected()}
		>
			<RibbonIcon name="home.arrange.delete" />
		<span>{t('pptx.arrange.delete')}</span></button>
