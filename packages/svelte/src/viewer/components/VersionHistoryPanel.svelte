<script lang="ts">
	import { deleteAutosaveSnapshot, formatBackstageSize, formatRelativeTime, formatVersionTimestamp, getAutosaveSnapshot } from 'pptx-viewer-shared';
import type { AutosaveRecord } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';

	const { filePath, onclose, onrestore }: { filePath?: string; onclose: () => void; onrestore: (data: Uint8Array) => void | Promise<void> } = $props();
	const t = useTranslator();
	let version = $state<AutosaveRecord>();
	let loading = $state(true);
	let busy = $state(false);

	$effect(() => {
		loading = true;
		void (filePath ? getAutosaveSnapshot(filePath) : Promise.resolve(undefined)).then((record) => {
			version = record;
			loading = false;
			return record;
		});
	});

	async function restore(): Promise<void> {
		if (!version) {return;}
		busy = true;
		try {
			await onrestore(version.data);
			onclose();
		} finally {
			busy = false;
		}
	}

	async function remove(): Promise<void> {
		if (!version) {return;}
		busy = true;
		await deleteAutosaveSnapshot(version.key);
		version = undefined;
		busy = false;
	}
</script>

<aside class="history" aria-label={t('pptx.versionHistory.title')}>
	<header><span>◷</span><h2>{t('pptx.versionHistory.title')}</h2><button type="button" aria-label={t('pptx.common.close')} onclick={onclose}>×</button></header>
	<div class="content">
		{#if loading}<p class="empty">{t('common.loading')}</p>
		{:else if !version}<p class="empty">{t('pptx.versionHistory.noVersions')}</p>
		{:else}<article>
			<div><strong>{formatVersionTimestamp(version.timestamp)}</strong><small>{formatRelativeTime(version.timestamp)}</small></div>
			<p>{formatBackstageSize(version.size)}</p>
			<footer><button class="restore" type="button" disabled={busy} onclick={() => void restore()}>↙ {t('pptx.versionHistory.restore')}</button><button class="delete" type="button" disabled={busy} onclick={() => void remove()}>⌫ {t('common.delete')}</button></footer>
		</article>{/if}
	</div>
</aside>

<style>
	.history{position:absolute;inset:0 0 0 auto;z-index:80;display:flex;width:min(320px,100%);flex-direction:column;border-left:1px solid var(--pptx-border,#3f3f52);background:var(--pptx-background,#171722);color:var(--pptx-foreground,#e2e8f0);box-shadow:-18px 0 48px #0005;font-family:Aptos,"Segoe UI",sans-serif}.history>header{display:flex;height:48px;align-items:center;gap:9px;padding:0 12px;border-bottom:1px solid var(--pptx-border,#3f3f52)}h2{flex:1;margin:0;font-size:14px;font-weight:600}.history button{border:0;border-radius:6px;background:transparent;color:inherit}.history>header button{width:30px;height:30px;font-size:20px}.history button:hover{background:var(--pptx-accent,#343447)}.content{flex:1;overflow:auto}.empty{margin:0;padding:34px 16px;text-align:center;color:var(--pptx-muted-foreground,#9ca3af);font-size:12px}article{padding:14px;border-bottom:1px solid var(--pptx-border,#3f3f52)}article>div{display:flex;justify-content:space-between;gap:12px}strong{font-size:12px;font-weight:500}small,article>p{color:var(--pptx-muted-foreground,#9ca3af);font-size:10px}article>p{margin:5px 0 0}footer{display:flex;gap:6px;margin-top:12px}footer button{padding:6px 9px;font-size:10px}.restore{background:color-mix(in srgb,var(--pptx-primary,#c43e1c) 20%,transparent)!important;color:var(--pptx-primary,#f97350)!important}.delete{color:#f87171!important}button:disabled{opacity:.45}@media(max-width:600px){.history{position:fixed;top:auto;height:min(72dvh,560px);border-top:1px solid var(--pptx-border,#3f3f52);border-left:0;box-shadow:0 -18px 48px #0007}}
</style>
