import type {
	ContextMenuRequestEvent,
	ContextMenuViewState,
	PptxUiContextMenuElement,
} from 'pptx-viewer-shared';
import type React from 'react';
import { useEffect, useRef } from 'react';

export interface ContextMenuSurfaceProps extends ContextMenuViewState {
	/** A row was activated. The host runs the command and closes the menu. */
	onRequest: (id: string) => void;
	/** The user dismissed the menu (Escape, an outside press or Tab). */
	onClose: () => void;
}

/**
 * Thin adapter around the shared `pptx-ui-context-menu`: it hands the controlled
 * state to the element and routes its typed events to the host's callbacks. The
 * host keeps each menu's entries, gating and command handlers.
 */
export function ContextMenuSurface({
	onRequest,
	onClose,
	...state
}: ContextMenuSurfaceProps): React.ReactElement {
	const ref = useRef<PptxUiContextMenuElement>(null);
	const latest = useRef({ onRequest, onClose });
	latest.current = { onRequest, onClose };
	// The element ignores a write equal to its current state, so writing after every
	// render is cheap and needs no deep comparison here.
	useEffect(() => {
		if (ref.current) {
			ref.current.state = state;
		}
	});
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) =>
			latest.current.onRequest((event as ContextMenuRequestEvent).detail.id);
		const close = () => latest.current.onClose();
		host.addEventListener('menu-request', request);
		host.addEventListener('menu-close', close);
		return () => {
			host.removeEventListener('menu-request', request);
			host.removeEventListener('menu-close', close);
		};
	}, []);
	return <pptx-ui-context-menu ref={ref} />;
}
