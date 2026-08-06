<script lang="ts">
	import { onMount } from 'svelte';
	import type { Component } from 'svelte';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import Clock3 from '@lucide/svelte/icons/clock-3';
	import Copy from '@lucide/svelte/icons/copy';
	import FileCode2 from '@lucide/svelte/icons/file-code-2';
	import FileJson from '@lucide/svelte/icons/file-json';
	import FileText from '@lucide/svelte/icons/file-text';
	import FolderOpen from '@lucide/svelte/icons/folder-open';
	import Image from '@lucide/svelte/icons/image';
	import Images from '@lucide/svelte/icons/images';
	import Info from '@lucide/svelte/icons/info';
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
	import Package from '@lucide/svelte/icons/package';
	import Presentation from '@lucide/svelte/icons/presentation';
	import Printer from '@lucide/svelte/icons/printer';
	import Search from '@lucide/svelte/icons/search';
	import Settings from '@lucide/svelte/icons/settings';
	import Share2 from '@lucide/svelte/icons/share-2';
	import Type from '@lucide/svelte/icons/type';
	import Video from '@lucide/svelte/icons/video';
	import { BACKSTAGE_NAV, BACKSTAGE_TEMPLATES, backstageCardsFor, formatBackstageDate, formatBackstageSize, listBackstageRecentFiles } from 'pptx-viewer-shared';
	import type { AccountAuthConfig, BackstageCardId, BackstagePage, BackstageRecentFile } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { ExportUiState } from '../../../export/export-ui.svelte';
	import AccountPage from './AccountPage.svelte';
	import BackstageAction from './BackstageAction.svelte';
	import BackstageNavIcon from './BackstageNavIcon.svelte';

	const { fileName, onclose, oncreatepresentation, ondownload, ondownloadppsx, ondownloadpptm, onpackage, hasMacros, onopenfile, onopenrecent, exportUi, onproperties, onfonts, onsignatures, onprotect, onversionhistory, onshare, onprint, onsettings, accountAuth }: { fileName?: string; onclose: () => void; oncreatepresentation: (templateId: string) => void; ondownload: () => void; ondownloadppsx: () => void; ondownloadpptm: () => void; onpackage: () => void; hasMacros: boolean; onopenfile?: () => void; onopenrecent?: (key: string) => void; exportUi?: ExportUiState; onproperties?: () => void; onfonts?: () => void; onsignatures?: () => void; onprotect?: () => void; onversionhistory?: () => void; onshare?: () => void; onprint?: () => void; onsettings?: () => void; accountAuth?: AccountAuthConfig } = $props();
	const t = useTranslator();
	let page = $state<BackstagePage>('home');
	// eslint-disable-next-line prefer-const
	let query = $state('');
	let recent = $state<BackstageRecentFile[]>([]);
	onMount(() => { void listBackstageRecentFiles(t).then((items) => (recent = items)); });
	const visibleRecent = $derived.by(() => { const q = query.trim().toLowerCase(); return q ? recent.filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(q)) : recent; });
	const title = $derived(t(BACKSTAGE_NAV.find((item) => item.id === page)?.labelKey ?? 'pptx.backstage.nav.home'));
	function run(action?: () => void): void { action?.(); if (action) {onclose();} }
	const CARD_ICONS: Record<BackstageCardId, Component> = { protect: LockKeyhole, inspect: Info, embedFonts: Type, signatures: BadgeCheck, versionHistory: Clock3, saveAsPptx: FileText, saveAsPpsx: Presentation, saveAsPptm: FileCode2, package: Package, pdf: FileText, png: Image, video: Video, gif: Images, json: FileJson, copyImage: Copy, print: Printer, share: Share2, sharePackage: Package };
	const cardHandlers = $derived<Record<BackstageCardId, (() => void) | undefined>>({ protect: onprotect, inspect: onproperties, embedFonts: onfonts, signatures: onsignatures, versionHistory: onversionhistory, saveAsPptx: ondownload, saveAsPpsx: ondownloadppsx, saveAsPptm: ondownloadpptm, package: onpackage, pdf: () => void exportUi?.runPdf(), png: () => exportUi?.runPng(), video: () => void exportUi?.runVideo(), gif: () => void exportUi?.runGif(), json: () => void exportUi?.runJson(), copyImage: () => exportUi?.runCopyImage(), print: onprint, share: onshare, sharePackage: onpackage });
	const cards = $derived(backstageCardsFor(page).filter((card) => card.id !== 'saveAsPptm' || hasMacros));
	function select(id: BackstagePage): void { if (id === 'close') {onclose();} else if (id === 'save') {run(ondownload);} else if (id === 'options' && onsettings) {run(onsettings);} else {page = id;} }
</script>

<div class="bs" role="dialog" aria-modal="true" aria-label={t('pptx.backstage.title')}>
	<aside><button class="back" type="button" aria-label={t('pptx.backstage.back')} onclick={onclose}><BackstageNavIcon page="back" /></button><nav>
		{#each BACKSTAGE_NAV.filter((item) => !item.group) as item}<button type="button" class:active={page === item.id} onclick={() => select(item.id)}><span><BackstageNavIcon page={item.id} /></span>{t(item.labelKey)}</button>{/each}<i></i>
		{#each BACKSTAGE_NAV.filter((item) => item.group) as item}<button type="button" class:active={page === item.id} onclick={() => select(item.id)}><span><BackstageNavIcon page={item.id} /></span>{t(item.labelKey)}</button>{/each}
	</nav></aside>
	<main><h1>{page === 'home' ? t('pptx.backstage.greeting') : title}</h1>
		{#if page === 'home' || page === 'new'}<h2>{t('pptx.backstage.newHeading')}</h2><div class="templates">{#each BACKSTAGE_TEMPLATES as template}<button type="button" onclick={() => run(() => oncreatepresentation(template.id))}><b style:background={template.preview}></b><strong>{t(template.nameKey)}</strong><small>{t(template.descriptionKey)}</small></button>{/each}</div>{/if}
		{#if page === 'home' || page === 'open'}<div class="search"><Search size={16} aria-hidden="true" /><input type="search" placeholder={t('pptx.backstage.searchPlaceholder')} bind:value={query} /></div>{#if page === 'open'}<button class="primary" type="button" onclick={() => run(onopenfile)}><FolderOpen size={16} aria-hidden="true" />{t('pptx.backstage.browseDevice')}</button>{/if}<h2>{t('pptx.backstage.recentHeading')}</h2><div class="recent"><header><span>{t('pptx.backstage.columnName')}</span><span>{t('pptx.backstage.columnModified')}</span><span>{t('pptx.backstage.columnSize')}</span></header>{#each visibleRecent as file}<button type="button" onclick={() => run(() => onopenrecent?.(file.key))}><span class="name"><b>P</b><span><strong>{file.name}</strong><small>{file.location}</small></span></span><span>{formatBackstageDate(file.timestamp, Date.now(), t)}</span><span>{formatBackstageSize(file.size)}</span></button>{:else}<p>{t('pptx.backstage.noRecent')}</p>{/each}</div>{/if}
		{#if cards.length}<div class="actions">{#each cards as card (card.id)}<BackstageAction icon={CARD_ICONS[card.id]} title={t(card.titleKey)} body={t(card.bodyKey)} onclick={() => run(cardHandlers[card.id])} />{/each}</div>{/if}
		{#if page === 'account'}<AccountPage {accountAuth} />{/if}
		{#if page === 'options'}<section class="card"><b class="avatar"><Settings size={24} aria-hidden="true" /></b><h2>{t('pptx.backstage.optionsTitle')}</h2><p>{t('pptx.backstage.optionsBody')}</p>{#if onsettings}<button class="primary" type="button" onclick={() => run(onsettings)}>{t('pptx.backstage.openOptions')}</button>{/if}</section>{/if}
		<footer>{fileName || t('pptx.backstage.untitled')} · {t('pptx.backstage.savedToBrowser')}</footer>
	</main>
</div>

<style>
	/* `align-items:stretch` and `align-self:stretch` are explicit, not defaults:
	   this overlay is mounted inside the ribbon, whose `> *` rule sets
	   `align-items:flex-start` on its children. Without them the nav rail below
	   only grows to its own content height instead of filling the window, which
	   also collapses the `nav i` spacer that bottom-pins Account / Options. */
	.bs{position:fixed;inset:0;z-index:200;display:flex;align-items:stretch;align-self:stretch;background:var(--pptx-background,#fafafa);color:var(--pptx-foreground,#242424);font-family:Aptos,"Segoe UI",sans-serif}.bs aside{width:148px;flex:none;align-self:stretch;display:flex;flex-direction:column;background:var(--pptx-secondary,#f5eee9);border-right:1px solid var(--pptx-border,#d7d7d7)}.back{display:grid;place-items:center;height:48px;flex:none;border:0;border-bottom:1px solid var(--pptx-border,#ddd);background:none;color:inherit;font-size:22px}.back:hover,nav button:hover,.recent>button:hover{background:var(--pptx-accent,#eadfd8)}nav{display:flex;min-height:0;flex:1;flex-direction:column;padding:8px 0;background:var(--pptx-secondary,#f5eee9)}nav i{flex:1}nav button{min-height:40px;display:flex;align-items:center;gap:12px;padding:0 16px;border:0;border-left:2px solid transparent;background:none;text-align:left;font-size:12px;color:inherit}nav button span{width:16px;text-align:center;font-size:16px}nav button.active{border-left-color:var(--pptx-primary,#c43e1c);background:var(--pptx-card,#fff);color:var(--pptx-primary,#c43e1c)}main{flex:1;min-width:0;overflow:auto;padding:20px clamp(32px,4vw,72px);background:var(--pptx-background,#fafafa)}h1{margin:0;font-size:24px;font-weight:600}h2{margin:28px 0 18px;font-size:17px}.templates{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:24px}.templates button{border:0;background:none;text-align:left;color:inherit}.templates button>b{display:block;aspect-ratio:16/9;border:1px solid var(--pptx-border,#ccc);box-shadow:0 1px 2px #0002;transition:.15s}.templates button:hover>b{transform:translateY(-2px);border-color:var(--pptx-primary,#c43e1c);box-shadow:0 7px 18px #0002}.templates strong,.templates small{display:block;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}.templates small{margin-top:2px;color:var(--pptx-muted-foreground,#777);font-size:10px}.search{display:flex;align-items:center;gap:10px;width:min(540px,100%);height:40px;margin-top:32px;padding:0 12px;border:1px solid var(--pptx-input,#888);background:var(--pptx-card,#fff);color:var(--pptx-muted-foreground,#666)}.search input{min-width:0;flex:1;border:0;background:none;color:var(--pptx-card-foreground,#242424);font-size:13px;outline:none}.search:focus-within{border-color:var(--pptx-ring,#c43e1c)}.primary{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:10px 20px;border:0;background:var(--pptx-primary,#c43e1c);color:var(--pptx-primary-foreground,#fff);font-weight:600}.recent{border-top:1px solid var(--pptx-border,#ddd)}.recent header,.recent>button{display:grid;grid-template-columns:1fr 120px 90px;align-items:center;padding:10px 12px}.recent header{font-size:11px;font-weight:600;color:var(--pptx-muted-foreground,#666)}.recent>button{width:100%;border:0;border-top:1px solid var(--pptx-border,#e5e5e5);background:none;text-align:left;color:inherit;font-size:11px}.name{display:flex;min-width:0;align-items:center;gap:12px}.name>b{display:grid;width:32px;height:32px;place-items:center;background:var(--pptx-primary,#d24726);color:var(--pptx-primary-foreground,#fff)}.name strong,.name small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400}.name small,.recent p{font-size:11px;color:var(--pptx-muted-foreground,#666)}.recent p{text-align:center}.actions{display:grid;max-width:900px;grid-template-columns:1fr 1fr;gap:20px;margin-top:32px}.card{max-width:760px;margin-top:32px;padding:28px;border:1px solid var(--pptx-border,#ddd);background:var(--pptx-card,#fff);color:var(--pptx-card-foreground,#242424)}.avatar{display:grid;width:56px;height:56px;place-items:center;border-radius:50%;background:var(--pptx-primary,#c43e1c);color:var(--pptx-primary-foreground,#fff);font-size:20px}.card p,footer{color:var(--pptx-muted-foreground,#666)}.card p{line-height:1.6}footer{margin-top:48px;font-size:11px}@media(max-width:767px){.bs{flex-direction:column}.bs aside{width:100%;flex-direction:row;align-items:center;overflow-x:auto;border-right:0;border-bottom:1px solid var(--pptx-border,#d7d7d7)}.back{min-width:48px;flex:none;border-bottom:0;border-right:1px solid var(--pptx-border,#ddd)}nav{flex-direction:row;align-items:center;padding:0}nav i{display:none}nav button{flex:none;white-space:nowrap;border-left:0;border-bottom:2px solid transparent;padding:0 12px}nav button.active{border-left-color:transparent;border-bottom-color:var(--pptx-primary,#c43e1c)}main{padding:16px}.actions{grid-template-columns:1fr}.recent header,.recent>button{grid-template-columns:1fr 90px}.recent header span:last-child,.recent>button>span:last-child{display:none}}
</style>
