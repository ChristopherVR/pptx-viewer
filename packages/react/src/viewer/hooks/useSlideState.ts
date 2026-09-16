import type { PptxSlide } from 'pptx-viewer-core';
import { useCallback, useRef, useState } from 'react';
import type { SetStateAction } from 'react';

/**
 * Keep the logical deck current before React renders it. An explicit batch
 * must include earlier queued edits even when React 18 leaves their lane
 * pending during flushSync. Rendering and ordinary history tracking still
 * follow React's normal batching. The ref is also used by live text publishing.
 */
export function useSlideState() {
	const [renderedSlides, setRenderedSlides] = useState<PptxSlide[]>([]);
	const slidesRef = useRef(renderedSlides);
	const setSlides = useCallback((update: SetStateAction<PptxSlide[]>) => {
		const next = typeof update === 'function' ? update(slidesRef.current) : update;
		slidesRef.current = next;
		setRenderedSlides(next);
	}, []);
	return { slides: renderedSlides, setSlides, slidesRef };
}
