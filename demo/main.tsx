import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { PowerPointViewer } from '../src/viewer';

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
		const nameEl = document.getElementById('file-name');
		if (nameEl) nameEl.textContent = fileName;
		const dropZone = document.getElementById('drop-zone');
		if (dropZone) dropZone.classList.add('hidden');
		const container = document.getElementById('viewer-container');
		if (container) container.classList.remove('hidden');

		return (
			<PowerPointViewer
				content={content}
				canEdit={true}
				onDirtyChange={(dirty) => {
					document.title = dirty ? `* ${fileName} — PPTX Viewer` : `${fileName} — PPTX Viewer`;
				}}
			/>
		);
	}

	return (
		<div
			className="drop-zone"
			onDrop={handleDrop}
			onDragOver={handleDragOver}
			onClick={handleClick}
		>
			<p>Drop a .pptx file here or click to browse</p>
			<p className="hint">The file is processed entirely in the browser</p>
			<input
				type="file"
				id="file-input"
				accept=".pptx"
				style={{ display: 'none' }}
				onChange={handleInputChange}
			/>
		</div>
	);
}

const rootEl = document.getElementById('viewer-container') ?? document.getElementById('drop-zone')?.parentElement;
if (rootEl) {
	const appRoot = document.createElement('div');
	appRoot.id = 'app-root';
	rootEl.parentElement?.appendChild(appRoot);
	createRoot(appRoot).render(<App />);
}
