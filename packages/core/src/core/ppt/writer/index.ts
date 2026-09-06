/**
 * Legacy binary PowerPoint 97-2003 (`.ppt`) WRITER.
 *
 * @module ppt/writer
 */

export { convertDeckToWriteModel } from './element-to-write-model';
export type { WarningReporter } from './element-to-write-model';
export { buildPptFile } from './write-ppt';
export type { BuildPptOptions } from './write-ppt';
export type {
	WDeck,
	WSlide,
	WAnyShape,
	WShape,
	WPicture,
	WGroup,
	WPictureData,
} from './write-model';
