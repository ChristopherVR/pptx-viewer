/**
 * Legacy binary PowerPoint 97-2003 (`.ppt`) WRITER.
 *
 * @module ppt/writer
 */

export { convertDeckToWriteModel } from './element-to-write-model';
export type { WarningReporter } from './element-to-write-model';
export { buildMetroBlobs, deckNeedsMetroBlobs } from './metro-blob-collect';
export { convertMasterTextStyles } from './master-style-convert';
export { buildMasterRoundTripFromPptx } from './master-roundtrip-writer';
export { resolvePictureSources } from './picture-resolve';
export type { PartReader, ResolvedPictures } from './picture-resolve';
export { buildPptFile } from './write-ppt';
export type { BuildPptOptions } from './write-ppt';
export type {
	WDeck,
	WSlide,
	WAnyShape,
	WShape,
	WPicture,
	WGroup,
	WMedia,
	WPictureData,
} from './write-model';
