import type {
	DialogFooterAction,
	DialogFooterIntent,
	PptxUiDialogFooterElement,
} from 'pptx-viewer-shared';
import React from 'react';

import { useWebControl } from '../hooks/useWebControl';

export interface DialogFooterProps {
	actions: readonly DialogFooterAction[];
	/** Called with the id of the activated action. Hosts keep every effect. */
	onAction: (id: string) => void;
}

/**
 * Thin adapter around the shared `pptx-ui-dialog-footer`: the Cancel / OK /
 * primary row at the bottom of a dialog. The dialog shell, its backdrop and
 * dismissal stay in the dialog component.
 */
export function DialogFooter({ actions, onAction }: DialogFooterProps): React.ReactElement {
	const ref = useWebControl<PptxUiDialogFooterElement>(
		{ actions },
		{
			'dialog-footer-request': (event) => onAction((event.detail as DialogFooterIntent).id),
		},
	);
	return <pptx-ui-dialog-footer ref={ref} />;
}
