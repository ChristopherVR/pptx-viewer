/**
 * open-file-picker — framework-agnostic helper that opens the native file
 * picker and resolves the chosen file. Every binding's File ▸ Open action wires
 * its built-in picker through here so the accepted extensions and the
 * pick → ArrayBuffer flow stay identical across React / Vue / Angular.
 */

/** Default `accept` filter for PowerPoint presentations the viewer can load. */
export const PPTX_OPEN_ACCEPT = '.pptx,.ppsx,.pptm,.potx';

export interface OpenFilePickerOptions {
	/** Comma-separated `accept` list. Defaults to {@link PPTX_OPEN_ACCEPT}. */
	accept?: string;
}

/**
 * Opens a transient `<input type="file">` and resolves with the selected
 * `File`, or `null` when the user cancels (or when there is no DOM, e.g. SSR).
 */
export function openFilePicker(options: OpenFilePickerOptions = {}): Promise<File | null> {
	return new Promise((resolve) => {
		if (typeof document === 'undefined') {
			resolve(null);
			return;
		}

		const input = document.createElement('input');
		input.type = 'file';
		input.accept = options.accept ?? PPTX_OPEN_ACCEPT;
		// Keep it out of the layout — it only needs to exist long enough to click.
		input.style.position = 'fixed';
		input.style.left = '-9999px';
		input.style.opacity = '0';

		let settled = false;
		const finish = (file: File | null): void => {
			if (settled) {
				return;
			}
			settled = true;
			input.remove();
			resolve(file);
		};

		input.addEventListener('change', () => finish(input.files?.[0] ?? null));
		// Modern browsers fire `cancel` when the dialog is dismissed; older ones
		// fall back to a window-focus check so the promise still settles.
		input.addEventListener('cancel', () => finish(null));
		const onFocus = (): void => {
			window.removeEventListener('focus', onFocus);
			// Defer: the `change` event lands just after focus returns.
			setTimeout(() => finish(null), 300);
		};
		window.addEventListener('focus', onFocus);

		document.body.appendChild(input);
		input.click();
	});
}

/**
 * Opens the picker and reads the chosen file into an `ArrayBuffer` ready to hand
 * to the loader. Resolves `null` when the user cancels.
 */
export async function openPptxFile(
	options: OpenFilePickerOptions = {},
): Promise<{ file: File; buffer: ArrayBuffer } | null> {
	const file = await openFilePicker(options);
	if (!file) {
		return null;
	}
	return { file, buffer: await file.arrayBuffer() };
}
