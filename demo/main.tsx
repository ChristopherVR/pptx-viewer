import './i18n'; // Initialise i18next before any component renders
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { PowerPointViewer } from '../packages/react/src/viewer';
import './app.css';

function App() {
	const [content, setContent] = useState<Uint8Array | null>(null);
	const [fileName, setFileName] = useState<string>('');

	const handleFile = useCallback((file: File) => {
		setFileName(file.name);
		const reader = new FileReader();
		reader.onload = () => {
			const bytes = new Uint8Array(reader.result as ArrayBuffer);
			setContent(bytes);
		};
		reader.readAsArrayBuffer(file);
	}, []);

	const handleDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file?.name.endsWith('.pptx')) handleFile(file);
	}, [handleFile]);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
	}, []);

	const handleClick = useCallback(() => {
		const input = document.getElementById('file-input') as HTMLInputElement;
		input?.click();
	}, []);

	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) handleFile(file);
	}, [handleFile]);

	if (content) {
		return (
			<div className="h-screen w-screen">
				<PowerPointViewer
					content={content}
					canEdit={true}
					onDirtyChange={(dirty) => {
						document.title = dirty ? `* ${fileName} — PPTX Viewer` : `${fileName} — PPTX Viewer`;
					}}
				/>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-center h-screen w-screen bg-gray-50">
			<div
				className="max-w-[900px] w-full border-2 border-dashed border-slate-400 rounded-xl p-12 text-center cursor-pointer transition-colors bg-white hover:border-blue-500 hover:bg-blue-50"
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onClick={handleClick}
			>
				<p className="text-slate-500 mb-3">Drop a .pptx file here or click to browse</p>
				<p className="text-sm text-slate-400">The file is processed entirely in the browser</p>
				<input
					type="file"
					id="file-input"
					accept=".pptx"
					style={{ display: 'none' }}
					onChange={handleInputChange}
				/>
			</div>
		</div>
	);
}

const rootEl = document.getElementById('app-root');
if (rootEl) {
	createRoot(rootEl).render(<App />);
}
