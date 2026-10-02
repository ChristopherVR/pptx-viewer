import type {
	HomeLayoutArtwork,
	PptxUiRibbonHomeElement,
	RibbonControlId,
	RibbonHomeFamily,
	RibbonHomeIntent,
	RibbonHomeRequestEvent,
	RibbonHomeViewState,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Thin adapter around a shared Home strip. State flows in through the
 * element's property and the one `home-request` intent flows out; the document
 * edit behind each id stays with the caller. `part` names the button of a
 * shared id (the split caret, an Align edge); the full intent (value, theme
 * ref) is the third argument. `onPopup` reports the element's own popovers
 * opening and closing, and `layoutArtwork` lets the host draw layout thumbnails.
 */
export function WebHomeControls({
	family,
	controls,
	onRequest,
	onPopup,
	layoutArtwork,
}: {
	family: RibbonHomeFamily;
	controls: RibbonHomeViewState['controls'];
	onRequest: (id: RibbonControlId, part?: string, intent?: RibbonHomeIntent) => void;
	onPopup?: (id: string, open: boolean) => void;
	layoutArtwork?: HomeLayoutArtwork;
}): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiRibbonHomeElement>(null);
	useEffect(() => {
		if (ref.current) {
			ref.current.state = { controls, translate: t };
		}
	}, [controls, t]);
	useEffect(() => {
		if (ref.current) {
			ref.current.layoutArtwork = layoutArtwork;
		}
	}, [layoutArtwork]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const listener = (event: Event) => {
			const intent = (event as RibbonHomeRequestEvent).detail;
			onRequest(intent.id, intent.part, intent);
		};
		host.addEventListener('home-request', listener);
		return () => host.removeEventListener('home-request', listener);
	}, [onRequest]);
	useEffect(() => {
		const host = ref.current;
		if (!host || !onPopup) {
			return;
		}
		const listener = (event: Event) => {
			const { id, open } = (event as CustomEvent<{ id: string; open: boolean }>).detail;
			onPopup(id, open);
		};
		host.addEventListener('home-popup', listener);
		return () => host.removeEventListener('home-popup', listener);
	}, [onPopup]);
	return React.createElement(`pptx-ui-ribbon-home-${family}`, { ref });
}
