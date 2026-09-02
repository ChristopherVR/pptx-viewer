<script lang="ts">
	import type { MasterViewTab } from 'pptx-viewer-core';
	import { masterViewBackgroundColor } from 'pptx-viewer-shared';
	import type { CanvasSize } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import { layoutToSlide, masterToSlide } from '../master/master-view';
	import HandoutMasterPanel from './HandoutMasterPanel.svelte';
	import MasterViewCrudRow from './MasterViewCrudRow.svelte';
	import NotesMasterPanel from './NotesMasterPanel.svelte';
	import SlideStage from './SlideStage.svelte';

	const { editor, canvasSize, mediaDataUrls } = $props<{
		editor: EditorState;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
	}>();
	const t = useTranslator();
	const THUMB_WIDTH = 160;
	const thumbScale = $derived(THUMB_WIDTH / Math.max(1, canvasSize.width));
	const target = $derived(editor.masterViewTarget);
	const tab = $derived(target?.tab ?? 'slides');
	/** Background of the master or layout the Slides tab has selected. */
	const slidesBackground = $derived(
		masterViewBackgroundColor(
			{ slideMasters: editor.slideMasters },
			{
				tab: 'slides',
				masterIndex: target?.masterIndex ?? 0,
				layoutIndex: target?.layoutIndex ?? null,
			},
		),
	);
	const tabs: Array<{ key: MasterViewTab; label: string }> = [
		{ key: 'slides', label: t('pptx.sections.slides') },
		{ key: 'notes', label: t('pptx.notes.title') },
		{ key: 'handout', label: t('pptx.masterView.tabHandout') },
	];
	const title = $derived(
		tab === 'slides'
			? t('pptx.masterView.slideMastersTitle')
			: tab === 'notes'
				? t('pptx.masterView.notesMasterTitle')
				: t('pptx.masterView.handoutMasterTitle'),
	);
</script>

<aside class="sidebar pptx-svelte-master-nav" aria-label={title}>
	<header>
		<strong>{title}</strong>
		<button type="button" data-testid="master-collapse" onclick={() => editor.masterOps.exit()} aria-label={t('pptx.mode.closeMasterViewTooltip')}>×</button>
	</header>
	<div class="tabs" role="tablist" aria-label={t('pptx.mode.masterView')}>
		{#each tabs as item (item.key)}
			<button
				type="button"
				role="tab"
				class:active={tab === item.key}
				aria-selected={tab === item.key}
				data-testid={`master-tab-${item.key}`}
				onclick={() => editor.masterOps.enterTab(item.key)}
			>{item.label}</button>
		{/each}
	</div>
	<div class="body" role="tabpanel">
		{#if tab === 'slides'}
			{#if editor.editable}
				<!--
					Format Background for the selected master or layout. PowerPoint
					writes an explicit `p:bgPr` here, deliberately replacing a themed
					`p:bgRef`; `masterOps.setBackgroundColor` picks the owning part.
				-->
				<section class="bg-card">
					<span>{t('pptx.master.notesMasterBackground')}</span>
					<input
						type="color"
						class="swatch"
						aria-label={t('pptx.master.backgroundColorLabel')}
						value={slidesBackground ?? '#ffffff'}
						oninput={(event) => editor.masterOps.setBackgroundColor(event.currentTarget.value)}
					/>
				</section>
				<!-- Insert/Duplicate/Delete/Rename for the selected master or layout. -->
				<MasterViewCrudRow {editor} />
			{/if}
			{#each editor.slideMasters as master, masterIndex (master.path)}
				<button
					type="button"
					class="master-item"
					class:active={masterIndex === target?.masterIndex && target?.layoutIndex === null}
					aria-pressed={masterIndex === target?.masterIndex && target?.layoutIndex === null}
					onclick={() => editor.masterOps.enter(masterIndex, null)}
				>
					<span class="thumb" style={`width:${THUMB_WIDTH}px;height:${canvasSize.height * thumbScale}px`}>
						<SlideStage slide={masterToSlide(master)} {canvasSize} {mediaDataUrls} scale={thumbScale} />
					</span>
					<span>{master.name || t('pptx.master.master')}</span>
				</button>
				{#each master.layouts ?? [] as layout, layoutIndex (layout.path)}
					<button
						type="button"
						class="master-item layout"
						class:active={masterIndex === target?.masterIndex && layoutIndex === target?.layoutIndex}
						aria-pressed={masterIndex === target?.masterIndex && layoutIndex === target?.layoutIndex}
						onclick={() => editor.masterOps.enter(masterIndex, layoutIndex)}
					>
						<span class="thumb" style={`width:${THUMB_WIDTH}px;height:${canvasSize.height * thumbScale}px`}>
							<SlideStage slide={layoutToSlide(layout)} {canvasSize} {mediaDataUrls} scale={thumbScale} />
						</span>
						<span>{layout.name || t('pptx.master.layout')}</span>
					</button>
				{/each}
			{:else}<p>{t('pptx.master.noSlideMasters')}</p>{/each}
		{:else if tab === 'notes'}
			<NotesMasterPanel notesMaster={editor.notesMaster} onchange={(color) => editor.masterOps.setBackgroundColor(color)} />
		{:else}
			<HandoutMasterPanel
				handoutMaster={editor.handoutMaster}
				slidesPerPage={editor.handoutMaster?.slidesPerPage ?? 6}
				onchange={(count) => editor.masterOps.setHandoutSlidesPerPage(count)}
				onbackgroundchange={(color) => editor.masterOps.setBackgroundColor(color)}
			/>
		{/if}
	</div>
</aside>

<style>
	.sidebar { display:flex; width:224px; min-height:0; flex-direction:column; border-right:1px solid var(--pptx-border,#33334d); background:var(--pptx-card,#1e1e2e); }
	header { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; }
	header strong { color:var(--pptx-muted-foreground,#a5a5b5); font-size:11px; letter-spacing:.04em; text-transform:uppercase; }
	header button { border:0; background:transparent; color:inherit; font-size:20px; cursor:pointer; }
	.tabs { display:flex; padding:0 4px; border-bottom:1px solid var(--pptx-border,#33334d); }
	.tabs button { flex:1; padding:6px 3px; border:0; border-bottom:2px solid transparent; background:transparent; color:var(--pptx-muted-foreground,#a5a5b5); font-size:10px; cursor:pointer; }
	.tabs button.active { border-bottom-color:#f59e0b; color:#f59e0b; }
	.tabs button:focus-visible, header button:focus-visible, .master-item:focus-visible { outline:2px solid var(--pptx-ring,#6366f1); outline-offset:-2px; }
	.body { flex:1; min-height:0; overflow-y:auto; padding:6px; }
	.bg-card { display:flex; flex-direction:column; gap:6px; margin:0 0 8px; padding:8px; border:1px solid var(--pptx-border,#33334d); border-radius:6px; font:11px system-ui,sans-serif; color:var(--pptx-muted-foreground,#a5a5b5); }
	.bg-card .swatch { width:100%; height:30px; border:1px solid var(--pptx-border,#33334d); border-radius:5px; background:transparent; cursor:pointer; }
	.master-item { display:flex; width:100%; flex-direction:column; gap:5px; margin:0 0 8px; padding:5px; border:2px solid transparent; border-radius:6px; background:transparent; color:inherit; text-align:left; cursor:pointer; font:10px system-ui,sans-serif; }
	.master-item.layout { width:calc(100% - 14px); margin-left:14px; }
	.master-item:hover { background:var(--pptx-accent,#33334d); }
	.master-item.active { border-color:var(--pptx-primary,#6366f1); background:color-mix(in srgb,var(--pptx-primary,#6366f1) 12%,transparent); }
	.thumb { position:relative; display:block; overflow:hidden; max-width:100%; background:white; pointer-events:none; }
	p { color:var(--pptx-muted-foreground,#a5a5b5); font-size:12px; }
</style>
