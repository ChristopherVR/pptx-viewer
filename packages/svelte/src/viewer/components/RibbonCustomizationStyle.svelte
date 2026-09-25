<script lang="ts">
	/**
	 * RibbonCustomizationStyle: the viewer's ONE `<style>` element for host
	 * ribbon-group / ribbon-control hiding. The rules come from shared's
	 * `ribbonCustomizationCss` (which validates every id against the catalogue,
	 * so a host string cannot inject CSS), scoped to this viewer's
	 * `data-pptx-ribbon-scope` token so two viewers on a page never hide each
	 * other's controls. Re-renders whenever the resolved customisation changes
	 * (the `customization` prop or an imperative `hideRibbonGroup(...)`).
	 */
	import { ribbonCustomizationCss } from 'pptx-viewer-shared';

	import { useViewerCustomization } from '../state/viewer-customization.svelte';

	const { scope }: { scope: string } = $props();
	const custom = useViewerCustomization();
	// Split so neither the markup nor the script parser sees a literal closing
	// style tag.
	const CLOSE = ['<', '/style>'].join('');
	const markup = $derived(
		`<style data-pptx-ribbon-customization="">${ribbonCustomizationCss(custom.resolved, scope)}${CLOSE}`,
	);
</script>

{@html markup}
