<script lang="ts">
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Hash from '@lucide/svelte/icons/hash';
	import Text from '@lucide/svelte/icons/text';
	import X from '@lucide/svelte/icons/x';
	import type { PptxHeaderFooter } from 'pptx-viewer-core';
	import { cloneHeaderFooterDraft, patchHeaderFooterDraft } from 'pptx-viewer-shared';
	import { untrack } from 'svelte';
	import { useTranslator } from '../../i18n/context';

	const { value, onclose, onapply }: { value: PptxHeaderFooter; onclose: () => void; onapply: (next: PptxHeaderFooter) => void } = $props();
	const t = useTranslator();
	let draft = $state<PptxHeaderFooter>(cloneHeaderFooterDraft(untrack(() => value)));
	const toggle = (key: keyof PptxHeaderFooter, checked: boolean) => { draft = patchHeaderFooterDraft(draft, { [key]: checked }); };
</script>
<div class="backdrop"><button class="scrim" type="button" aria-label={t('pptx.headerFooter.close')} onclick={onclose}></button>
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="hf-title"><header><h2 id="hf-title">{t('pptx.headerFooter.title')}</h2><button type="button" aria-label={t('pptx.headerFooter.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button></header>
		<div class="body"><label><input type="checkbox" checked={draft.hasDateTime ?? false} onchange={(event) => toggle('hasDateTime', event.currentTarget.checked)} /><CalendarDays size={14} aria-hidden="true" /> {t('pptx.headerFooter.dateAndTime')}</label><label><input type="checkbox" checked={draft.hasSlideNumber ?? false} onchange={(event) => toggle('hasSlideNumber', event.currentTarget.checked)} /><Hash size={14} aria-hidden="true" /> {t('pptx.headerFooter.slideNumber')}</label><label><input type="checkbox" checked={draft.hasFooter ?? false} onchange={(event) => toggle('hasFooter', event.currentTarget.checked)} /><Text size={14} aria-hidden="true" /> {t('pptx.headerFooter.footer')}</label>{#if draft.hasFooter}<input type="text" aria-label={t('pptx.headerFooter.footer')} placeholder={t('pptx.headerFooter.footerPlaceholder')} value={draft.footerText ?? ''} oninput={(event) => (draft = patchHeaderFooterDraft(draft, { footerText: event.currentTarget.value }))} />{/if}</div>
		<footer><button type="button" onclick={() => { onapply(draft); onclose(); }}>{t('pptx.headerFooter.applyToAll')}</button><button class="primary" type="button" onclick={() => { onapply(draft); onclose(); }}>{t('pptx.headerFooter.applyToCurrent')}</button></footer>
	</section>
</div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0007}.scrim{position:absolute;inset:0;border:0;background:transparent}section{position:relative;width:min(390px,calc(100vw - 32px));border:1px solid var(--pptx-border,#3f3f52);border-radius:11px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 70px #0009}header,footer{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2{margin:0;font-size:14px}.body{display:grid;gap:14px;padding:18px}.body label{display:flex;align-items:center;gap:7px;font-size:12px}.body input[type=checkbox]{accent-color:var(--pptx-primary,#c43b32)}.body input[type=text]{margin-left:24px;border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:8px;background:var(--pptx-muted,#2a2a3d);color:inherit}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:6px 10px;background:var(--pptx-muted,#2a2a3d);color:inherit}header button{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent}footer{justify-content:flex-end;gap:8px;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}.primary{background:var(--pptx-primary,#c43b32);color:#fff}@media(max-width:600px){section{position:fixed;inset:auto 0 0;width:100%;border-radius:16px 16px 0 0}}
</style>
