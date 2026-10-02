<script lang="ts">
	/**
	 * The slide-show right-click menu, shown while presenting when Options >
	 * Advanced > "Show menu on right mouse click" is on.
	 *
	 * Item order/grouping/i18n keys come from the shared
	 * `getPresentationContextMenuSections` (`pptx-viewer-shared`), the same
	 * source every binding renders from, and the rows are drawn by the shared
	 * `pptx-ui-context-menu`. The caller passes which capabilities are available
	 * (this binding has all of them) and a single `onaction` dispatch; it decides
	 * what each id does.
	 */
	import {
		CONTEXT_MENU_PRESENTATION_LAYER,
		getPresentationContextMenuSections,
		presentationViewItems,
	} from 'pptx-viewer-shared';
	import type {
		PresentationContextMenuActionId,
		PresentationContextMenuCapabilities,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import ContextMenuSurface from './ContextMenuSurface.svelte';

	const {
		x,
		y,
		capabilities,
		onaction,
		onclose,
	}: {
		x: number;
		y: number;
		capabilities: PresentationContextMenuCapabilities;
		onaction: (id: PresentationContextMenuActionId) => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	const sections = $derived(getPresentationContextMenuSections(capabilities));

	function run(id: string): void {
		onaction(id as PresentationContextMenuActionId);
		onclose();
	}
</script>

<ContextMenuSurface
	{x}
	{y}
	label={t('pptx.presentation.menuLabel')}
	markers={['data-pptx-presentation-menu']}
	zIndex={CONTEXT_MENU_PRESENTATION_LAYER}
	items={presentationViewItems(sections, t)}
	onrequest={run}
	{onclose}
/>
