<script lang="ts">
	import type { PptxAppProperties, PptxCoreProperties, PptxCustomProperty } from 'pptx-viewer-core';
	import { computeDocumentStatistics } from 'pptx-viewer-shared';
	import { untrack } from 'svelte';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor, onclose }: { editor: EditorState; onclose: () => void } = $props();
	const t = useTranslator();
	let tab = $state<'summary' | 'statistics' | 'custom'>('summary');
	const core = $state<PptxCoreProperties>(untrack(() => ({ ...editor.coreProperties })));
	const app = $state<PptxAppProperties>(untrack(() => ({ ...editor.appProperties })));
	let custom = $state<PptxCustomProperty[]>(
		untrack(() => editor.customProperties.map((item) => ({ ...item }))),
	);
	const stats = $derived(computeDocumentStatistics(editor.slides, editor.coreProperties));

	const summaryFields = [
		['title', 'pptx.documentProperties.summary.title'],
		['subject', 'pptx.documentProperties.summary.subject'],
		['creator', 'pptx.documentProperties.summary.author'],
		['keywords', 'pptx.documentProperties.summary.keywords'],
		['category', 'pptx.documentProperties.summary.category'],
		['description', 'pptx.documentProperties.summary.description'],
	] as const;

	function addCustom(): void {
		custom = [...custom, { name: '', value: '', type: 'lpwstr' }];
	}

	function selectTab(next: typeof tab): void {
		tab = next;
	}

	function removeCustom(index: number): void {
		custom = custom.filter((_item, itemIndex) => itemIndex !== index);
	}

	function save(): void {
		editor.updateDocumentProperties(core, app, custom);
		onclose();
	}
</script>

<div class="pptx-svelte-props-backdrop">
	<button class="pptx-svelte-props-scrim" type="button" aria-label={t('pptx.common.close')} onclick={onclose}></button>
	<div class="pptx-svelte-props" role="dialog" aria-modal="true" aria-labelledby="pptx-svelte-props-title">
		<header>
			<h2 id="pptx-svelte-props-title">{t('pptx.documentProperties.dialogTitle')}</h2>
			<button type="button" aria-label={t('pptx.common.close')} onclick={onclose}>×</button>
		</header>
		<nav aria-label={t('pptx.documentProperties.dialogTitle')}>
			<button class:active={tab === 'summary'} onclick={() => selectTab('summary')}>{t('pptx.documentProperties.tabs.general')}</button>
			<button class:active={tab === 'statistics'} onclick={() => selectTab('statistics')}>{t('pptx.documentProperties.tabs.statistics')}</button>
			<button class:active={tab === 'custom'} onclick={() => selectTab('custom')}>{t('pptx.documentProperties.tabs.custom')}</button>
		</nav>
		<div class="pptx-svelte-props-body">
			{#if tab === 'summary'}
				<div class="grid">
					{#each summaryFields as [key, label]}
						<label><span>{t(label)}</span><input bind:value={core[key]} /></label>
					{/each}
					<label><span>{t('pptx.documentProperties.summary.manager')}</span><input bind:value={app.manager} /></label>
					<label><span>{t('pptx.documentProperties.summary.company')}</span><input bind:value={app.company} /></label>
				</div>
			{:else if tab === 'statistics'}
				<dl>
					<dt>{t('pptx.documentProperties.statistics.slides')}</dt><dd>{stats.slideCount}</dd>
					<dt>{t('pptx.documentProperties.statistics.hiddenSlides')}</dt><dd>{stats.hiddenSlideCount}</dd>
					<dt>{t('pptx.documentProperties.statistics.notes')}</dt><dd>{stats.noteCount}</dd>
					<dt>{t('pptx.documentProperties.statistics.elements')}</dt><dd>{stats.elementCount}</dd>
					<dt>{t('pptx.documentProperties.statistics.words')}</dt><dd>{stats.wordCount}</dd>
					<dt>{t('pptx.documentProperties.statistics.paragraphs')}</dt><dd>{stats.paragraphCount}</dd>
					<dt>{t('pptx.documentProperties.created')}</dt><dd>{stats.created ?? '-'}</dd>
					<dt>{t('pptx.documentProperties.modified')}</dt><dd>{stats.modified ?? '-'}</dd>
				</dl>
			{:else}
				<div class="custom-list">
					{#each custom as property, index}
						<div class="custom-row">
							<input aria-label={t('pptx.documentProperties.custom.name')} bind:value={property.name} />
							<input aria-label={t('pptx.documentProperties.custom.value')} bind:value={property.value} />
							<select aria-label={t('pptx.documentProperties.custom.type')} bind:value={property.type}><option value="lpwstr">Text</option><option value="i4">Number</option><option value="filetime">Date</option><option value="bool">Yes/No</option></select>
							<button type="button" aria-label={t('pptx.documentProperties.custom.deleteProperty')} onclick={() => removeCustom(index)}>×</button>
						</div>
					{/each}
					<button type="button" onclick={addCustom}>{t('pptx.documentProperties.custom.addProperty')}</button>
				</div>
			{/if}
		</div>
		<footer><button type="button" onclick={onclose}>{t('pptx.common.cancel')}</button><button type="button" class="primary" onclick={save} disabled={!editor.editable}>{t('pptx.common.save')}</button></footer>
	</div>
</div>

<style>
	.pptx-svelte-props-backdrop { position:fixed; inset:0; z-index:80; display:grid; place-items:center; background:#0009; }
	.pptx-svelte-props-scrim { position:absolute; inset:0; width:100%; height:100%; border:0; background:transparent; }
	.pptx-svelte-props { position:relative; width:min(680px,calc(100vw - 32px)); max-height:calc(100vh - 40px); overflow:auto; border:1px solid var(--pptx-border,#3f3f52); border-radius:10px; background:var(--pptx-card,#1e1e2e); color:var(--pptx-card-foreground,#e2e8f0); box-shadow:0 24px 80px #0008; }
	header,footer { display:flex; align-items:center; justify-content:space-between; padding:12px 16px; border-bottom:1px solid var(--pptx-border,#3f3f52); }
	header h2 { margin:0; font-size:16px; } header button { font-size:20px; }
	button,input,select { border:1px solid var(--pptx-border,#3f3f52); border-radius:5px; background:var(--pptx-muted,#2a2a3d); color:inherit; padding:6px 8px; }
	nav { display:flex; gap:4px; padding:8px 16px 0; } nav button.active { background:var(--pptx-primary,#c43b32); color:#fff; }
	.pptx-svelte-props-body { min-height:310px; padding:16px; }
	.grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; } label { display:grid; gap:4px; font-size:11px; color:var(--pptx-muted-foreground,#94a3b8); } label input { color:var(--pptx-foreground,#e2e8f0); }
	dl { display:grid; grid-template-columns:1fr auto; gap:8px 24px; margin:0; } dt { color:var(--pptx-muted-foreground,#94a3b8); } dd { margin:0; }
	.custom-list { display:grid; gap:8px; } .custom-row { display:grid; grid-template-columns:1fr 1fr 120px 34px; gap:6px; }
	footer { justify-content:flex-end; gap:8px; border-top:1px solid var(--pptx-border,#3f3f52); border-bottom:0; } footer .primary { background:var(--pptx-primary,#c43b32); color:#fff; }
	@media (max-width:600px) { .grid { grid-template-columns:1fr; } .custom-row { grid-template-columns:1fr; } }
</style>
