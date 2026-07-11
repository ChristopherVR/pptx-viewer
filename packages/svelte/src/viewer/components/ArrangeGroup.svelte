<script lang="ts">
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

<div class="pptx-svelte-arrange" role="group" aria-label={t('pptx.inspector.arrange')}>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.bringToFront')}
		title={t('pptx.arrange.bringToFront')}
		onclick={() => move('front')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4.5" y="4.5" width="9" height="9" rx="1" fill="var(--pptx-muted-foreground, #94a3b8)" /><rect x="2.5" y="2.5" width="8" height="8" rx="1" fill="currentColor" stroke="var(--pptx-card, #1e1e2e)" stroke-width="1" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.bringForward')}
		title={t('pptx.arrange.bringForward')}
		onclick={() => move('forward')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5V4m0 0 3 3M8 4 5 7" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.sendBackward')}
		title={t('pptx.arrange.sendBackward')}
		onclick={() => move('backward')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5V12m0 0 3-3M8 12 5 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-arrange-btn"
		disabled={!enabled}
		aria-label={t('pptx.arrange.sendToBack')}
		title={t('pptx.arrange.sendToBack')}
		onclick={() => move('back')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="2.5" width="8" height="8" rx="1" fill="var(--pptx-muted-foreground, #94a3b8)" /><rect x="4.5" y="4.5" width="9" height="9" rx="1" fill="currentColor" stroke="var(--pptx-card, #1e1e2e)" stroke-width="1" /></svg>
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
