import type {
	PptxUiRibbonHomeElement,
	RibbonControlId,
	RibbonHomeFamily,
	RibbonHomeRequestEvent,
	RibbonHomeViewState,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Thin adapter around a shared Home command strip. State flows in through the
 * element's property and the one `home-request` intent flows out; the document
 * edit behind each id stays with the caller.
 */
export function WebHomeControls({
	family,
	controls,
	onRequest,
}: {
	family: RibbonHomeFamily;
	controls: RibbonHomeViewState['controls'];
	onRequest: (id: RibbonControlId) => void;
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
		const listener = (event: Event) => onRequest((event as RibbonHomeRequestEvent).detail.id);
		host.addEventListener('home-request', listener);
		return () => host.removeEventListener('home-request', listener);
	}, [onRequest]);
	return React.createElement(`pptx-ui-ribbon-home-${family}`, { ref });
}
