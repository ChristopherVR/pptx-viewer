<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Type from '@lucide/svelte/icons/type';
	import X from '@lucide/svelte/icons/x';
	import { scanAvailableFontFamilies } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';

	const {
		usedFontFamilies,
		embeddedFonts,
		enabled,
		canEmbed = true,
		unavailableKey,
		ontoggle,
		onclose,
	}: {
		usedFontFamilies: string[];
		embeddedFonts: string[];
		enabled: boolean;
		/**
		 * False when the deck embeds nothing, in which case the switch is inert and
		 * says why: the viewer can keep or strip embedded font data on save, but it
		 * cannot manufacture it from an installed system face.
		 */
		canEmbed?: boolean;
		/** i18n key for the explanation shown when `canEmbed` is false. */
		unavailableKey?: string;
		ontoggle: (enabled: boolean) => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();
	let available = $state<Set<string>>(new Set());
	let scanning = $state(true);
	const embedded = $derived(new Set(embeddedFonts));
	const missingCount = $derived(usedFontFamilies.filter((font) => !available.has(font)).length);

	$effect(() => {
		let active = true;
		scanning = true;
		void scanAvailableFontFamilies(usedFontFamilies).then((found) => {
			if (active) {
				available = found;
				scanning = false;
			}
			return found;
		});
		return () => {
			active = false;
		};
	});
</script>

<div class="backdrop">
	<button class="scrim" type="button" aria-label={t('pptx.common.close')} onclick={onclose}></button>
	<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pptx-svelte-fonts-title">
		<header>
			<div><span><Type size={17} aria-hidden="true" /></span><h2 id="pptx-svelte-fonts-title">{t('pptx.fonts.embedFonts')}</h2></div>
			<button type="button" aria-label={t('pptx.common.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button>
		</header>
		<div class="body">
			<p>{t('pptx.fonts.embedDescription')}</p>
			<label class="toggle" class:inert={!canEmbed}><input type="checkbox" checked={enabled} disabled={!canEmbed} onchange={(event) => ontoggle(event.currentTarget.checked)} /><span>{t('pptx.fonts.enableEmbedding')}</span></label>
			<!-- The switch used to move and change nothing at all. It now decides
			     whether save keeps the deck's embedded font data, so it has to say
			     which of the two it is doing, and admit when it can do neither. -->
			<p class="status">{canEmbed ? t('pptx.fonts.embedKeepsExisting') : t(unavailableKey ?? 'pptx.fonts.embedUnavailable')}</p>
			<h3>{t('pptx.fonts.usedFonts')} ({usedFontFamilies.length})</h3>
			{#if scanning}
				<p class="status">{t('pptx.fonts.scanning')}</p>
			{:else if usedFontFamilies.length === 0}
				<p class="status">{t('pptx.fontEmbedding.noCustomFonts')}</p>
			{:else}
				<div class="fonts">
					{#each usedFontFamilies as family}
						<div class="font"><span>{family}</span><span class="badges">{#if embedded.has(family)}<b>{t('pptx.fonts.embedded')}</b>{/if}{#if available.has(family)}<i><Check size={14} aria-hidden="true" /></i>{:else}<em>{t('pptx.fonts.notFound')}</em>{/if}</span></div>
					{/each}
				</div>
			{/if}
			{#if !scanning && missingCount > 0}<p class="warning">{t('pptx.fonts.missingWarning', { count: missingCount })}</p>{/if}
		</div>
		<footer><button type="button" onclick={onclose}>{t('pptx.common.done')}</button></footer>
	</div>
</div>

<style>
	.backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:#0009}.scrim{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent}.panel{position:relative;width:min(460px,calc(100vw - 32px));max-height:80vh;overflow:auto;border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);color:var(--pptx-card-foreground,#e2e8f0);box-shadow:0 24px 80px #0008}header,footer{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}header div{display:flex;align-items:center;gap:9px}header span{display:grid;width:24px;height:24px;place-items:center;border-radius:6px;background:color-mix(in srgb,var(--pptx-primary,#c43b32) 18%,transparent);color:var(--pptx-primary,#c43b32);font-weight:700}h2,h3,p{margin:0}h2{font-size:14px}h3{font-size:12px}.body{display:grid;gap:16px;padding:18px}.body>p,.status{font-size:12px;color:var(--pptx-muted-foreground,#94a3b8)}button,input{accent-color:var(--pptx-primary,#c43b32)}button{border:1px solid var(--pptx-border,#3f3f52);border-radius:6px;padding:6px 10px;background:var(--pptx-muted,#2a2a3d);color:inherit}.toggle{display:flex;align-items:center;gap:10px;font-size:12px}.toggle.inert{opacity:.6;cursor:not-allowed}.fonts{display:grid;gap:6px;max-height:280px;overflow:auto}.font{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:9px 10px;border-radius:8px;background:var(--pptx-muted,#2a2a3d);font-size:12px}.badges{display:flex;align-items:center;gap:7px}.badges b{padding:2px 5px;border-radius:4px;background:#16653455;color:#86efac;font-size:10px}.badges i{color:#4ade80;font-style:normal}.badges em,.warning{color:#fbbf24;font-size:10px;font-style:normal}.warning{font-size:11px}footer{justify-content:flex-end;border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}@media(max-width:600px){.panel{position:fixed;inset:auto 0 0;width:100%;max-height:88dvh;border-radius:16px 16px 0 0}}
</style>
