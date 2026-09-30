<script lang="ts">
	import { buildRibbonGallery } from 'pptx-viewer-shared';
	import type { RibbonGalleryPickEvent, RibbonGalleryPlacement } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import { refocusViewerRoot } from '../anchored-popup';
	import { strictTranslator } from './gallery-labels';
	import { useRibbonGalleryHost } from './ribbon-gallery-host';

	const { placement, chevronOnly = false, tagControl = true }: { placement: RibbonGalleryPlacement; chevronOnly?: boolean; tagControl?: boolean } = $props();
	const host = useRibbonGalleryHost();
	const t = useTranslator();
	const translateLabel = strictTranslator(t);
	const descriptor = $derived(host ? host.build(placement.gallery) : buildRibbonGallery(placement.gallery, { element: null }));
	function pick(event: Event): void {
		refocusViewerRoot(event.currentTarget as HTMLElement);
		void host?.apply(placement.gallery, (event as RibbonGalleryPickEvent).detail.itemId);
	}
</script>
<pptx-ui-ribbon-gallery data-ribbon-control={tagControl ? placement.control : undefined} mode={placement.mode} chevron-only={chevronOnly || undefined}
	{descriptor} {translateLabel} disabled={!host} ongallery-pick={pick}></pptx-ui-ribbon-gallery>
