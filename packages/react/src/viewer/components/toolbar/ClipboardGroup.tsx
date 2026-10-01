import { clipboardHomeControls } from 'pptx-viewer-shared';
import React, { useCallback, useMemo } from 'react';

import { WebHomeControls } from './WebHomeControls';

export interface ClipboardGroupProps {
	canEdit: boolean;
	/** Cut and Copy act on the selection, so they need one. */
	hasSelection: boolean;
	canPaste: boolean;
	formatPainterActive?: boolean;
	canActivateFormatPainter?: boolean;
	onCopy: () => void;
	onCut: () => void;
	onPaste: () => void;
	onToggleFormatPainter?: () => void;
}

/** Home > Clipboard: the shared Paste, Cut, Copy and Format Painter strip. */
export function ClipboardGroup(p: ClipboardGroupProps): React.ReactElement {
	const { canEdit, hasSelection, canPaste, formatPainterActive, canActivateFormatPainter } = p;
	const { onPaste, onCut, onCopy, onToggleFormatPainter } = p;
	const controls = useMemo(
		() =>
			clipboardHomeControls({
				editable: canEdit,
				hasSelection,
				hasClipboard: canPaste,
				formatPainterActive: Boolean(formatPainterActive),
				canFormatPaint: canActivateFormatPainter !== false,
				showFormatPainter: Boolean(onToggleFormatPainter),
			}),
		[
			canEdit,
			hasSelection,
			canPaste,
			formatPainterActive,
			canActivateFormatPainter,
			onToggleFormatPainter,
		],
	);
	const request = useCallback(
		(id: string) => {
			switch (id) {
				case 'home.clipboard.paste':
					onPaste();
					break;
				case 'home.clipboard.cut':
					onCut();
					break;
				case 'home.clipboard.copy':
					onCopy();
					break;
				case 'home.clipboard.formatPainter':
					onToggleFormatPainter?.();
			}
		},
		[onPaste, onCut, onCopy, onToggleFormatPainter],
	);
	return <WebHomeControls family='clipboard' controls={controls} onRequest={request} />;
}
