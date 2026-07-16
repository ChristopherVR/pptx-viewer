import type { PptxElement } from 'pptx-viewer-core';

/** Return every active-slide element that can trigger the selected element. */
export function getAnimationTriggerElements(
	elements: readonly PptxElement[],
	selectedElementId: string,
): PptxElement[] {
	return elements.filter((element) => element.id !== selectedElementId);
}

export function getAnimationElementLabel(element: PptxElement): string {
	const text = 'text' in element ? element.text?.trim() : undefined;
	return element.name || text || element.id;
}
