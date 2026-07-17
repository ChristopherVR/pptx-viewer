<script lang="ts">
	/**
	 * CustomPropertiesBlock: editable custom document properties (name / value
	 * rows + add / remove), the Svelte port of Vue's `CustomPropertiesBlock`
	 * (React `inspector/DocumentPropertiesCards.tsx`). Emits the full
	 * replacement array on every change.
	 */
	import type { PptxCustomProperty } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';

	const {
		customProperties,
		canEdit = true,
		onupdate,
	}: {
		customProperties: PptxCustomProperty[];
		canEdit?: boolean;
		onupdate: (next: PptxCustomProperty[]) => void;
	} = $props();
	const t = useTranslator();

	function addProperty(): void {
		onupdate([
			...customProperties,
			{ name: `Property ${customProperties.length + 1}`, value: '', type: 'lpwstr' },
		]);
	}

	function patchAt(index: number, patch: Partial<PptxCustomProperty>): void {
		onupdate(customProperties.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
	}

	function removeAt(index: number): void {
		onupdate(customProperties.filter((_, i) => i !== index));
	}
</script>

<div class="pptx-svelte-custom-props">
	<div class="head">
		<span>{t('pptx.documentProperties.custom.heading')}</span>
		{#if canEdit}
			<button type="button" onclick={addProperty}>{t('pptx.documentProperties.custom.add')}</button>
		{/if}
	</div>
	{#if customProperties.length === 0}
		<p class="empty">{t('pptx.documentProperties.custom.empty')}</p>
	{/if}
	{#each customProperties as entry, index (index)}
		<div class="row">
			<input
				type="text"
				aria-label={t('pptx.documentProperties.custom.heading')}
				disabled={!canEdit}
				value={entry.name}
				onchange={(event) => patchAt(index, { name: event.currentTarget.value })}
			/>
			<input
				type="text"
				aria-label={entry.name}
				disabled={!canEdit}
				value={entry.value}
				onchange={(event) => patchAt(index, { value: event.currentTarget.value })}
			/>
			{#if canEdit}
				<button type="button" class="remove" onclick={() => removeAt(index)}>×</button>
			{/if}
		</div>
	{/each}
</div>

<style>
	.pptx-svelte-custom-props {
		display: grid;
		gap: 5px;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 11px;
	}

	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.empty {
		margin: 0;
		font-size: 10px;
	}

	.row {
		display: grid;
		grid-template-columns: 1fr 1fr auto;
		gap: 4px;
	}

	input {
		min-width: 0;
		height: 25px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
	}

	button {
		padding: 3px 7px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11px;
	}

	.remove {
		color: #f87171;
	}
</style>
