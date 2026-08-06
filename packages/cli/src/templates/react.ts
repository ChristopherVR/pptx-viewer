// Mirrors the demo apps: a landing screen with drag-and-drop + file-picker and
// a "New Presentation" button. Layout classes (.stage, .dropzone, .pick-label,
// etc.) come from the shared MINIMAL_APP_CSS written to src/index.css by the
// scaffold recipe.
//
// The style import uses the `/styles.css` subpath, not the extension-less
// `/styles` alias: Vite's ambient `declare module '*.css'` (from its
// `vite/client` types) only matches specifiers that literally end in
// `.css`, so the extension-less form fails `vue-tsc -b`/`tsc -b` in a fresh
// scaffold with "Cannot find module ... for side-effect import".
export const REACT_APP_TSX = `import { useCallback, useState } from 'react';
import { PptxHandler } from 'pptx-viewer-core';
import type { CollaborationConfig } from 'pptx-react-viewer';
import { PowerPointViewer } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles.css';
import './i18n';

/**
 * The presentation formats this viewer can open: OOXML and the legacy binary
 * PowerPoint format, which pptx-viewer-core converts on load. Kept as an
 * explicit check because a drop event carries no accept filtering.
 */
function isPresentation(file: File | undefined): file is File {
	const name = file?.name.toLowerCase() ?? '';
	return name.endsWith('.pptx') || name.endsWith('.ppt');
}

export default function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);
	const [over, setOver] = useState(false);
	const [collab, setCollab] = useState<CollaborationConfig | undefined>();

	const loadFile = useCallback(async (file: File) => {
		setContent(new Uint8Array(await file.arrayBuffer()));
	}, []);

	const newPresentation = useCallback(async () => {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Untitled Presentation',
			initialSlideCount: 1,
		});
		setContent(await handler.save(data.slides));
	}, []);

	if (content) {
		return (
			<div style={{ height: '100dvh' }}>
				<PowerPointViewer
					content={content}
					canEdit
					collaboration={collab}
					onStartCollaboration={setCollab}
					onStopCollaboration={() => setCollab(undefined)}
				/>
			</div>
		);
	}

	return (
		<div className="stage">
			<div
				className={\`dropzone\${over ? ' over' : ''}\`}
				onDragOver={(e) => { e.preventDefault(); setOver(true); }}
				onDragLeave={() => setOver(false)}
				onDrop={(e) => {
					e.preventDefault();
					setOver(false);
					const file = e.dataTransfer.files[0];
					if (isPresentation(file)) void loadFile(file);
				}}
				onClick={() => document.getElementById('file-input')?.click()}
			>
				<h1>Open a Presentation</h1>
				<p>Drag &amp; drop a .pptx or .ppt file here, or</p>
				<label className="pick-label" onClick={(e) => e.stopPropagation()}>
					Choose a file
					<input
						id="file-input"
						type="file"
						accept=".pptx,.ppt"
						style={{ display: 'none' }}
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) void loadFile(file);
						}}
					/>
				</label>
				<span className="or-sep">or</span>
				<button
					className="new-btn"
					onClick={(e) => { e.stopPropagation(); void newPresentation(); }}
				>
					New Presentation
				</button>
			</div>
		</div>
	);
}
`;

export const REACT_I18N_TS = `import { createInstance } from 'i18next';
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
import { initReactI18next } from 'react-i18next';

const i18n = createInstance();

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: translationsEn },
	},
	lng: 'en',
	fallbackLng: 'en',
	interpolation: { escapeValue: false },
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	missingKeyHandler: false,
});

export default i18n;
`;
