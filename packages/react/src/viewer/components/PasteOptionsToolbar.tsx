/**
 * PasteOptionsToolbar: the small icon-strip PowerPoint anchors to the
 * bottom-right corner of a just-pasted element, offering the same four
 * formats as the Paste Special dialog as a one-click follow-up. Dismissed by
 * any subsequent pointerdown or keydown, same as the element context menu.
 */
import type { PasteSpecialFormat } from 'pptx-viewer-shared';
import { PASTE_SPECIAL_OPTIONS } from 'pptx-viewer-shared';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface PasteOptionsToolbarProps {
	/** The just-pasted element's id, used to find its mounted DOM node. */
	elementId: string | null;
	onChoose: (format: PasteSpecialFormat) => void;
	onDismiss: () => void;
}

/** The pasted element's own mounted node, matching the context menu's lookup. */
function findElementNode(elementId: string): HTMLElement | null {
	return document.querySelector<HTMLElement>(
		`[data-element-id="${elementId}"][data-pptx-element="true"]`,
	);
}

export function PasteOptionsToolbar({
	elementId,
	onChoose,
	onDismiss,
}: PasteOptionsToolbarProps): React.ReactElement | null {
	const { t } = useTranslation();
	const [rect, setRect] = useState<{ left: number; top: number } | null>(null);

	useEffect(() => {
		if (!elementId) {
			setRect(null);
			return;
		}
		const node = findElementNode(elementId);
		if (!node) {
			setRect(null);
			return;
		}
		const box = node.getBoundingClientRect();
		setRect({ left: box.right, top: box.bottom });
	}, [elementId]);

	useEffect(() => {
		if (!elementId) {
			return;
		}
		const dismiss = () => onDismiss();
		// Captured, like the context menu's own outside-dismiss listeners, so a
		// click that lands on the toolbar's own buttons is not swallowed here
		// (their own onClick already ran by the time this fires, in bubble order,
		// but capture on `document` still runs before the button's bubble handler
		// on some browsers, so the toolbar wires its buttons via onMouseDown-safe
		// clicks and dismisses on the NEXT interaction instead of intercepting this one).
		const timer = window.setTimeout(() => {
			window.addEventListener('pointerdown', dismiss, true);
			window.addEventListener('keydown', dismiss, true);
		}, 0);
		return () => {
			window.clearTimeout(timer);
			window.removeEventListener('pointerdown', dismiss, true);
			window.removeEventListener('keydown', dismiss, true);
		};
	}, [elementId, onDismiss]);

	if (!elementId || !rect) {
		return null;
	}

	return (
		<div
			role='toolbar'
			tabIndex={-1}
			aria-label={t('pptx.pasteSpecial.optionsLabel')}
			data-pptx-paste-options
			style={{ position: 'fixed', left: rect.left + 4, top: rect.top + 4, zIndex: 1100 }}
			className='flex items-center gap-0.5 rounded border border-border bg-popover p-1 shadow-lg'
			onMouseDown={(e) => e.stopPropagation()}
		>
			{PASTE_SPECIAL_OPTIONS.map((option) => (
				<button
					key={option.id}
					type='button'
					title={t(option.labelKey)}
					aria-label={t(option.labelKey)}
					className='px-2 py-1 text-[11px] rounded hover:bg-accent text-foreground whitespace-nowrap'
					onClick={() => onChoose(option.id)}
				>
					{t(option.labelKey)}
				</button>
			))}
		</div>
	);
}
