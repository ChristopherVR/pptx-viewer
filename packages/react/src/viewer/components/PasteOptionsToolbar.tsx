/**
 * PasteOptionsToolbar: the small icon-strip PowerPoint anchors to the
 * bottom-right corner of a just-pasted element, offering the same four
 * formats as the Paste Special dialog as a one-click follow-up. Dismissed by
 * any subsequent pointerdown or keydown, same as the element context menu.
 *
 * A thin adapter around the shared `pptx-ui-paste-options`: this measures the
 * pasted element and the element renders, positions and dismisses the strip.
 */
import { findCanvasElementNode } from 'pptx-viewer-shared';
import type {
	PasteOptionsIntent,
	PasteSpecialFormat,
	PptxUiPasteOptionsElement,
} from 'pptx-viewer-shared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useWebControl } from '../hooks/useWebControl';

export interface PasteOptionsToolbarProps {
	/** The just-pasted element's id, used to find its mounted DOM node. */
	elementId: string | null;
	onChoose: (format: PasteSpecialFormat) => void;
	onDismiss: () => void;
}

export function PasteOptionsToolbar({
	elementId,
	onChoose,
	onDismiss,
}: PasteOptionsToolbarProps): React.ReactElement | null {
	const { t } = useTranslation();
	const [rect, setRect] = useState<{ left: number; top: number } | null>(null);

	useEffect(() => {
		const node = elementId
			? findCanvasElementNode(document, elementId, { canvasOnly: true })
			: null;
		const box = node?.getBoundingClientRect();
		setRect(box ? { left: box.right, top: box.bottom } : null);
	}, [elementId]);

	const ref = useWebControl<PptxUiPasteOptionsElement>(
		{ left: rect?.left ?? 0, top: rect?.top ?? 0, translate: t },
		{
			'paste-options-request': (event) => onChoose((event.detail as PasteOptionsIntent).format),
			'paste-options-dismiss': () => onDismiss(),
		},
	);

	if (!elementId || !rect) {
		return null;
	}
	return <pptx-ui-paste-options ref={ref} />;
}
