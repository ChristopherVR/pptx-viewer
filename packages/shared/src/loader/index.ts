export type { GuideEntry, ImagePathElement, TableCellImageRef } from './load-content-helpers';
export {
	collectMediaElements,
	collectAnimationSoundPaths,
	collectImagePaths,
	collectTableCellImagePaths,
	applyTableCellImagePatches,
	buildInitialGuides,
} from './load-content-helpers';
export type { MediaArrayBufferSource, MediaSourceResolution } from './media-element-source';
export { resolveMediaElementSource } from './media-element-source';
export type { TableStyleImageRef } from './table-style-image-paths';
export {
	collectTableStyleImagePaths,
	applyTableStyleImagePatches,
} from './table-style-image-paths';

// small helper extractions (wave 2)
export type { ElementPatcher } from './element-patch-walker';
export { walkAndPatchElements, applyImagePathPatches } from './element-patch-walker';
export type { GetImageData } from './lazy-image-resolution';
export { resolveTableCellImageUrls, resolveTableStyleImageUrls } from './lazy-image-resolution';
