<script lang="ts">
	/**
	 * FindReplacePanel: a docked Find & Replace panel under the ribbon
	 * (React's `FindReplacePanel` is a floating popover; this binding docks it
	 * in the ribbon's flow instead, matching the vanilla binding's approach).
	 * Search-as-you-type; Replace only enabled while editing (Find stays
	 * available read-only).
	 */
	import { useTranslator } from '../../../i18n/context';
	import type { FindReplaceState } from '../../editor/editor-find-replace.svelte';

	const { findReplace, editable }: { findReplace: FindReplaceState; editable: boolean } = $props();
	const t = useTranslator();

	function onQueryInput(value: string): void {
		findReplace.query = value;
		findReplace.search();
	}

	function onKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Escape') {
			findReplace.close();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			findReplace.next();
		}
	}
</script>

{#if findReplace.open}
	<div class="pptx-svelte-findreplace" role="dialog" aria-label={t('pptx.findReplace.ariaLabel')}>
		<input
			class="pptx-svelte-findreplace-input"
			type="text"
			placeholder={t('pptx.findReplace.findPlaceholder')}
			aria-label={t('pptx.findReplace.searchText')}
			value={findReplace.query}
			oninput={(e) => onQueryInput(e.currentTarget.value)}
			onkeydown={onKeydown}
		/>
		<label class="pptx-svelte-findreplace-case">
			<input
				type="checkbox"
				checked={findReplace.matchCase}
				onchange={(e) => {
					findReplace.matchCase = e.currentTarget.checked;
					findReplace.search();
				}}
			/>
			{t('pptx.findReplace.matchCase')}
		</label>
		<span class="pptx-svelte-findreplace-count" aria-live="polite">
			{#if findReplace.query}
				{findReplace.hasResults
					? t('pptx.findReplace.matchCount', { current: findReplace.index + 1, total: findReplace.matchCount })
					: t('pptx.findReplace.noMatches')}
			{/if}
		</span>
		<button
			type="button"
			disabled={!findReplace.hasResults}
			aria-label={t('pptx.findReplace.previousMatch')}
			title={t('pptx.findReplace.previousMatch')}
			onclick={() => findReplace.prev()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<button
			type="button"
			disabled={!findReplace.hasResults}
			aria-label={t('pptx.findReplace.nextMatch')}
			title={t('pptx.findReplace.nextMatch')}
			onclick={() => findReplace.next()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
		<input
			class="pptx-svelte-findreplace-input"
			type="text"
			placeholder={t('pptx.findReplace.replacePlaceholder')}
			aria-label={t('pptx.findReplace.replacementText')}
			disabled={!editable}
			value={findReplace.replacement}
			oninput={(e) => (findReplace.replacement = e.currentTarget.value)}
			onkeydown={onKeydown}
		/>
		<button
			type="button"
			disabled={!editable || !findReplace.hasResults}
			aria-label={t('pptx.findReplace.replaceCurrent')}
			onclick={() => findReplace.replaceCurrent()}
		>
			{t('pptx.findReplace.replace')}
		</button>
		<button
			type="button"
			disabled={!editable || !findReplace.hasResults}
			aria-label={t('pptx.findReplace.replaceAllMatches')}
			onclick={() => findReplace.replaceAll()}
		>
			{t('pptx.findReplace.replaceAll')}
		</button>
		<button
			type="button"
			class="pptx-svelte-findreplace-close"
			aria-label={t('pptx.findReplace.closeAriaLabel')}
			title={t('pptx.findReplace.closeEscape')}
			onclick={() => findReplace.close()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" /></svg>
		</button>
	</div>
{/if}

<style>
	.pptx-svelte-findreplace {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		font-family: system-ui, sans-serif;
		font-size: 12px;
	}

	.pptx-svelte-findreplace-input {
		height: 26px;
		min-width: 140px;
		padding: 0 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-findreplace-input:disabled {
		opacity: 0.4;
	}

	.pptx-svelte-findreplace-case {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-findreplace-count {
		min-width: 70px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-findreplace button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 26px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11.5px;
	}

	.pptx-svelte-findreplace button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-findreplace button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-findreplace button svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-findreplace-close {
		margin-left: auto;
		background: transparent;
	}
</style>
