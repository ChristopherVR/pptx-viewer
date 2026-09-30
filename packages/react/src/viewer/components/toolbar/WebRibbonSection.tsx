import type {
	PptxUiRibbonSectionElement,
	RibbonCommandRequestEvent,
	RibbonControlId,
	RibbonGroupView,
} from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

/** The shared keyed view owns layout; React supplies state and native intents. */
export function WebRibbonSection({
	groups,
	onCommand,
}: {
	groups: readonly RibbonGroupView[];
	onCommand: (id: RibbonControlId) => void;
}): React.ReactElement {
	const ref = useRef<PptxUiRibbonSectionElement>(null);
	useEffect(() => {
		if (ref.current) {
			ref.current.groups = groups;
		}
	}, [groups]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => onCommand((event as RibbonCommandRequestEvent).detail.id);
		host.addEventListener('command-request', request);
		return () => host.removeEventListener('command-request', request);
	}, [onCommand]);
	return <pptx-ui-ribbon-section ref={ref} />;
}
