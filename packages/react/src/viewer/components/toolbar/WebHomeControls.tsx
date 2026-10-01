import type {
	PptxUiRibbonHomeElement,
	RibbonControlId,
	RibbonHomeFamily,
	RibbonHomeRequestEvent,
	RibbonHomeViewState,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Thin adapter around a shared Home command strip. State flows in through the
 * element's property and the one `home-request` intent flows out; the document
 * edit behind each id stays with the caller. `part` names the button of a
 * shared id (the split caret, an Align edge). `elementRef` exposes the element
 * so a host can anchor a native popover on {@link PptxUiRibbonHomeElement.anchor}.
 */
export function WebHomeControls({
	family,
	controls,
	onRequest,
	elementRef,
}: {
	family: RibbonHomeFamily;
	controls: RibbonHomeViewState['controls'];
	onRequest: (id: RibbonControlId, part?: string) => void;
	elementRef?: React.MutableRefObject<PptxUiRibbonHomeElement | null>;
}): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiRibbonHomeElement>(null);
	useEffect(() => {
		if (ref.current) {
			ref.current.state = { controls, translate: t };
		}
	}, [controls, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const listener = (event: Event) => {
			const { id, part } = (event as RibbonHomeRequestEvent).detail;
			onRequest(id, part);
		};
		host.addEventListener('home-request', listener);
		return () => host.removeEventListener('home-request', listener);
	}, [onRequest]);
	return React.createElement(`pptx-ui-ribbon-home-${family}`, {
		ref: (node: PptxUiRibbonHomeElement | null) => {
			ref.current = node;
			if (elementRef) {
				elementRef.current = node;
			}
		},
	});
}

/**
 * The shared wrapper of `id`, resolved after the element has rendered. Native
 * popovers portal into it so they stay descendants of the customization-id
 * wrapper, as before the migration.
 */
export function useHomeAnchor(
	elementRef: React.RefObject<PptxUiRibbonHomeElement | null>,
	id: string,
): HTMLElement | null {
	const [anchor, setAnchor] = useState<HTMLElement | null>(null);
	useEffect(() => {
		setAnchor(elementRef.current?.anchor(id) ?? null);
	}, [elementRef, id]);
	return anchor;
}

/**
 * Open state for a popover anchored on a shared control: closes on a
 * mouse-down outside the control wrapper (the popover lives inside it) or on Escape.
 */
export function useHomePopover(anchor: HTMLElement | null) {
	const [open, setOpen] = useState(false);
	useEffect(() => {
		if (!open) {
			return;
		}
		const onMouseDown = (event: MouseEvent) => {
			if (anchor && !anchor.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		};
		document.addEventListener('mousedown', onMouseDown);
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('mousedown', onMouseDown);
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [open, anchor]);
	return { open, setOpen, anchorRef: { current: anchor } };
}
