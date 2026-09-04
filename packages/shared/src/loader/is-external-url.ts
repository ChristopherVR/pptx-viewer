/**
 * Whether a resolved path is already a usable URL (external, or an inline
 * data:/blob: URI) rather than a package-relative archive path that still
 * needs resolving through a `PptxHandler`. Shared by every loader-pipeline
 * collector/resolver so a linked (`TargetMode="External"`) picture, poster
 * frame, 3D model, or media element is never re-resolved or corrupted.
 */
export function isExternalUrl(path: string): boolean {
	return (
		path.startsWith('http://') ||
		path.startsWith('https://') ||
		path.startsWith('data:') ||
		path.startsWith('blob:')
	);
}
