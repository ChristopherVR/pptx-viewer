/** Callbacks the dropzone reports back to the demo shell. */
export interface DropzoneHandlers {
	onFile: (file: File) => void;
	onSample: () => void;
}

/**
 * Landing dropzone mirroring the Vue demo: drag-and-drop or click to browse
 * for a `.pptx` file, plus a one-click sample deck loader.
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
	hint.textContent = 'Drop a .pptx file here, or click to browse';

	const sub = document.createElement('p');
	sub.className = 'demo-sub';
	sub.textContent = 'Files are processed entirely in your browser';

	const sampleButton = document.createElement('button');
	sampleButton.type = 'button';
	sampleButton.textContent = 'Load sample deck';

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.pptx';
	input.setAttribute('aria-label', 'Upload a PowerPoint file');
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
	input.addEventListener('change', () => {
		const file = input.files?.[0];
		if (file) {
			handlers.onFile(file);
		}
	});
	sampleButton.addEventListener('click', (e) => {
		e.stopPropagation();
		handlers.onSample();
	});

	return stage;
}
