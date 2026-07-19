<script lang="ts">
	/**
	 * Options > Add-ins: the viewer's optional capability modules presented
	 * like PowerPoint's add-in inventory (grouped active/inactive, details for
	 * the selected row).
	 */
	import type { ViewerAddinRow, ViewerAddinStatus } from 'pptx-viewer-shared';
	import { resolveViewerAddinRows } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';

	const {
		addinStatus,
	}: {
		/** Host-supplied availability flags; unset ids default to active. */
		addinStatus?: ViewerAddinStatus;
	} = $props();
	const t = useTranslator();
	// eslint-disable-next-line prefer-const -- reassigned in the table row markup
	let selectedId = $state<string | null>(null);
	const rows = $derived(resolveViewerAddinRows(addinStatus));
	const active = $derived(rows.filter((row) => row.active));
	const inactive = $derived(rows.filter((row) => !row.active));
	const selected = $derived(rows.find((row) => row.id === selectedId));
</script>

{#snippet addinTable(title: string, tableRows: ViewerAddinRow[])}
	<section>
		<h4>{title}</h4>
		{#if tableRows.length === 0}
			<p class="empty">{t('pptx.options.addIns.description')}</p>
		{:else}
			<table>
				<tbody>
					{#each tableRows as row (row.id)}
						<tr class:selected={selectedId === row.id} onclick={() => (selectedId = row.id)}>
							<td>{t(row.nameKey)}</td>
							<td class="mono">{row.location}</td>
							<td class="muted">{t(`pptx.options.addInType.${row.type}`)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>
{/snippet}

<div class="addins-pane">
	<div class="head">
		<span>{t('pptx.options.addIns.name')}</span>
		<span>{t('pptx.options.addIns.location')}</span>
		<span>{t('pptx.options.addIns.type')}</span>
	</div>
	{@render addinTable(t('pptx.options.addIns.active'), active)}
	{@render addinTable(t('pptx.options.addIns.inactive'), inactive)}
	{#if selected}
		<div class="details">
			<p class="name">{t(selected.nameKey)}</p>
			<p class="muted">{t(selected.descriptionKey)}</p>
			<p class="mono">{selected.location}</p>
		</div>
	{/if}
</div>

<style>
	.addins-pane { display: flex; flex-direction: column; gap: 14px; font-size: 12px; }
	.head { display: grid; grid-template-columns: 1fr auto auto; gap: 0 8px; border-bottom: 1px solid var(--pptx-border, #3f3f52); padding: 0 0 4px 8px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
	h4 { margin: 0 0 4px; color: var(--pptx-foreground, #e2e8f0); font-size: 11.5px; }
	.empty { margin: 0; padding: 4px 8px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; font-style: italic; }
	table { width: 100%; border-collapse: collapse; text-align: left; }
	tr { border-bottom: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 40%, transparent); cursor: pointer; }
	tr:hover { background: var(--pptx-accent, #33334d); }
	tr.selected { background: color-mix(in srgb, var(--pptx-primary, #6366f1) 10%, transparent); }
	td { padding: 5px 8px; font-size: 12px; }
	.mono { color: var(--pptx-muted-foreground, #94a3b8); font: 11px ui-monospace, monospace; }
	.muted { color: var(--pptx-muted-foreground, #94a3b8); }
	.muted, .mono { margin: 0; }
	.details { border: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 60%, transparent); border-radius: 6px; background: color-mix(in srgb, var(--pptx-muted, #2a2a3d) 40%, transparent); padding: 10px 12px; }
	.details p { margin: 0 0 4px; }
	.name { font-weight: 600; }
</style>
