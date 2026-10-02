<script lang="ts">
	/**
	 * EditingGroup: the Home tab's Editing group, all of it the shared
	 * `pptx-ui-ribbon-home-editing` element. Find/Replace open the docked
	 * `FindReplacePanel` (both toggle the same panel, matching React); the Select
	 * menu's "Select All" selects every element on the current slide.
	 */
	import { editingHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';

	const {
		editor,
		findReplace,
	}: { editor: EditorState; findReplace: FindReplaceState } = $props();
	const t = useTranslator();

	const state = $derived({
		controls: editingHomeControls({
			findOpen: findReplace.open,
			selectAll: editor.slides.length > 0,
		}),
		translate: homeSnapshotTranslator(['editing'], t),
	});

	function request(event: RibbonHomeRequestEvent): void {
		if (event.detail.id === 'home.editing.select') {
			editor.selection.setAll(editor.activeElements.map((element) => element.id));
		} else {
			findReplace.toggle();
		}
	}
</script>

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.editing.find')} data-ribbon-group="home.editing">
	<div class="pptx-svelte-rgroup-cluster" data-pptx-chrome="editing-controls">
		<pptx-ui-ribbon-home-editing {state} onhome-request={request}></pptx-ui-ribbon-home-editing>
	</div>
	<span class="pptx-svelte-rgroup-label" data-pptx-chrome="ribbon-group-label">{t('pptx.ribbon.editing')}</span>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex: none;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
	}

	.pptx-svelte-rgroup-cluster {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
</style>
