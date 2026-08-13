<script lang="ts">
	import CheckCircle2 from '@lucide/svelte/icons/check-circle-2';
	import LockKeyhole from '@lucide/svelte/icons/lock-keyhole';
	import X from '@lucide/svelte/icons/x';
	import { getPasswordStrength, validatePasswordPair } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';

	const { protected: isProtected, onset, onremove, onclose }: { protected: boolean; onset: (password: string) => void; onremove: () => void; onclose: () => void } = $props();
	const t = useTranslator();
	// eslint-disable-next-line prefer-const
	let password = $state('');
	// eslint-disable-next-line prefer-const
	let confirmation = $state('');
	// eslint-disable-next-line prefer-const
	let visible = $state(false);
	let error = $state('');
	const strength = $derived(getPasswordStrength(password));
	const labels = $derived([t('pptx.security.strengthVeryWeak'), t('pptx.security.strengthWeak'), t('pptx.security.strengthFair'), t('pptx.security.strengthStrong'), t('pptx.security.strengthVeryStrong')]);
	const colors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e'];

	function submit(): void {
		const validation = validatePasswordPair(password, confirmation);
		if (validation) {
			error = t(validation === 'required' ? 'pptx.security.errorPasswordRequired' : validation === 'mismatch' ? 'pptx.security.errorPasswordMismatch' : 'pptx.security.errorPasswordTooShort');
			return;
		}
		onset(password);
		onclose();
	}
</script>

<div class="backdrop">
	<button class="scrim" type="button" aria-label={t('pptx.common.close')} onclick={onclose}></button>
	<div class="panel" role="dialog" aria-modal="true" aria-labelledby="pptx-svelte-password-title">
		<header><div><span><LockKeyhole size={18} strokeWidth={1.8} aria-hidden="true" /></span><h2 id="pptx-svelte-password-title">{t('pptx.security.protectPresentation')}</h2></div><button type="button" aria-label={t('pptx.common.close')} onclick={onclose}><X size={16} aria-hidden="true" /></button></header>
		<div class="body">
			{#if isProtected}<p class="protected"><CheckCircle2 size={15} aria-hidden="true" /> {t('pptx.security.currentlyProtected')}</p>{/if}
			<p class="description">{t('pptx.security.description')}</p>
			<label><span>{t('pptx.security.password')}</span><div class="password"><input type={visible ? 'text' : 'password'} bind:value={password} oninput={() => (error = '')} /><button type="button" onclick={() => (visible = !visible)}>{visible ? t('pptx.security.hidePassword') : t('pptx.security.showPassword')}</button></div></label>
			{#if password}<div class="strength"><div>{#each Array(5) as _, index}<i style:background={index <= strength ? colors[strength] : 'var(--pptx-accent,#3f3f52)'}></i>{/each}</div><small>{labels[strength]}</small></div>{/if}
			<label><span>{t('pptx.security.confirmPassword')}</span><input type={visible ? 'text' : 'password'} bind:value={confirmation} oninput={() => (error = '')} /></label>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		</div>
		<footer>{#if isProtected}<button type="button" class="remove" onclick={() => { onremove(); onclose(); }}>{t('pptx.security.removePassword')}</button>{/if}<span></span><button type="button" onclick={onclose}>{t('pptx.common.cancel')}</button><button type="button" class="primary" onclick={submit}>{t(isProtected ? 'pptx.security.updatePassword' : 'pptx.security.setPassword')}</button></footer>
	</div>
</div>

<style>
	.backdrop{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:#0009}.scrim{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent}.panel{position:relative;width:min(420px,calc(100vw - 32px));border:1px solid var(--pptx-border,#3f3f52);border-radius:12px;background:var(--pptx-card,#1e1e2e);color:var(--pptx-card-foreground,#e2e8f0);box-shadow:0 24px 80px #0008}header,footer{display:flex;align-items:center;gap:8px;padding:14px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}header{justify-content:space-between}header div{display:flex;align-items:center;gap:9px}header span{color:var(--pptx-primary,#c43b32)}h2,p{margin:0}h2{font-size:14px}.body{display:grid;gap:13px;padding:18px}.description,label{font-size:12px}.description,label span,small{color:var(--pptx-muted-foreground,#94a3b8)}label{display:grid;gap:5px}.password{display:flex}.password input{min-width:0;flex:1;border-radius:6px 0 0 6px}.password button{border-radius:0 6px 6px 0}input,button{border:1px solid var(--pptx-border,#3f3f52);padding:7px 9px;background:var(--pptx-muted,#2a2a3d);color:inherit}input{border-radius:6px}.protected{padding:9px;border:1px solid #15803d66;border-radius:7px;background:#14532d33;color:#86efac;font-size:12px}.strength div{display:flex;gap:4px}.strength i{height:4px;flex:1;border-radius:4px}.error{color:#f87171;font-size:11px}footer{border-top:1px solid var(--pptx-border,#3f3f52);border-bottom:0}footer span{flex:1}footer button{border-radius:6px}.primary{background:var(--pptx-primary,#c43b32)}.remove{color:#f87171}@media(max-width:600px){.panel{position:fixed;inset:auto 0 0;width:100%;border-radius:16px 16px 0 0}}
</style>
