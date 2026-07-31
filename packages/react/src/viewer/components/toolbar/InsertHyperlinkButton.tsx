import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuLink } from 'react-icons/lu';

import { ic, pill } from './toolbar-constants';

export interface InsertHyperlinkButtonProps {
	/** Whether an element is selected; a link always attaches to something. */
	hasSelection: boolean;
	onOpenHyperlinkDialog: () => void;
}

/**
 * Insert ▸ Link.
 *
 * Its own file rather than another block inside `InsertSection`, which is
 * already well past the repo's 300-LOC budget. React shipped the hyperlink
 * editor (`HyperlinkEditDialog`) and the context-menu entry that opens it, but
 * never the ribbon entry point PowerPoint puts on Insert, so the Svelte
 * binding was the only one offering it from the tab.
 */
export function InsertHyperlinkButton(p: InsertHyperlinkButtonProps): React.ReactElement {
	const { t } = useTranslation();
	return (
		<button
			type='button'
			onClick={p.onOpenHyperlinkDialog}
			disabled={!p.hasSelection}
			className={pill}
			title={t('pptx.hyperlinkDialog.title')}
		>
			<LuLink className={ic} />
			{t('pptx.hyperlinkDialog.title')}
		</button>
	);
}
