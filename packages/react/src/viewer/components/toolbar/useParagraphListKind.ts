import type { PptxElement } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import {
	elementBulletKind,
	getInlineEditorSelectionResult,
	selectedParagraphBulletKind,
} from 'pptx-viewer-shared';
import type { ElementBulletKind } from 'pptx-viewer-shared';
import { useCallback, useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
	document.addEventListener('selectionchange', onChange);
	document.addEventListener('input', onChange);
	return () => {
		document.removeEventListener('selectionchange', onChange);
		document.removeEventListener('input', onChange);
	};
}

/** Match list-button state to the same paragraph scope used by its command. */
export function useParagraphListKind(element: PptxElement | null): ElementBulletKind {
	const read = useCallback(() => {
		if (!element || !hasTextProperties(element)) {
			return 'none' as const;
		}
		const result = getInlineEditorSelectionResult(element.textSegments, { preserveCaret: true });
		if (
			result.kind === 'unsupported' ||
			(result.snapshot && result.snapshot.elementId !== element.id)
		) {
			return 'none' as const;
		}
		return selectedParagraphBulletKind(
			{
				...element,
				textSegments: result.snapshot?.textSegments ?? element.textSegments,
			},
			result.selection,
		);
	}, [element]);
	const readServer = useCallback(() => (element ? elementBulletKind(element) : 'none'), [element]);
	return useSyncExternalStore(subscribe, read, readServer);
}
