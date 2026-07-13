import type { PptxSlide, PptxSlideLayout, PptxSlideMaster } from 'pptx-viewer-core';

/** Turn a parsed master into the slide shape consumed by SlideStage. */
export function masterToSlide(master: PptxSlideMaster): PptxSlide {
	return {
		id: master.path,
		rId: '',
		slideNumber: 0,
		elements: master.elements ?? [],
		backgroundColor: master.backgroundColor,
		backgroundImage: master.backgroundImage,
	};
}

/** Turn a parsed layout into the slide shape consumed by SlideStage. */
export function layoutToSlide(layout: PptxSlideLayout): PptxSlide {
	return {
		id: layout.path,
		rId: '',
		slideNumber: 0,
		elements: layout.elements ?? [],
		backgroundColor: layout.backgroundColor,
		backgroundImage: layout.backgroundImage,
	};
}

export function selectedMasterSlide(
	masters: readonly PptxSlideMaster[],
	masterIndex: number,
	layoutIndex: number | null,
): PptxSlide | undefined {
	const master = masters[masterIndex];
	if (!master) {
		return undefined;
	}
	const layout = layoutIndex === null ? undefined : master.layouts?.[layoutIndex];
	return layout ? layoutToSlide(layout) : masterToSlide(master);
}
