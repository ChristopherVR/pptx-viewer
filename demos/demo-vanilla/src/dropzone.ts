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
	const stage = document.createElement('div');
	stage.className = 'demo-stage';

	const zone = document.createElement('div');
	zone.className = 'demo-dropzone';
	zone.setAttribute('role', 'button');
	zone.tabIndex = 0;

	const hint = document.createElement('p');
	hint.className = 'demo-hint';
	hint.textContent = t('demo.dropzone.hint');

	const sub = document.createElement('p');
	sub.className = 'demo-sub';
	sub.textContent = t('demo.dropzone.processed');

	const sampleButton = document.createElement('button');
	sampleButton.type = 'button';
	sampleButton.textContent = t('demo.dropzone.newPresentation');

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.pptx';
	input.setAttribute('aria-label', t('demo.dropzone.uploadAriaLabel'));
	input.style.display = 'none';

	zone.append(hint, sub, sampleButton, input);
	stage.append(zone);

	const browse = (): void => {
		input.click();
	};

	zone.addEventListener('click', browse);
	zone.addEventListener('keydown', (e) => {
		if (e.key === 'Enter') {
			browse();
		}
	});
	zone.addEventListener('dragover', (e) => {
		e.preventDefault();
	});
	zone.addEventListener('drop', (e) => {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file?.name.endsWith('.pptx')) {
			handlers.onFile(file);
		}
	});
	// The programmatic input.click() bubbles back up to the zone's click
	// handler; without this stop the browse loop re-opens the file chooser.
	input.addEventListener('click', (e) => {
		e.stopPropagation();
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
