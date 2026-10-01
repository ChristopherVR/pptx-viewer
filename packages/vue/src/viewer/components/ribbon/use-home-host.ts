import type { PptxUiRibbonHomeElement } from 'pptx-viewer-shared';
import { ref } from 'vue';

/**
 * Template ref for a shared `pptx-ui-ribbon-home-*` element plus the anchor of
 * one of its controls. Native popovers hang below that anchor but live in the
 * adapter's own markup, so the shared strip's styles never reach them.
 */
export function useHomeHost() {
	const host = ref<PptxUiRibbonHomeElement | null>(null);
	const anchorOf = (id: string): HTMLElement | null => host.value?.anchor(id) ?? null;
	return { host, anchorOf };
}
