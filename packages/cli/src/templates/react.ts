// Mirrors the demo apps (demos/demo-react, demo-vue, demo-angular, ...): a
// picker to open an existing .pptx, or a "New Presentation" button that hands
// the viewer a freshly built blank deck via PptxHandler.createBlank, so the
// scaffolded app actually shows a working PowerPoint presentation right away
// instead of a bare, empty file input.
//
// The style import uses the `/styles.css` subpath, not the extension-less
// `/styles` alias: Vite's ambient `declare module '*.css'` (from its
// `vite/client` types) only matches specifiers that literally end in
// `.css`, so the extension-less form fails `vue-tsc -b`/`tsc -b` in a fresh
// scaffold with "Cannot find module ... for side-effect import".
export const REACT_APP_TSX = `import { useCallback, useState } from 'react';
import { PptxHandler } from 'pptx-viewer-core';
import { PowerPointViewer } from 'pptx-react-viewer';
import 'pptx-react-viewer/styles.css';
import './i18n';

export default function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	const loadFile = useCallback((file: File) => {
		const reader = new FileReader();
		reader.onload = () => setContent(new Uint8Array(reader.result as ArrayBuffer));
		reader.readAsArrayBuffer(file);
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
			<div style={{ height: '100vh' }}>
				<PowerPointViewer content={content} canEdit />
			</div>
		);
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
			<h1 style={{ margin: 0, fontSize: 24, fontWeight: 500, color: '#e5e7eb' }}>Open a Presentation</h1>
			<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, border: '1px solid #4b5563', background: '#1f2937', color: '#f3f4f6', cursor: 'pointer', fontSize: 14, transition: 'background 0.15s' }}>
				Choose .pptx file
				<input
					type="file"
					accept=".pptx"
					style={{ display: 'none' }}
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) loadFile(file);
					}}
				/>
			</label>
			<span style={{ color: '#6b7280', fontSize: 13 }}>or</span>
			<button
				onClick={() => void newPresentation()}
				style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
			>
				New Presentation
			</button>
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
