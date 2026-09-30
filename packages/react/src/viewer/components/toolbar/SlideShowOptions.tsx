import type { PptxPresentationProperties } from 'pptx-viewer-core';
import { SLIDE_SHOW_OPTIONS } from 'pptx-viewer-shared';
import type {
	PptxUiSlideShowOptionsElement,
	SlideShowOptionsChangeEvent,
} from 'pptx-viewer-shared';
import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

/** React 18 and 19 adapter for structured properties and the native domain event. */
export function SlideShowOptions({
	presentationProperties,
	onChange,
	children,
}: {
	presentationProperties?: PptxPresentationProperties;
	onChange?: (patch: Partial<PptxPresentationProperties>) => void;
	children?: React.ReactNode;
}): React.ReactElement {
	const ref = useRef<PptxUiSlideShowOptionsElement>(null);
	const { t } = useTranslation();
	useLayoutEffect(() => {
		if (!ref.current) {
			return;
		}
		ref.current.presentationProperties = presentationProperties;
		ref.current.labels = Object.fromEntries(
			SLIDE_SHOW_OPTIONS.map((option) => [option.id, t(option.labelKey)]),
		);
	}, [presentationProperties, t]);
	useEffect(() => {
		const host = ref.current;
		const handler = (event: Event) => onChange?.((event as SlideShowOptionsChangeEvent).detail);
		host?.addEventListener('show-options-change', handler);
		return () => host?.removeEventListener('show-options-change', handler);
	}, [onChange]);
	return <pptx-ui-slide-show-options ref={ref}>{children}</pptx-ui-slide-show-options>;
}
