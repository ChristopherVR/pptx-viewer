<script lang="ts">
	/**
	 * PresentSplitButton: React `PresentDropdown` port. A "Present" split button
	 * whose main half enters presentation mode from the current slide and whose
	 * chevron half opens a dropdown with Presenter View, Rehearse Timings,
	 * Set Up Slide Show, Present Online (broadcast), and a Subtitles toggle.
	 */
	import { useTranslator } from '../../../i18n/context';

	const {
		onpresent,
		onpresenter,
		onrehearse,
		onsetup,
		onbroadcast,
		onsubtitles,
		subtitlesEnabled = false,
	}: {
		onpresent: () => void;
		onpresenter?: () => void;
		onrehearse?: () => void;
		onsetup?: () => void;
		onbroadcast?: () => void;
		onsubtitles?: () => void;
		subtitlesEnabled?: boolean;
	} = $props();

	const t = useTranslator();
	let open = $state(false);

	function choose(action?: () => void): void {
		open = false;
		action?.();
	}

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			open = false;
		}
	}
</script>

<div class="pptx-svelte-present" onfocusout={onFocusOut}>
	<div class="pptx-svelte-present-split">
		<button
			type="button"
			class="pptx-svelte-present-main"
			title={t('pptx.present.presentTooltip')}
			onclick={() => choose(onpresent)}
		>
			{t('pptx.toolbar.present')}
		</button>
		<button
			type="button"
			class="pptx-svelte-present-chev"
			class:pptx-svelte-present-chev-open={open}
			aria-haspopup="menu"
			aria-expanded={open}
			aria-label={t('pptx.present.optionsTooltip')}
			title={t('pptx.present.optionsTooltip')}
			onclick={() => (open = !open)}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	</div>
	{#if open}
		<div class="pptx-svelte-present-menu" role="menu">
			<button type="button" role="menuitem" onclick={() => choose(onpresent)}>{t('pptx.toolbar.present')}</button>
			{#if onpresenter}<button type="button" role="menuitem" onclick={() => choose(onpresenter)}>{t('pptx.slideShow.presenterView')}</button>{/if}
			{#if onrehearse}<button type="button" role="menuitem" onclick={() => choose(onrehearse)}>{t('pptx.slideShow.rehearseTimings')}</button>{/if}
			<div class="pptx-svelte-present-divider" role="separator"></div>
			{#if onsetup}<button type="button" role="menuitem" onclick={() => choose(onsetup)}>{t('pptx.slideShow.setUp')}</button>{/if}
			{#if onbroadcast}<button type="button" role="menuitem" onclick={() => choose(onbroadcast)}>{t('pptx.present.presentOnline')}</button>{/if}
			{#if onsubtitles}
				<button type="button" role="menuitem" onclick={() => choose(onsubtitles)}>
					<span class="pptx-svelte-present-grow">{t('pptx.slideShow.showSubtitles')}</span>
					{#if subtitlesEnabled}<svg viewBox="0 0 16 16" aria-hidden="true" class="pptx-svelte-present-check"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>{/if}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-present {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-present-split {
		display: inline-flex;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
	}

	.pptx-svelte-present-main,
	.pptx-svelte-present-chev {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: 24px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11px;
	}

	.pptx-svelte-present-main {
		padding: 0 8px;
	}

	.pptx-svelte-present-chev {
		padding: 0 3px;
		border-left: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-present-main:hover,
	.pptx-svelte-present-chev:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-present-chev-open {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-present-chev svg {
		width: 12px;
		height: 12px;
	}

	.pptx-svelte-present-menu {
		position: absolute;
		top: 100%;
		right: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		width: 208px;
		flex-direction: column;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.35), 0 4px 6px -4px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-present-menu button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 6px 10px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		text-align: left;
	}

	.pptx-svelte-present-menu button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-present-divider {
		margin: 4px 0;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-present-grow {
		flex: 1;
	}

	.pptx-svelte-present-check {
		width: 12px;
		height: 12px;
		color: var(--pptx-primary, #6366f1);
	}
</style>
