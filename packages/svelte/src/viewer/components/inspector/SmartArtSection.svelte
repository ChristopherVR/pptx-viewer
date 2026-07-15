<script lang="ts">
	import type {
		SmartArtColorScheme,
		SmartArtLayoutType,
		SmartArtPptxElement,
	} from 'pptx-viewer-core';
	import {
		SWITCHABLE_LAYOUT_TYPES,
		switchSmartArtLayout,
		updateSmartArtNodeText,
	} from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: SmartArtPptxElement } = $props();
	const t = useTranslator();
	const data = $derived(el.smartArtData);

	const colorSchemes: readonly SmartArtColorScheme[] = [
		'colorful1',
		'colorful2',
		'colorful3',
		'monochromatic1',
		'monochromatic2',
	];

	function setNodeText(nodeId: string, text: string): void {
		if (data) {
			editor.applyElementPatch(el.id, { smartArtData: updateSmartArtNodeText(data, nodeId, text) });
		}
	}

	function setLayout(layout: SmartArtLayoutType): void {
		if (data && layout !== data.resolvedLayoutType) {
			editor.applyElementPatch(el.id, { smartArtData: switchSmartArtLayout(data, layout) });
		}
	}

	function setColorScheme(scheme: SmartArtColorScheme): void {
		if (data) {
			editor.applyElementPatch(el.id, { smartArtData: { ...data, colorScheme: scheme } });
		}
	}
</script>

{#if data}
	<span class="pptx-svelte-smartart-label">{t('pptx.smartart.switchLayout')}</span>
	<div class="pptx-svelte-smartart-layouts">
		{#each SWITCHABLE_LAYOUT_TYPES as layout}
			<button
				type="button"
				class:active={data.resolvedLayoutType === layout}
				aria-pressed={data.resolvedLayoutType === layout}
				data-testid={`smartart-layout-${layout}`}
				onclick={() => setLayout(layout)}
			>
				{t(`pptx.smartart.category.${layout}`)}
			</button>
		{/each}
	</div>

	<label class="pptx-svelte-smartart-field">
		<span>{t('pptx.smartart.colorScheme')}</span>
		<select
			data-testid="smartart-color-scheme"
			value={data.colorScheme ?? 'colorful1'}
			onchange={(event) => setColorScheme(event.currentTarget.value as SmartArtColorScheme)}
		>
			{#each colorSchemes as scheme}
				<option value={scheme}>{scheme}</option>
			{/each}
		</select>
	</label>

	<span class="pptx-svelte-smartart-label">{t('pptx.smartart.textPane')}</span>
	<div class="pptx-svelte-smartart-nodes">
		{#each data.nodes as node, index (node.id)}
			<label class="pptx-svelte-smartart-node">
				<span>{index + 1}</span>
				<input
					type="text"
					value={node.text}
					aria-label={`${t('pptx.smartart.item')} ${index + 1}`}
					data-testid="smartart-node-text"
					onchange={(event) => setNodeText(node.id, event.currentTarget.value)}
				/>
			</label>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-smartart-label {
		display: block;
		margin-bottom: 6px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-smartart-layouts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 5px;
		margin-bottom: 10px;
	}

	.pptx-svelte-smartart-layouts button {
		min-width: 0;
		padding: 6px 3px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font: inherit;
		font-size: 10px;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.pptx-svelte-smartart-layouts button:hover {
		background: var(--pptx-accent, #313244);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-smartart-layouts button.active {
		border-color: var(--pptx-primary, #89b4fa);
		background: color-mix(in srgb, var(--pptx-primary, #89b4fa) 16%, transparent);
		color: var(--pptx-primary, #89b4fa);
	}

	.pptx-svelte-smartart-field {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-smartart-field select,
	.pptx-svelte-smartart-node input {
		height: 26px;
		box-sizing: border-box;
		padding: 2px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: var(--pptx-foreground, #e2e8f0);
		font: inherit;
	}

	.pptx-svelte-smartart-nodes {
		display: flex;
		max-height: 208px;
		flex-direction: column;
		gap: 5px;
		overflow-y: auto;
	}

	.pptx-svelte-smartart-node {
		display: grid;
		grid-template-columns: 20px minmax(0, 1fr);
		align-items: center;
		gap: 5px;
	}

	.pptx-svelte-smartart-node span {
		color: var(--pptx-muted-foreground, #94a3b8);
		text-align: center;
	}

	.pptx-svelte-smartart-node input {
		min-width: 0;
	}
</style>
