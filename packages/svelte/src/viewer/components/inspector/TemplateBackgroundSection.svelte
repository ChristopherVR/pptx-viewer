<script lang="ts">
	/**
	 * TemplateBackgroundSection: the SLIDE BACKGROUND card's template rows
	 * (React/Vue/Angular's shortcut to edit the active slide's LAYOUT and
	 * MASTER background colour directly, without leaving the slide for the
	 * separate Master Views overlay). Shown only while `editTemplateMode` is
	 * on and the active slide has a layout and/or master to edit. Svelte had
	 * no path to this at all before.
	 */
	import type { PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
	import { normalizeHexColor, resolveTemplateBackgroundRows } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { InspectorDeckActions } from '../../state/inspector-deck';

	const {
		activeSlide,
		slideMasters,
		deck,
		canEdit,
	}: {
		activeSlide: PptxSlide;
		slideMasters: readonly PptxSlideMaster[];
		deck: InspectorDeckActions;
		canEdit: boolean;
	} = $props();
	const t = useTranslator();

	const rows = $derived(
		resolveTemplateBackgroundRows(
			activeSlide,
			slideMasters,
			t('pptx.master.layout'),
			t('pptx.master.master'),
		),
	);

	function colorValue(path: string): string {
		return normalizeHexColor(deck.getTemplateBackgroundColor(path), '#ffffff');
	}
</script>

{#if rows.layout || rows.master}
	<div class="pptx-svelte-template-bg">
		{#if rows.layout}
			<label class="row" title={rows.layout.title}>
				<span>{t('pptx.master.layout')}</span>
				<input
					type="color"
					disabled={!canEdit}
					value={colorValue(rows.layout.path)}
					onchange={(event) => deck.setTemplateBackground(rows.layout!.path, (event.currentTarget as HTMLInputElement).value)}
				/>
				<span class="value">{rows.layout.label}</span>
			</label>
		{/if}
		{#if rows.master}
			<label class="row" title={rows.master.title}>
				<span>{t('pptx.master.master')}</span>
				<input
					type="color"
					disabled={!canEdit}
					value={colorValue(rows.master.path)}
					onchange={(event) => deck.setTemplateBackground(rows.master!.path, (event.currentTarget as HTMLInputElement).value)}
				/>
				<span class="value">{rows.master.label}</span>
			</label>
		{/if}
	</div>
{/if}

<style>
	.pptx-svelte-template-bg {
		display: grid;
		gap: 6px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 11px;
	}

	.row > span:first-child {
		width: 40px;
		flex-shrink: 0;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.row input[type='color'] {
		width: 32px;
		height: 22px;
		padding: 1px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 3px;
		background: transparent;
		cursor: pointer;
	}

	.value {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}
</style>
