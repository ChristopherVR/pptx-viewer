import type { Translator } from '../../../../i18n';
import type { ButtonHandle } from '../../../controls';
import { makeButton } from '../../../controls';

/**
 * Insert > Link.
 *
 * The viewer already shipped the hyperlink editor (`hyperlink-edit-dialog.ts`)
 * and the context-menu entry that opens it, but never the ribbon entry point
 * PowerPoint puts on Insert, so the command was discoverable only by
 * right-clicking. Gated on the selection alone rather than on editability,
 * because a link always attaches to something and that is the rule every other
 * binding applies to this button.
 */
export function createHyperlinkButton(
	doc: Document,
	t: Translator,
	onOpen: () => void,
): ButtonHandle {
	const button = makeButton(doc, {
		label: t('pptx.hyperlinkDialog.title'),
		icon: 'link',
		textLabel: t('pptx.hyperlinkDialog.title'),
		onClick: onOpen,
	});
	// Nothing is selected on mount, so the button starts unavailable and the
	// tab's `setHasSelection` takes over from there.
	button.setDisabled(true);
	return button;
}
