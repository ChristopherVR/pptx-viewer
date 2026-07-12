// Mirrors the demo apps: a dropzone landing screen that accepts drag-and-drop
// or click-to-browse for a .pptx file, plus a "New Presentation" button.
// The vanilla binding injects its own stylesheet at construction time and
// bundles an English dictionary, so only the starter's `style.css` (the
// shared MINIMAL_APP_CSS with dark theme + dropzone layout) is imported here.
export const VANILLA_MAIN_TS = `import { createPptxViewer } from 'pptx-vanilla-viewer';
import { PptxHandler } from 'pptx-viewer-core';

import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

function show(source: ArrayBuffer | Uint8Array): void {
	app.innerHTML = '';
	app.style.height = '100dvh';
	createPptxViewer(app, { source, editable: true });
}

function showLanding(): void {
	app.style.height = '';
	app.innerHTML = '';

	const stage = document.createElement('div');
	stage.className = 'stage';

	const zone = document.createElement('div');
	zone.className = 'dropzone';

	const h1 = document.createElement('h1');
	h1.textContent = 'Open a Presentation';

	const hint = document.createElement('p');
	hint.textContent = 'Drag & drop a .pptx file here, or';

	const label = document.createElement('label');
	label.className = 'pick-label';
	label.textContent = 'Choose .pptx file';

	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.pptx';
	input.style.display = 'none';
	label.append(input);

	const orSep = document.createElement('span');
	orSep.className = 'or-sep';
	orSep.textContent = 'or';

	const newBtn = document.createElement('button');
	newBtn.className = 'new-btn';
	newBtn.textContent = 'New Presentation';

	zone.append(h1, hint, label, orSep, newBtn);
	stage.append(zone);
	app.append(stage);

	zone.addEventListener('dragover', (e) => {
		e.preventDefault();
		zone.classList.add('over');
	});
	zone.addEventListener('dragleave', () => zone.classList.remove('over'));
	zone.addEventListener('drop', (e) => {
		e.preventDefault();
		zone.classList.remove('over');
		const file = e.dataTransfer?.files?.[0];
		if (file?.name.endsWith('.pptx')) void file.arrayBuffer().then(show);
	});

	// Click the zone to open the file picker (but not if the button was clicked).
	zone.addEventListener('click', () => input.click());
	label.addEventListener('click', (e) => e.stopPropagation());
	input.addEventListener('click', (e) => e.stopPropagation());
	input.addEventListener('change', () => {
		const file = input.files?.[0];
		if (file) void file.arrayBuffer().then(show);
	});

	newBtn.addEventListener('click', async (e) => {
		e.stopPropagation();
		newBtn.textContent = 'Creating...';
		newBtn.disabled = true;
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		show(await handler.save(data.slides));
	});
}

showLanding();
`;
