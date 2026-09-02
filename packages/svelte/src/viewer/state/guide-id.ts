/**
 * New alignment-guide id (`pptx-viewer-shared`'s `Guide.id`), mirroring the
 * element-id shape `editor-insert.ts` already uses for new elements. Guide
 * creation happens from two sites (the ruler-drag drop in `ViewerMain` and
 * the ribbon/mobile "Add H/V Guide" buttons in `ViewerChrome`), so this is
 * shared between them rather than duplicated.
 */
export function nextGuideId(): string {
	return `guide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
