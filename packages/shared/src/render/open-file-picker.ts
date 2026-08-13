/**
 * open-file-picker: framework-agnostic helper that opens the native file
 * picker and resolves the chosen file. Every binding's File > Open action wires
 * its built-in picker through here so the accepted extensions and the
 * pick-to-ArrayBuffer flow stay identical across all five bindings.
 *
 * The accepted-extension list itself lives in `./presentation-file-kinds`,
 * alongside the matching drop-target predicate, so a picker and a drop zone
 * cannot disagree about what is loadable.
 */

import { PPTX_OPEN_ACCEPT } from './presentation-file-kinds';
import { rememberSessionDeck } from './session-restore';

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
		// Keep it out of the layout: it only needs to exist long enough to click.
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
 *
 * The picked deck is also remembered for this browser tab (see
 * `./session-restore`). Every binding's File > Open swaps the deck INSIDE the
 * viewer without telling the host, so without this a host that restores on load
 * would reopen the deck it handed in rather than the one the user picked.
 */
export async function openPptxFile(
	options: OpenFilePickerOptions = {},
): Promise<{ file: File; buffer: ArrayBuffer } | null> {
	const file = await openFilePicker(options);
	if (!file) {
		return null;
	}
	const buffer = await file.arrayBuffer();
	void rememberSessionDeck(file.name, new Uint8Array(buffer));
	return { file, buffer };
}
