// The openable-file allow list comes from the binding's public surface, not a
// local regex: a hand-rolled `.pptx|.ppt|.json` refused a `.pptm` on drop that
// the viewer's own File > Open accepted.
import { PPTX_OPEN_ACCEPT, isSupportedPresentationFile } from 'pptx-vanilla-viewer';

import { t } from './demo-i18n';

/** Callbacks the dropzone reports back to the demo shell. */
export interface DropzoneHandlers {
	onFile: (file: File) => void;
	onNewPresentation: () => void;
}

/**
 * Landing dropzone mirroring the Vue demo: drag-and-drop or click to browse
 * for a `.pptx` file, plus a one-click New Presentation creator. All strings
 * come from the demo dictionary, so the shell re-renders it on language change.
 */
export function createDropzone(handlers: DropzoneHandlers): HTMLElement {
	const stage = document.createElement('main');
	stage.className = 'demo-stage';
	const heading = document.createElement('h1');
	heading.className = 'sr-only';
	heading.textContent = 'PPTX Viewer';

	const zone = document.createElement('div');
	zone.className = 'demo-dropzone';
	zone.setAttribute('role', 'group');
	zone.dataset.testid = 'dropzone';
	zone.setAttribute('aria-label', t('demo.dropzone.uploadAriaLabel'));

	const hint = document.createElement('label');
	hint.className = 'demo-hint';
	hint.htmlFor = 'file-input';
	hint.textContent = t('demo.dropzone.hint');

	const sub = document.createElement('p');
	sub.className = 'demo-sub';
	sub.textContent = t('demo.dropzone.processed');

	const actions = document.createElement('div');
	actions.className = 'demo-actions';

	const browseButton = document.createElement('button');
	browseButton.type = 'button';
	browseButton.className = 'demo-browse';
	browseButton.dataset.testid = 'browse-files';
	browseButton.textContent = t('demo.dropzone.browse');

	const sampleButton = document.createElement('button');
	sampleButton.type = 'button';
	sampleButton.textContent = t('demo.dropzone.newPresentation');

	const input = document.createElement('input');
	input.id = 'file-input';
	input.type = 'file';
	input.accept = PPTX_OPEN_ACCEPT;
	input.setAttribute('aria-label', t('demo.dropzone.uploadAriaLabel'));
	input.className = 'sr-only';

	actions.append(browseButton, sampleButton);
	zone.append(hint, sub, actions, input);
	stage.append(heading, zone);

	zone.addEventListener('dragover', (e) => {
		e.preventDefault();
	});
	/**
	 * The dashed zone paints `cursor: pointer` over its whole area and the copy
	 * says "click to browse", so the whole area has to open the picker, not just
	 * the one text line that happens to be a <label>. Clicks that originate on a
	 * button, on the label, or on the input itself are already handled by those
	 * elements; re-opening from here would double-fire or loop.
	 */
	zone.addEventListener('click', (e) => {
		const target = e.target as HTMLElement | null;
		if (target?.closest('button, label[for="file-input"], #file-input')) {
			return;
		}
		input.click();
	});
	browseButton.addEventListener('click', (e) => {
		e.stopPropagation();
		input.click();
	});
	zone.addEventListener('drop', (e) => {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file && isSupportedPresentationFile(file.name)) {
			handlers.onFile(file);
		}
	});
	input.addEventListener('change', () => {
		const file = input.files?.[0];
		if (file) {
			handlers.onFile(file);
		}
	});
	sampleButton.addEventListener('click', (e) => {
		e.stopPropagation();
		sampleButton.textContent = t('demo.dropzone.creating');
		sampleButton.disabled = true;
		handlers.onNewPresentation();
	});

	return stage;
}
