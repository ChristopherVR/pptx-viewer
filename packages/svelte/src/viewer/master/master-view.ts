import type { PptxSlide, PptxSlideLayout, PptxSlideMaster } from 'pptx-viewer-core';
import { masterViewPseudoSlide } from 'pptx-viewer-shared';

/**
 * Turn a parsed master (optionally overlaid with one of its layouts) into the
 * slide shape `SlideStage` consumes.
 *
 * The composition rule itself lives in `pptx-viewer-shared` so all five
 * bindings agree on it, in particular that a layout is painted on top of its
 * own master rather than on an empty canvas.
 */
export function masterToSlide(master: PptxSlideMaster): PptxSlide {
	return partToSlide(master, null)!;
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

function partToSlide(master: PptxSlideMaster, layoutIndex: number | null): PptxSlide | undefined {
	return masterViewPseudoSlide(
		{ slideMasters: [master] },
		{ tab: 'slides', masterIndex: 0, layoutIndex },
	);
}

export function selectedMasterSlide(
	masters: readonly PptxSlideMaster[],
	masterIndex: number,
	layoutIndex: number | null,
): PptxSlide | undefined {
	return masterViewPseudoSlide(
		{ slideMasters: masters },
		{
			tab: 'slides',
			masterIndex,
			layoutIndex,
		},
	);
}
