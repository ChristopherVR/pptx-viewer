<script lang="ts">
	/**
	 * EditingGroup: the Home tab's Editing group. Find/Replace opens the
	 * docked `FindReplacePanel` (both buttons toggle the same panel, matching
	 * React); Select All selects every element on the current slide.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import type { FindReplaceState } from '../../../editor/editor-find-replace.svelte';

	const {
		editor,
		findReplace,
	}: { editor: EditorState; findReplace: FindReplaceState } = $props();
	const t = useTranslator();

	function selectAll(): void {
		editor.selection.setAll(editor.activeElements.map((element) => element.id));
	}
</script>

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.editing.find')}>
	<div class="pptx-svelte-rgroup-row">
		<button
			type="button"
			aria-label={t('pptx.editing.find')}
			title={t('pptx.editing.find')}
			aria-pressed={findReplace.open}
			onclick={() => findReplace.toggle()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M9.5 9.5 13 13" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		</button>
		<button
			type="button"
			aria-label={t('pptx.ribbon.replace')}
			title={t('pptx.ribbon.replace')}
			aria-pressed={findReplace.open}
			onclick={() => findReplace.toggle()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 5h7l-2-2M13.5 11h-7l2 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<button
			type="button"
			disabled={editor.slides.length === 0}
			aria-label={t('pptx.editing.selectAll')}
			title={t('pptx.editing.selectAll')}
			onclick={selectAll}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 5.5 6 8l6-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" /><rect x="1.5" y="1.5" width="13" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1" /></svg>
		</button>
	</div>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.editing')}</span>
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

	.pptx-svelte-rgroup-row {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: hidden;
	}

	.pptx-svelte-rgroup-row button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 5px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-rgroup-row button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-row button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rgroup-row svg {
		width: 14px;
		height: 14px;
	}
</style>
