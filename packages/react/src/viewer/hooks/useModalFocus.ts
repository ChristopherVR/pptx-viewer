import { activateModalFocus } from 'pptx-viewer-shared';
import { useEffect } from 'react';
import type React from 'react';

/** Apply shared modal focus containment and focus-return behavior. */
export function useModalFocus(
	open: boolean,
	panelRef: React.RefObject<HTMLElement | null>,
	onClose: () => void,
	initialFocusRef?: React.RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		const panel = panelRef.current;
		if (!open || !panel) {
			return;
		}
		return activateModalFocus(panel, {
			initialFocus: initialFocusRef?.current,
			onEscape: onClose,
		});
	}, [initialFocusRef, onClose, open, panelRef]);
}
