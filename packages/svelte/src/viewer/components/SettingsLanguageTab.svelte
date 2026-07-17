<script lang="ts">
	/**
	 * File > Options > Language: a list of locale choices. Defaults to every
	 * locale actually registered via `pptx-svelte-viewer/i18n`'s
	 * `registerTranslations` (English ships built in), labelled from the
	 * shared `LOCALE_CATALOG`, so this never offers a locale with no
	 * registered dictionary. A host can override the list with
	 * `availableLocales`.
	 */
	import { LOCALE_CATALOG } from 'pptx-viewer-shared/i18n';
	import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
	import { getRegisteredLocales } from '../../i18n/translator';
	import { useTranslator } from '../../i18n/context';

	const {
		locale,
		availableLocales,
		onselect,
	}: {
		locale: string;
		availableLocales?: readonly LocaleCatalogEntry[];
		onselect: (code: string) => void;
	} = $props();
	const t = useTranslator();
	const choices = $derived<readonly LocaleCatalogEntry[]>(
		availableLocales ?? LOCALE_CATALOG.filter((entry) => getRegisteredLocales().includes(entry.code)),
	);
</script>

<div class="list" role="group" aria-label={t('pptx.settings.language')}>
	{#each choices as entry (entry.code)}
		<button
			type="button"
			class:active={entry.code === locale}
			aria-pressed={entry.code === locale}
			onclick={() => onselect(entry.code)}
		>
			<span class="native">{entry.nativeLabel}</span>
			<span class="label">{entry.label}</span>
		</button>
	{/each}
</div>

<style>
	.list {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 4px 0;
	}

	.list button {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 9px 11px;
		border: 0;
		border-radius: 6px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		text-align: left;
	}

	.list button:hover {
		background: var(--pptx-accent, #33334d);
	}

	.list button.active {
		outline: 2px solid var(--pptx-primary, #c43b32);
		outline-offset: -2px;
	}

	.native {
		font-weight: 600;
	}

	.label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}
</style>
