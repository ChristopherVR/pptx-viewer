import type { PptxImageEffects } from 'pptx-viewer-core';

import {
	applyColorChange,
	buildCacheKey,
	DEFAULT_COLOR_CHANGE_TOLERANCE,
	getCachedResult,
	setCachedResult,
} from './image-color-change';

export interface ImageColorWashStyle {
	backgroundColor: string;
	opacity: number;
}

/** Resolve an image source after applying the DrawingML `clrChange` pixel effect. */
export async function resolveColorChangedImageSource(
	src: string,
	clrChange: NonNullable<PptxImageEffects['clrChange']> | undefined,
): Promise<string> {
	if (!clrChange) {
		return src;
	}
	const tolerance = DEFAULT_COLOR_CHANGE_TOLERANCE;
	const key = buildCacheKey(
		src,
		clrChange.clrFrom,
		clrChange.clrTo,
		tolerance,
		Boolean(clrChange.clrToTransparent),
	);
	const cached = getCachedResult(key);
	if (cached) {
		return cached;
	}
	try {
		const result = await applyColorChange(
			src,
			clrChange.clrFrom,
			clrChange.clrTo,
			tolerance,
			Boolean(clrChange.clrToTransparent),
		);
		setCachedResult(key, result.dataUrl);
		return result.dataUrl;
	} catch {
		return src;
	}
}

/** Convert the editor's percentage opacity into a render-ready color-wash style. */
export function getImageColorWashStyle(
	wash: PptxImageEffects['colorWash'] | undefined,
): ImageColorWashStyle | undefined {
	if (!wash?.color) {
		return undefined;
	}
	return {
		backgroundColor: wash.color,
		opacity: Math.max(0, Math.min(100, wash.opacity)) / 100,
	};
}
