<script lang="ts">
	/**
	 * Field editors for whichever part `TableStyleEditor.svelte` currently has
	 * selected. Mirrors React's `TableStyleEditorFields.tsx` / Vue's
	 * `TableStyleEditorFields.vue`.
	 */
	import type { TableStyleEditorDescriptor, TableStyleEditorFieldEdit } from 'pptx-viewer-shared';
	import {
		TABLE_STYLE_BORDER_SIDE_LABEL_KEYS,
		TABLE_STYLE_BORDER_SIDES,
		TABLE_STYLE_DASH_PRESETS,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import ThemeColorSwatchGrid from './ThemeColorSwatchGrid.svelte';

	const {
		descriptor,
		themeColorMap,
		canEdit,
		onedit,
	}: {
		descriptor: TableStyleEditorDescriptor;
		themeColorMap: Record<string, string> | undefined;
		canEdit: boolean;
		onedit: (edit: TableStyleEditorFieldEdit) => void;
	} = $props();

	const t = useTranslator();
</script>

<div class="fields">
	<div class="group">
		<span class="hdg">{t('pptx.tableStyleEditor.fillSection')}</span>
		<div class="row">
			<input type="color" disabled={!canEdit} value={descriptor.fill.color.hex} onchange={(e) => onedit({ kind: 'fillColor', hex: e.currentTarget.value, ref: undefined })} />
			<label class="check"><input type="checkbox" disabled={!canEdit} checked={descriptor.fill.noFill} onchange={(e) => onedit({ kind: 'fillNone', noFill: e.currentTarget.checked })} />{t('pptx.tableStyleEditor.noFill')}</label>
		</div>
		<ThemeColorSwatchGrid {themeColorMap} disabled={!canEdit} selectedRef={descriptor.fill.color.ref} selectedHex={descriptor.fill.color.hex} onpick={(c) => onedit({ kind: 'fillColor', hex: c.hex, ref: c.ref })} />
	</div>

	{#if descriptor.hasTextAndBorders}
		<div class="group">
			<span class="hdg">{t('pptx.tableStyleEditor.textSection')}</span>
			<div class="row">
				<button type="button" disabled={!canEdit} class:active={descriptor.text.bold} onclick={() => onedit({ kind: 'textBold', value: !descriptor.text.bold })}>{t('pptx.format.bold')}</button>
				<button type="button" disabled={!canEdit} class:active={descriptor.text.italic} onclick={() => onedit({ kind: 'textItalic', value: !descriptor.text.italic })}>{t('pptx.format.italic')}</button>
				<button type="button" disabled={!canEdit} class:active={descriptor.text.underline} onclick={() => onedit({ kind: 'textUnderline', value: !descriptor.text.underline })}>{t('pptx.format.underline')}</button>
			</div>
			<label class="row">{t('pptx.tableStyleEditor.textColor')}<input type="color" disabled={!canEdit} value={descriptor.text.color.hex} onchange={(e) => onedit({ kind: 'textColor', hex: e.currentTarget.value, ref: undefined })} /></label>
			<ThemeColorSwatchGrid {themeColorMap} disabled={!canEdit} selectedRef={descriptor.text.color.ref} selectedHex={descriptor.text.color.hex} onpick={(c) => onedit({ kind: 'textColor', hex: c.hex, ref: c.ref })} />
		</div>

		<div class="group">
			<span class="hdg">{t('pptx.tableStyleEditor.bordersSection')}</span>
			{#each TABLE_STYLE_BORDER_SIDES as side (side)}
				{@const border = descriptor.borders[side]}
				<div class="border-row">
					<span class="side-lbl">{t(TABLE_STYLE_BORDER_SIDE_LABEL_KEYS[side])}</span>
					<input type="color" disabled={!canEdit} value={border.color.hex} onchange={(e) => onedit({ kind: 'borderColor', side, hex: e.currentTarget.value, ref: undefined })} />
					<input type="number" min="0" max="20" disabled={!canEdit} value={border.width} onchange={(e) => onedit({ kind: 'borderWidth', side, width: Number(e.currentTarget.value) })} />
					<select disabled={!canEdit} value={border.dash} onchange={(e) => onedit({ kind: 'borderDash', side, dash: e.currentTarget.value })}>
						{#each TABLE_STYLE_DASH_PRESETS as dash (dash)}<option value={dash}>{dash}</option>{/each}
					</select>
					<label class="check"><input type="checkbox" disabled={!canEdit} checked={border.noFill} onchange={(e) => onedit({ kind: 'borderNone', side, noFill: e.currentTarget.checked })} />{t('pptx.tableStyleEditor.noBorder')}</label>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.fields { display: flex; flex-direction: column; gap: 8px; }
	.group { display: flex; flex-direction: column; gap: 4px; }
	.hdg { font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--pptx-muted-foreground); }
	.row { display: flex; align-items: center; gap: 6px; font-size: 11px; }
	.check { display: flex; align-items: center; gap: 4px; font-size: 11px; }
	.border-row { display: flex; align-items: center; gap: 5px; font-size: 11px; }
	.side-lbl { width: 110px; flex-shrink: 0; color: var(--pptx-muted-foreground); }
	input[type='color'] { height: 24px; width: 32px; border: 1px solid var(--pptx-border); border-radius: 4px; background: transparent; cursor: pointer; padding: 0; }
	input[type='number'], select { height: 24px; border: 1px solid var(--pptx-border); border-radius: 4px; background: var(--pptx-background); color: inherit; }
	input[type='number'] { width: 48px; }
	button { border: 1px solid var(--pptx-border); border-radius: 4px; padding: 3px 6px; background: var(--pptx-muted); color: inherit; }
	button.active { background: var(--pptx-primary, #c43b32); color: #fff; }
</style>
