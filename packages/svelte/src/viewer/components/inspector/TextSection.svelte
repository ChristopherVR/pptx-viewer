<script lang="ts">
	/**
	 * TextSection: vertical anchor, wrap-in-shape toggle, and autofit mode, for
	 * elements carrying text properties. Paragraph alignment (left/center/right/
	 * justify) is already covered by the Home tab's Paragraph group
	 * (`ParagraphGroup.svelte`), so it is intentionally not duplicated here.
	 *
	 * NOTE on autofit labels: `TextStyle.autoFitMode` is counterintuitively
	 * named. `'shrink'` is OOXML `spAutoFit` (resize the SHAPE to fit the text)
	 * and `'normal'` is OOXML `normAutofit` (shrink the TEXT on overflow). The
	 * option labels below are worded by what they DO, not by the enum name.
	 */
	import type { PptxElement, TextStyle } from 'pptx-viewer-core';
	import {
		autoFitModeOf,
		autoFitModePatch,
		textAdvancedStateOf,
		textWrapOf,
		textWrapPatch,
		vAlignPatch,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import TextEffectsSection from './TextEffectsSection.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const vAlign = $derived(textAdvancedStateOf(el).vAlign);
	const wrap = $derived(textWrapOf(el));
	const autoFit = $derived(autoFitModeOf(el));
	const textStyle = $derived('textStyle' in el ? (el.textStyle ?? {}) : {});

	function setVAlign(value: string): void {
		editor.patchSelected(vAlignPatch(el, value as NonNullable<TextStyle['vAlign']>));
	}
	function setWrap(checked: boolean): void {
		editor.patchSelected(textWrapPatch(el, checked ? 'square' : 'none'));
	}
	function setAutoFit(value: string): void {
		editor.patchSelected(autoFitModePatch(el, value as NonNullable<TextStyle['autoFitMode']>));
	}
	function patchText(next: Partial<TextStyle>): void {
		editor.patchSelected({ textStyle: { ...textStyle, ...next } } as Partial<PptxElement>);
	}
</script>

<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label">{t('pptx.textPanel.verticalAlign')}</span>
	<select value={vAlign} onchange={(e) => setVAlign(e.currentTarget.value)}>
		<option value="top">{t('pptx.textPanel.valignTop')}</option>
		<option value="middle">{t('pptx.textPanel.valignMiddle')}</option>
		<option value="bottom">{t('pptx.textPanel.valignBottom')}</option>
	</select>
</label>

<label class="pptx-svelte-field-checkbox">
	<input type="checkbox" checked={wrap === 'square'} onchange={(e) => setWrap(e.currentTarget.checked)} />
	<span>{t('pptx.textAdvanced.wrapText')}</span>
</label>

<label class="pptx-svelte-field">
	<span class="pptx-svelte-field-label">{t('pptx.textAdvanced.autoFit')}</span>
	<select value={autoFit} onchange={(e) => setAutoFit(e.currentTarget.value)}>
		<option value="none">{t('pptx.textAdvanced.autoFitNone')}</option>
		<option value="normal">{t('pptx.textAdvanced.autoFitShrink')}</option>
		<option value="shrink">{t('pptx.textAdvanced.autoFitResize')}</option>
	</select>
</label>

<TextEffectsSection {editor} {el} />

<div class="pptx-svelte-grid">
	<label class="pptx-svelte-field"><span>Line spacing</span><input type="number" min="0.5" max="5" step="0.05" value={textStyle.lineSpacing ?? 1} onchange={(event) => patchText({ lineSpacing: Number(event.currentTarget.value), lineSpacingExactPt: undefined })} /></label>
	<label class="pptx-svelte-field"><span>Before (pt)</span><input type="number" min="0" value={textStyle.paragraphSpacingBefore ?? 0} onchange={(event) => patchText({ paragraphSpacingBefore: Number(event.currentTarget.value) })} /></label>
	<label class="pptx-svelte-field"><span>After (pt)</span><input type="number" min="0" value={textStyle.paragraphSpacingAfter ?? 0} onchange={(event) => patchText({ paragraphSpacingAfter: Number(event.currentTarget.value) })} /></label>
	<label class="pptx-svelte-field"><span>Columns</span><input type="number" min="1" max="16" value={textStyle.columnCount ?? 1} onchange={(event) => patchText({ columnCount: Math.max(1, Number(event.currentTarget.value)) })} /></label>
</div>
<label class="pptx-svelte-field"><span>Text direction</span><select value={textStyle.textDirection ?? 'horizontal'} onchange={(event) => patchText({ textDirection: event.currentTarget.value as TextStyle['textDirection'] })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option><option value="vertical270">Vertical 270</option><option value="eaVert">East Asian vertical</option><option value="wordArtVert">Stacked</option><option value="wordArtVertRtl">Stacked RTL</option><option value="mongolianVert">Mongolian vertical</option></select></label>
<label class="pptx-svelte-field-checkbox"><input type="checkbox" checked={textStyle.rtl ?? false} onchange={(event) => patchText({ rtl: event.currentTarget.checked })} /><span>Right-to-left</span></label>

<style>
	.pptx-svelte-field {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 10px;
	}

	.pptx-svelte-field:first-child {
		margin-top: 0;
	}

	.pptx-svelte-field-label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-field select {
		height: 26px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}
	.pptx-svelte-field input { height: 26px; box-sizing: border-box; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-background, #11111b); color: inherit; font: inherit; }
	.pptx-svelte-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 6px; }

	.pptx-svelte-field-checkbox {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-top: 10px;
		cursor: pointer;
	}
</style>
