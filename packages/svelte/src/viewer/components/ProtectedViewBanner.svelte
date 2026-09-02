<script lang="ts">
	/**
	 * ProtectedViewBanner: shown above the canvas when a deck opened from an
	 * untrusted source (a download, an email attachment) is locked in Protected
	 * View. Extracted out of `ViewerChrome.svelte` (which had grown past the
	 * repo's 300-LOC budget) and given a scoped stylesheet block: it previously
	 * carried only Tailwind utility classes, which this package's Tailwind is
	 * never scanned for by the demo (see the repo's CLAUDE.md), so the banner
	 * rendered unstyled. `ReadOnlyBanner.svelte` is the sibling banner this one
	 * was originally modelled on and shares the same look.
	 */
	import { useTranslator } from '../../i18n/context';

	const { onenableediting }: { onenableediting: () => void } = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-protected-view-banner" role="status">
	<span class="pptx-svelte-protected-view-banner-icon" aria-hidden="true">🔒</span>
	<p class="pptx-svelte-protected-view-banner-text">
		<strong>{t('pptx.security.protectedViewTitle')}</strong>:
		{t('pptx.options.trust.protectedViewInfo')}
	</p>
	<button
		type="button"
		class="pptx-svelte-protected-view-banner-enable"
		onclick={onenableediting}
	>
		{t('pptx.security.enableEditing')}
	</button>
</div>

<style>
	.pptx-svelte-protected-view-banner {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 6px 16px;
		border-bottom: 1px solid rgba(180, 83, 9, 0.3);
		background: rgba(120, 53, 15, 0.2);
		font-size: 12px;
	}
	.pptx-svelte-protected-view-banner-icon {
		flex: none;
		width: 16px;
		height: 16px;
		color: #fbbf24;
	}
	.pptx-svelte-protected-view-banner-text {
		flex: 1 1 auto;
		margin: 0;
		color: #fde68a;
		font-size: 12px;
	}
	.pptx-svelte-protected-view-banner-enable {
		flex: none;
		border: 1px solid rgba(217, 119, 6, 0.5);
		border-radius: 4px;
		padding: 4px 12px;
		background: transparent;
		color: #fef3c7;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}
	.pptx-svelte-protected-view-banner-enable:hover {
		background: rgba(180, 83, 9, 0.3);
	}
</style>
