// See react.ts for why the picker/new-presentation pattern is what it is.
// The vanilla binding injects its own stylesheet at construction time and
// bundles an English dictionary, so only the starter's `style.css` (body
// margin reset) is imported here.
export const VANILLA_MAIN_TS = `import { PptxHandler } from 'pptx-viewer-core';
import { createPptxViewer } from 'pptx-vanilla-viewer';

import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

const picker = document.createElement('div');
picker.setAttribute(
	'style',
	'display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 24px; height: 100vh; font-family: system-ui, sans-serif',
);
picker.innerHTML = \`
	<h1 style="margin: 0; font-size: 24px; font-weight: 500; color: #e5e7eb">Open a Presentation</h1>
	<label style="display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 8px; border: 1px solid #4b5563; background: #1f2937; color: #f3f4f6; cursor: pointer; font-size: 14px">
		Choose .pptx file
		<input id="file-input" type="file" accept=".pptx" style="display: none" />
	</label>
	<span style="color: #6b7280; font-size: 13px">or</span>
	<button id="new-presentation" style="padding: 10px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500">New Presentation</button>
\`;
app.append(picker);

function show(content: ArrayBuffer | Uint8Array) {
	picker.remove();
	app.style.height = '100vh';
	createPptxViewer(app, { source: content, editable: true });
}

picker.querySelector<HTMLInputElement>('#file-input')!.addEventListener('change', (e) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		void file.arrayBuffer().then(show);
	}
});

picker.querySelector<HTMLButtonElement>('#new-presentation')!.addEventListener('click', () => {
	void (async () => {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		show(await handler.save(data.slides));
	})();
});
`;
