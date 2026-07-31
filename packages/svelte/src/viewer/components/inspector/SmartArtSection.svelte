<script lang="ts">
	import type {
		SmartArtColorScheme,
		SmartArtLayoutType,
		SmartArtStyle,
		SmartArtPptxElement,
	} from 'pptx-viewer-core';
	import {
		addSmartArtNode,
		demoteSmartArtNode,
		promoteSmartArtNode,
		removeSmartArtNode,
		reorderSmartArtNode,
		setSmartArtNodeStyle,
		SWITCHABLE_LAYOUT_TYPES,
		switchSmartArtLayout,
		updateSmartArtNodeText,
	} from 'pptx-viewer-core';
	import {
		schemaLabel,
		SMARTART_COLOR_SCHEME_LABEL_KEYS,
		SMARTART_STYLE_LABEL_KEYS,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: SmartArtPptxElement } = $props();
	const t = useTranslator();
	const data = $derived(el.smartArtData);
	// eslint-disable-next-line prefer-const
	let selectedNodeId = $state<string | null>(null);
	const selectedNode = $derived(data?.nodes.find((node) => node.id === selectedNodeId));

	// `dgm:colorsDef` / `dgm:styleDef` family tokens. Both lists stay explicit so
	// spelling them out through the shared tables cannot change which variations
	// the editor offers.
	const colorSchemes: readonly SmartArtColorScheme[] = [
		'colorful1',
		'colorful2',
		'colorful3',
		'monochromatic1',
		'monochromatic2',
	];
	const diagramStyles: readonly SmartArtStyle[] = ['flat', 'moderate', 'intense'];

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
	function applyData(next: NonNullable<typeof data>): void {
		editor.applyElementPatch(el.id, { smartArtData: next });
	}
	function setDiagramStyle(style: SmartArtStyle): void {
		if (data) {
			applyData({ ...data, style, drawingDirty: true, drawingShapes: [] });
		}
	}
	function nodeStyle(patch: Parameters<typeof setSmartArtNodeStyle>[2]): void {
		if (data && selectedNodeId) {
			applyData(setSmartArtNodeStyle(data, selectedNodeId, patch));
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
				<option value={scheme}>{schemaLabel(SMARTART_COLOR_SCHEME_LABEL_KEYS, scheme, t)}</option>
			{/each}
		</select>
	</label>
	<label class="pptx-svelte-smartart-field"><span>Diagram style</span><select value={data.style ?? 'moderate'} onchange={(event) => setDiagramStyle(event.currentTarget.value as SmartArtStyle)}>{#each diagramStyles as diagramStyle}<option value={diagramStyle}>{schemaLabel(SMARTART_STYLE_LABEL_KEYS, diagramStyle, t)}</option>{/each}</select></label>

	<span class="pptx-svelte-smartart-label">{t('pptx.smartart.textPane')}</span>
	<div class="pptx-svelte-smartart-nodes">
		{#each data.nodes as node, index (node.id)}
			<div class="pptx-svelte-smartart-node" class:active={node.id === selectedNodeId}>
				<button type="button" aria-label={`Select item ${index + 1}`} onclick={() => (selectedNodeId = node.id)}>{index + 1}</button>
				<input
					type="text"
					value={node.text}
					aria-label={`${t('pptx.smartart.item')} ${index + 1}`}
					data-testid="smartart-node-text"
					onchange={(event) => setNodeText(node.id, event.currentTarget.value)}
				/>
			</div>
		{/each}
	</div>
	<div class="pptx-svelte-smartart-actions"><button type="button" onclick={() => { if (data) applyData(addSmartArtNode(data, 'New item', selectedNodeId ?? undefined)); }}>Add</button><button type="button" disabled={!selectedNodeId || data.nodes.length <= 1} onclick={() => { if (data && selectedNodeId) { applyData(removeSmartArtNode(data, selectedNodeId)); selectedNodeId = null; } }}>Remove</button><button type="button" disabled={!selectedNodeId} onclick={() => { if (data && selectedNodeId) applyData(reorderSmartArtNode(data, selectedNodeId, -1)); }}>Up</button><button type="button" disabled={!selectedNodeId} onclick={() => { if (data && selectedNodeId) applyData(reorderSmartArtNode(data, selectedNodeId, 1)); }}>Down</button><button type="button" disabled={!selectedNodeId} onclick={() => { if (data && selectedNodeId) applyData(promoteSmartArtNode(data, selectedNodeId)); }}>Promote</button><button type="button" disabled={!selectedNodeId} onclick={() => { if (data && selectedNodeId) applyData(demoteSmartArtNode(data, selectedNodeId)); }}>Demote</button></div>
	{#if selectedNode}<div class="pptx-svelte-smartart-style"><label>Fill<input type="color" value={selectedNode.style?.fillColor ?? '#4472c4'} onchange={(event) => nodeStyle({ fillColor: event.currentTarget.value })} /></label><label>Font<input type="color" value={selectedNode.style?.fontColor ?? '#ffffff'} onchange={(event) => nodeStyle({ fontColor: event.currentTarget.value })} /></label><button type="button" class:active={selectedNode.style?.bold} onclick={() => nodeStyle({ bold: !selectedNode.style?.bold })}>Bold</button><button type="button" class:active={selectedNode.style?.italic} onclick={() => nodeStyle({ italic: !selectedNode.style?.italic })}>Italic</button></div>{/if}
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
	.pptx-svelte-smartart-node.active { border-radius: 4px; outline: 2px solid var(--pptx-primary); }
	.pptx-svelte-smartart-node button { min-width: 20px; padding: 0; border: 0; background: transparent; color: inherit; }

	.pptx-svelte-smartart-node input {
		min-width: 0;
	}
	.pptx-svelte-smartart-actions,.pptx-svelte-smartart-style{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:7px}.pptx-svelte-smartart-actions button,.pptx-svelte-smartart-style button{min-width:0;height:25px;border:1px solid var(--pptx-border);border-radius:4px;background:var(--pptx-muted);color:inherit}.pptx-svelte-smartart-style{grid-template-columns:1fr 1fr auto auto}.pptx-svelte-smartart-style label{display:grid;gap:2px;color:var(--pptx-muted-foreground);font-size:9px}.pptx-svelte-smartart-style input{width:100%;height:24px}.pptx-svelte-smartart-style button.active{background:var(--pptx-primary);color:var(--pptx-primary-foreground)}
</style>
