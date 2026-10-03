/**
 * Keep autosave, version history and snapshot cleanup on the same document key.
 * A named document must use its name when the host has not supplied a path,
 * matching the lookup performed when a demo restores its tab after refresh.
 */
export function resolveAutosaveFileKey(
	filePath: string | undefined,
	fileName: string | undefined,
): string {
	return filePath ?? fileName ?? 'presentation.pptx';
}
