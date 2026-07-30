import { activateModalFocus } from 'pptx-viewer-shared';
import { useEffect, useRef } from 'react';
import type React from 'react';

/** Apply shared modal focus containment and focus-return behavior. */
export function useModalFocus(
	open: boolean,
	panelRef: React.RefObject<HTMLElement | null>,
	onClose: () => void,
	initialFocusRef?: React.RefObject<HTMLElement | null>,
): void {
	// Callers routinely pass an inline `onClose`, so its identity changes on
	// every parent render. The trap must NOT re-arm for that: tearing it down
	// restores focus to the opener and re-arming snaps it to the first control,
	// which yanks focus away from whatever input the user just clicked. Read
	// the latest callback through a ref instead.
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	useEffect(() => {
		const panel = panelRef.current;
		if (!open || !panel) {
			return;
		}
		return activateModalFocus(panel, {
			initialFocus: initialFocusRef?.current,
			onEscape: () => onCloseRef.current(),
		});
	}, [initialFocusRef, open, panelRef]);
}
