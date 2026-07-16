import type { PptxElementAnimation } from 'pptx-viewer-core';

export function reorderAnimationEntries(
	entries: readonly PptxElementAnimation[],
	sourceId: string,
	targetId: string,
): PptxElementAnimation[] {
	const next = [...entries];
	const from = next.findIndex((entry) => entry.elementId === sourceId);
	const to = next.findIndex((entry) => entry.elementId === targetId);
	if (from < 0 || to < 0 || from === to) {
		return next;
	}
	const [moved] = next.splice(from, 1);
	if (moved) {
		next.splice(to, 0, moved);
	}
	return next.map((entry, order) => ({ ...entry, order }));
}
