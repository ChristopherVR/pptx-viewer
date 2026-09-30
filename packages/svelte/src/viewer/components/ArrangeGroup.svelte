<script lang="ts">
	import RibbonIcon from './ribbon/RibbonIcon.svelte';
	/**
	 * ArrangeGroup: z-order (paint-order) controls for the selected element:
	 * bring to front, bring forward, send backward, send to back. Each calls the
	 * history-integrated `EditorState.reorderSelected`; the shared
	 * `element-operations` primitives do the actual array move. Disabled when
	 * nothing is selected.
	 */
	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import type { ZOrderDirection } from '../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const enabled = $derived(editor.selectedElementId !== null);

	function move(direction: ZOrderDirection): void {
		editor.reorderSelected(direction);
	}
</script>

<div class="pptx-svelte-arrange" data-pptx-chrome="order-controls" role="group" aria-label={t('pptx.inspector.arrange')}>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.sendBackward')}
		title={t('pptx.arrange.sendBackward')}
		data-ribbon-control="home.arrange.sendBackward"
		onclick={() => move('backward')}
	>
		<RibbonIcon name="home.arrange.sendBackward" />
	</button>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.bringForward')}
		title={t('pptx.arrange.bringForward')}
		data-ribbon-control="home.arrange.bringForward"
		onclick={() => move('forward')}
	>
		<RibbonIcon name="home.arrange.bringForward" />
	</button>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.back')}
		title={t('pptx.arrange.sendToBack')}
		data-ribbon-control="home.arrange.sendToBack"
		onclick={() => move('back')}
	>
		<span>{t('pptx.arrange.back')}</span>
	</button>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.front')}
		title={t('pptx.arrange.bringToFront')}
		data-ribbon-control="home.arrange.bringToFront"
		onclick={() => move('front')}
	>
		<span>{t('pptx.arrange.front')}</span>
	</button>
</div>

<style>
	.pptx-svelte-arrange {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-arrange-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-arrange-btn:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-arrange-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-arrange-btn svg {
		width: 16px;
		height: 16px;
	}
</style>
