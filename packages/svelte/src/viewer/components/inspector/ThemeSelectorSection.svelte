<script lang="ts">
	/**
	 * ThemeSelectorSection: THEME card (packaged theme-part dropdown + Apply
	 * First Master / Apply All Masters), the Svelte port of Vue's
	 * `ThemeSelectorCard` (React `inspector/PresentationSettingsCards.tsx`).
	 * The parent owns the selected path and performs the actual apply.
	 */
	import type { PptxThemeOption } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';

	const {
		options,
		selectedPath,
		canEdit = true,
		onselect,
		onapply,
	}: {
		options: PptxThemeOption[];
		selectedPath: string;
		canEdit?: boolean;
		onselect: (path: string) => void;
		onapply: (path: string, applyToAllMasters: boolean) => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-theme-selector">
	<label>
		<span>{t('pptx.documentProperties.themeHeading')}</span>
		<select
			disabled={options.length === 0}
			value={selectedPath}
			onchange={(event) => onselect(event.currentTarget.value)}
		>
			{#if options.length === 0}
				<option value="">{t('pptx.documentProperties.noThemesOption')}</option>
			{:else}
				{#each options as option (option.path)}
					<option value={option.path}>{option.name || option.path.split('/').pop()}</option>
				{/each}
			{/if}
		</select>
	</label>
	<div class="buttons">
		<button
			type="button"
			disabled={!canEdit || !selectedPath}
			onclick={() => onapply(selectedPath, false)}
		>
			{t('pptx.documentProperties.applyFirstMaster')}
		</button>
		<button
			type="button"
			disabled={!canEdit || !selectedPath}
			onclick={() => onapply(selectedPath, true)}
		>
			{t('pptx.documentProperties.applyAllMasters')}
		</button>
	</div>
</div>

<style>
	.pptx-svelte-theme-selector {
		display: grid;
		gap: 8px;
	}

	label {
		display: grid;
		gap: 3px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	select {
		min-width: 0;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}

	.buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 6px;
	}

	button {
		padding: 4px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11px;
	}

	button:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
