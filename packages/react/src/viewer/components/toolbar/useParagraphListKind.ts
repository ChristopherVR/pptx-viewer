import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	elementBulletKind,
	getInlineEditorSelection,
	selectedParagraphBulletKind,
} from 'pptx-viewer-shared';
import type { ParagraphBulletKind } from 'pptx-viewer-shared';
import { useCallback, useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
	document.addEventListener('selectionchange', onChange);
	return () => document.removeEventListener('selectionchange', onChange);
}

/** Match list-button state to the same paragraph scope used by its command. */
export function useParagraphListKind(element: PptxElement | null): ParagraphBulletKind {
	const read = useCallback(() => {
		if (!element || !hasTextProperties(element)) {
			return 'none' as const;
		}
		return selectedParagraphBulletKind(element, getInlineEditorSelection(element.textSegments));
	}, [element]);
	const readServer = useCallback(() => (element ? elementBulletKind(element) : 'none'), [element]);
	return useSyncExternalStore(subscribe, read, readServer);
}
