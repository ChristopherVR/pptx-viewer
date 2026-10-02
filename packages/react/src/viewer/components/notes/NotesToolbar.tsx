import type { NotesToolbarRequestEvent } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface NotesToolbarProps {
	isRichEditEnabled: boolean;
	hasAllSlides: boolean;
	onApplyRichCommand: (command: 'bold' | 'italic' | 'underline' | 'strikeThrough') => void;
	onToggleBulletList: () => void;
	onToggleNumberedList: () => void;
	onIndent: () => void;
	onOutdent: () => void;
	onInsertLink: (url: string, displayText: string) => void;
	onPrintClick: () => void;
	onToggleRichEdit: () => void;
}

/**
 * Thin adapter around the shared `pptx-ui-notes-toolbar`: it maps panel state
 * onto the element and routes typed `notes-request` intents to the editor
 * handlers. The buttons, roving focus and hyperlink popover are shared.
 */
export function NotesToolbar(p: NotesToolbarProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<HTMLElement & { state: unknown }>(null);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = {
			rich: p.isRichEditEnabled,
			canFormat: p.isRichEditEnabled,
			showPrint: p.hasAllSlides,
			translate: t,
		};
	}, [p.isRichEditEnabled, p.hasAllSlides, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			const intent = (event as NotesToolbarRequestEvent).detail;
			switch (intent.kind) {
				case 'inline':
					p.onApplyRichCommand(intent.command);
					break;
				case 'paragraph':
					if (intent.command === 'bullet') {
						p.onToggleBulletList();
					} else if (intent.command === 'numbered') {
						p.onToggleNumberedList();
					} else if (intent.command === 'indent') {
						p.onIndent();
					} else {
						p.onOutdent();
					}
					break;
				case 'link':
					p.onInsertLink(intent.url, intent.text);
					break;
				case 'print':
					p.onPrintClick();
					break;
				case 'toggle-rich':
					p.onToggleRichEdit();
			}
		};
		host.addEventListener('notes-request', request);
		return () => host.removeEventListener('notes-request', request);
	}, [p]);
	return (
		<div className='mb-1'>
			<pptx-ui-notes-toolbar ref={ref} />
		</div>
	);
}
