import type { PptxHandler, PptxSlide } from 'pptx-viewer-core';
import type { MockInstance } from 'vitest';

export function presentationLoadFixtures(
	Handler: typeof PptxHandler,
	asset?: 'image' | 'media',
): Promise<{ first: Uint8Array; second: Uint8Array }>;

export function holdPresentationAsset(
	Handler: typeof PptxHandler,
	asset?: 'image' | 'media',
): {
	entered: Promise<void>;
	release(): void;
	readonly handler: PptxHandler | undefined;
	readonly disposal: MockInstance<() => void> | undefined;
};

export function editPresentation(slides: PptxSlide[]): PptxSlide[];
export function settlePresentationLoad(): Promise<void>;
