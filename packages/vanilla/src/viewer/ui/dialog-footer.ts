import { registerPptxWebControls } from 'pptx-viewer-shared';
import type {
	DialogFooterAction,
	DialogFooterRequestEvent,
	PptxUiDialogFooterElement,
} from 'pptx-viewer-shared';

/**
 * Mount the shared `pptx-ui-dialog-footer` into a dialog's footer container and
 * route its activated action id to `onAction`. The dialog shell, its backdrop and
 * dismissal stay with the dialog. Set `.state` again to change an action, for
 * example to disable both while a delete is in flight.
 */
export function appendDialogFooter(
	doc: Document,
	parent: HTMLElement,
	actions: readonly DialogFooterAction[],
	onAction: (id: string) => void,
): PptxUiDialogFooterElement {
	registerPptxWebControls();
	const footer = doc.createElement('pptx-ui-dialog-footer');
	footer.state = { actions };
	footer.addEventListener('dialog-footer-request', (event) =>
		onAction((event as DialogFooterRequestEvent).detail.id),
	);
	parent.append(footer);
	return footer;
}
