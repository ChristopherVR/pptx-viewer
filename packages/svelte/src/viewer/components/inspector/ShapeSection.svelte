<script lang="ts">
	import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
	import { SHAPE_PRESET_DEFS, SHAPE_QUICK_STYLES } from 'pptx-viewer-shared';

	import type { EditorState } from '../../editor/editor-state.svelte';
	import ConnectorArrowsSection from './ConnectorArrowsSection.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const style = $derived('shapeStyle' in el ? el.shapeStyle : undefined);
	const shapeType = $derived('shapeType' in el ? el.shapeType : undefined);

	function patchStyle(next: Partial<ShapeStyle>): void {
		editor.patchSelected({ shapeStyle: { ...style, ...next } } as Partial<PptxElement>);
	}
	function setShapeType(next: string): void {
		editor.patchSelected({ shapeType: next } as Partial<PptxElement>);
	}
	async function sampleFill(): Promise<void> {
		const Picker = (window as unknown as { EyeDropper?: new () => { open(): Promise<{ sRGBHex: string }> } }).EyeDropper;
		if (!Picker) {
			return;
		}
		const result = await new Picker().open();
		patchStyle({ fillMode: 'solid', fillColor: result.sRGBHex });
	}
</script>

{#if el.type === 'shape'}
	<label>Shape type<select aria-label="Shape type" value={shapeType ?? 'rect'} onchange={(event) => setShapeType(event.currentTarget.value)}>{#each SHAPE_PRESET_DEFS as preset}<option value={preset.type}>{preset.label}</option>{/each}</select></label>
{/if}
<div class="styles" aria-label="Quick styles">{#each SHAPE_QUICK_STYLES as preset}<button type="button" title={preset.name} style={`--fill:${preset.style.fillColor ?? 'transparent'};--stroke:${preset.style.strokeColor ?? 'transparent'}`} onclick={() => patchStyle(preset.style)}></button>{/each}</div>
<button type="button" onclick={() => void sampleFill()} disabled={typeof window === 'undefined' || !('EyeDropper' in window)}>Eyedropper</button>
{#if el.type === 'connector'}
	<ConnectorArrowsSection {editor} {style} {el} />
{/if}

<style>label{display:grid;gap:3px;margin-top:7px;color:var(--pptx-muted-foreground);font-size:10px}select,button{height:26px;border:1px solid var(--pptx-border);border-radius:5px;background:var(--pptx-background);color:inherit}.styles{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;margin:8px 0}.styles button{background:var(--fill);box-shadow:inset 0 0 0 2px var(--stroke)}</style>
