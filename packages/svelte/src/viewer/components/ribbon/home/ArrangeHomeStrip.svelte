<script lang="ts">
	/**
	 * ArrangeHomeStrip: one shared Home > Arrange strip (`pptx-ui-ribbon-home-
	 * arrange-<strip>`). The buttons, icons, labels and gating come from the
	 * shared element; every mutation still routes through `EditorState` so
	 * history, selection and read-only rules are unchanged.
	 */
	import { arrangeAlignAction, arrangeHomeControls, homeSnapshotTranslator } from 'pptx-viewer-shared';
	import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const {
		editor,
		strip,
	}: { editor: EditorState; strip: 'align' | 'flip' | 'order' | 'edit' } = $props();
	const t = useTranslator();

	const view = $derived({
		controls: arrangeHomeControls({
			editable: editor.editable,
			// The multi-select decides: one element aligns to the slide, two or more to each other.
			hasSelection: editor.selection.size >= 1,
			canDistribute: editor.selection.size >= 3,
		}),
		translate: homeSnapshotTranslator([`arrange-${strip}`], t),
	});

	function request(event: RibbonHomeRequestEvent): void {
		const { id, part } = event.detail;
		switch (id) {
			case 'home.arrange.align': {
				const action = arrangeAlignAction(part);
				if (action?.kind === 'align') {
					editor.arrangeOps.alignSelected(action.edge);
				} else if (action?.kind === 'distribute') {
					editor.arrangeOps.distributeSelected(action.axis);
				}
				break;
			}
			case 'home.arrange.flipHorizontal':
				editor.arrangeOps.flipSelected('horizontal');
				break;
			case 'home.arrange.flipVertical':
				editor.arrangeOps.flipSelected('vertical');
				break;
			case 'home.arrange.sendBackward':
				editor.reorderSelected('backward');
				break;
			case 'home.arrange.bringForward':
				editor.reorderSelected('forward');
				break;
			case 'home.arrange.sendToBack':
				editor.reorderSelected('back');
				break;
			case 'home.arrange.bringToFront':
				editor.reorderSelected('front');
				break;
			case 'home.arrange.duplicate':
				editor.duplicateSelected();
				break;
			case 'home.arrange.delete':
				editor.deleteSelected();
		}
	}
</script>

{#if strip === 'align'}
	<pptx-ui-ribbon-home-arrange-align state={view} onhome-request={request}></pptx-ui-ribbon-home-arrange-align>
{:else if strip === 'flip'}
	<pptx-ui-ribbon-home-arrange-flip state={view} onhome-request={request}></pptx-ui-ribbon-home-arrange-flip>
{:else if strip === 'order'}
	<pptx-ui-ribbon-home-arrange-order state={view} onhome-request={request}></pptx-ui-ribbon-home-arrange-order>
{:else}
	<pptx-ui-ribbon-home-arrange-edit state={view} onhome-request={request}></pptx-ui-ribbon-home-arrange-edit>
{/if}
