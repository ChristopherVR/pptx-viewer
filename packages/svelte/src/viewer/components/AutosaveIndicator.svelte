<script lang="ts">
	/**
	 * AutosaveIndicator: a tiny status pill for the viewer toolbar, mirroring the
	 * Vue binding's `AutosaveIndicator.vue`. Purely presentational; the autosave
	 * lifecycle lives in `state/autosave.svelte.ts`. Strings come from the shared
	 * i18n dictionary via the context translator (`pptx.autosave.*`).
	 */
	import { useTranslator } from '../../i18n/context';
	import type { AutosaveStatus } from '../state/autosave.svelte';

	const { status, isDirty = false }: { status: AutosaveStatus; isDirty?: boolean } = $props();

	const t = useTranslator();

	type Tone = 'idle' | 'saving' | 'saved' | 'error' | 'dirty' | 'disabled';

	const tone = $derived.by<Tone>(() => {
		if (status === 'saving') {
			return 'saving';
		}
		if (status === 'error') {
			return 'error';
		}
		if (isDirty) {
			return 'dirty';
		}
		if (status === 'saved') {
			return 'saved';
		}
		if (status === 'disabled') {
			return 'disabled';
		}
		return 'idle';
	});

	const label = $derived.by(() => {
		switch (tone) {
			case 'saving':
				return t('pptx.autosave.saving');
			case 'error':
				return t('pptx.autosave.error');
			case 'dirty':
				return t('pptx.statusBar.unsavedChanges');
			case 'saved':
				return t('pptx.autosave.savedShort');
			default:
				return t('pptx.statusBar.allSaved');
		}
	});
</script>

{#if tone !== 'disabled'}
	<span
		class="pptx-svelte-autosave"
		class:pptx-svelte-autosave-saving={tone === 'saving'}
		class:pptx-svelte-autosave-saved={tone === 'saved'}
		class:pptx-svelte-autosave-error={tone === 'error'}
		class:pptx-svelte-autosave-dirty={tone === 'dirty'}
		role="status"
		aria-live="polite"
	>
		{#if tone === 'saving'}
			<span class="pptx-svelte-autosave-spinner" aria-hidden="true"></span>
		{:else}
			<span class="pptx-svelte-autosave-dot" aria-hidden="true"></span>
		{/if}
		{label}
	</span>
{/if}

<style>
	.pptx-svelte-autosave {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 2px 9px;
		border-radius: 999px;
		background: var(--pptx-muted, #33334d);
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 12px;
		line-height: 1.4;
		white-space: nowrap;
		user-select: none;
	}

	.pptx-svelte-autosave-dot,
	.pptx-svelte-autosave-spinner {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.7;
	}

	.pptx-svelte-autosave-spinner {
		background: transparent;
		border: 2px solid currentColor;
		border-top-color: transparent;
		opacity: 0.85;
		animation: pptx-svelte-autosave-spin 0.7s linear infinite;
	}

	.pptx-svelte-autosave-saving {
		color: #eab308;
	}

	.pptx-svelte-autosave-saved {
		color: #22c55e;
	}

	.pptx-svelte-autosave-error {
		color: #ef4444;
	}

	.pptx-svelte-autosave-dirty {
		color: #f59e0b;
	}

	@keyframes pptx-svelte-autosave-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
