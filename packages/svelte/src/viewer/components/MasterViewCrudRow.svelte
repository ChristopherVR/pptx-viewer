<script lang="ts">
	/**
	 * MasterViewCrudRow: the Slide Master view sidebar's Insert/Duplicate/
	 * Delete/Rename Layout + Slide Master commands (wave-4 B4). The action list
	 * (which commands apply to the selected master/layout and why one is
	 * disabled) comes from shared `masterViewCrudActions` via
	 * `editor.masterCrud`; this component only paints it and forwards clicks.
	 */
	import type { MasterViewCrudActionId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';

	const { editor } = $props<{ editor: EditorState }>();
	const t = useTranslator();
	const actions = $derived(editor.masterCrud.actions());
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function run(id: MasterViewCrudActionId): Promise<void> {
		if (busy) {
			return;
		}
		busy = true;
		error = null;
		try {
			await editor.masterCrud.run(id, {
				promptName: (current: string) => window.prompt(t('pptx.masterView.renamePrompt'), current),
				notify: (message: string) => {
					error = message;
				},
				translate: t,
			});
		} finally {
			busy = false;
		}
	}
</script>

{#if actions.length > 0}
	<section class="crud pptx-svelte-master-crud" aria-label={t('pptx.masterView.slideMastersTitle')}>
		{#each actions as action (action.id)}
			<button
				type="button"
				disabled={!action.enabled || busy}
				title={action.disabledReasonKey ? t(action.disabledReasonKey) : undefined}
				data-testid={`pptx-master-crud-${action.id}`}
				onclick={() => void run(action.id)}
			>{t(action.labelKey)}</button>
		{/each}
		{#if error}<p class="error" role="alert">{error}</p>{/if}
	</section>
{/if}

<style>
	.crud { display:flex; flex-wrap:wrap; gap:4px; margin:0 0 8px; padding:8px; border:1px solid var(--pptx-border,#33334d); border-radius:6px; }
	.crud button { flex:1 1 calc(50% - 4px); padding:4px 6px; border:1px solid var(--pptx-border,#33334d); border-radius:4px; background:transparent; color:inherit; font:11px system-ui,sans-serif; cursor:pointer; }
	.crud button:hover:not(:disabled) { background:var(--pptx-accent,#33334d); }
	.crud button:disabled { opacity:.45; cursor:not-allowed; }
	.crud button:focus-visible { outline:2px solid var(--pptx-ring,#6366f1); outline-offset:-2px; }
	.error { flex-basis:100%; margin:4px 0 0; color:#f59e0b; font:11px system-ui,sans-serif; }
</style>
