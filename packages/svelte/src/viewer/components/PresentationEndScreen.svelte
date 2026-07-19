<script lang="ts">
	/**
	 * The "End of slide show" black screen shown past the last slide when
	 * Options > Advanced > "End with black slide" is on. Any click (or
	 * Enter/Space via the button semantics) exits the presentation.
	 */
	import { useTranslator } from '../../i18n/context';

	const { onexit }: { onexit: () => void } = $props();
	const t = useTranslator();
</script>

<button type="button" class="pptx-svelte-presentation-end" onclick={onexit}>
	{t('pptx.presentation.endOfSlideShow')}
</button>

<style>
	.pptx-svelte-presentation-end {
		position: absolute;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		border: 0;
		background: #000;
		color: #9ca3af;
		font: 14px system-ui, sans-serif;
		cursor: pointer;
	}
</style>
