/**
 * ribbon-insert-file-picker.ts: the browser-file plumbing behind Insert >
 * Image / Media.
 *
 * Extracted from {@link RibbonInsertSectionComponent} because none of it is
 * view code: it is a file dialog, a FileReader, and an <img> probe, all of
 * which the component only ever awaits. Keeping them here holds that component
 * to this repo's 300-LOC budget and makes the three steps testable without
 * instantiating a ribbon.
 *
 * Every helper resolves rather than rejects. An insert the user cancelled and
 * an insert the browser could not decode are the same non-event to the caller,
 * and a rejected promise would only be re-swallowed one frame later.
 */

/** Natural size assumed when the browser cannot decode the picked image. */
const FALLBACK_IMAGE_SIZE = { width: 400, height: 300 } as const;

/** Read a File as a base64 data URL, resolving to '' on failure. */
export function readAsDataUrl(file: File): Promise<string> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
		reader.onerror = () => resolve('');
		reader.readAsDataURL(file);
	});
}

/** Resolve an image data URL's natural dimensions (falls back to 400x300). */
export function imageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () =>
			resolve({
				width: img.naturalWidth || FALLBACK_IMAGE_SIZE.width,
				height: img.naturalHeight || FALLBACK_IMAGE_SIZE.height,
			});
		img.onerror = () => resolve({ ...FALLBACK_IMAGE_SIZE });
		img.src = dataUrl;
	});
}

/** Open the native file picker for a single file of the given accept type. */
export function pickFile(accept: string, onFile: (file: File) => void): void {
	if (typeof document === 'undefined') {
		return;
	}
	const fileInput = document.createElement('input');
	fileInput.type = 'file';
	fileInput.accept = accept;
	fileInput.style.display = 'none';
	fileInput.addEventListener('change', () => {
		const file = fileInput.files?.[0];
		if (file) {
			onFile(file);
		}
		fileInput.remove();
	});
	document.body.appendChild(fileInput);
	fileInput.click();
}
