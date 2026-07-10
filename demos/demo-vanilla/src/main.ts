import type { PptxViewerInstance, PptxViewerSource } from 'pptx-vanilla-viewer';
import { createPptxViewer, themeToCssVars } from 'pptx-vanilla-viewer';

import { createDropzone } from './dropzone';
import { createThemePicker } from './theme-picker';
import { readStoredTheme, storeTheme, themes } from './themes';

import './styles.css';

/**
 * Demo app for `pptx-vanilla-viewer`, mirroring the Vue demo shell: the
 * viewer fills the screen, a floating theme picker hovers above it, and a
 * landing dropzone handles file open / sample deck loading.
 */

const appRoot = document.getElementById('app');
if (!appRoot) {
	throw new Error('missing #app root');
}
const app: HTMLElement = appRoot;

let themeKey = readStoredTheme();
let viewer: PptxViewerInstance | null = null;
let appliedVarKeys: string[] = [];

/** Apply theme vars to :root so the dropzone chrome tracks the theme. */
function applyRootVars(): void {
	const vars = themeToCssVars(themes[themeKey].theme);
	const root = document.documentElement;
	for (const key of appliedVarKeys) {
		root.style.removeProperty(key);
	}
	appliedVarKeys = Object.keys(vars);
	for (const key of appliedVarKeys) {
		root.style.setProperty(key, vars[key]);
	}
}

function setTheme(key: string): void {
	themeKey = key;
	storeTheme(key);
	applyRootVars();
	viewer?.setTheme(themes[key].theme);
}

function mountThemePicker(host: HTMLElement): void {
	host.append(createThemePicker(themeKey, setTheme));
}

function showError(message: string): void {
	const zone = app.querySelector('.demo-dropzone');
	if (!zone) {
		return;
	}
	zone.querySelector('.demo-error')?.remove();
	const error = document.createElement('p');
	error.className = 'demo-error';
	error.textContent = message;
	zone.append(error);
}

function openViewer(source: PptxViewerSource, name: string): void {
	viewer?.destroy();
	viewer = null;
	app.replaceChildren();
	mountThemePicker(app);

	const shell = document.createElement('div');
	shell.className = 'demo-shell';
	app.append(shell);

	document.title = `${name} - PPTX Viewer`;
	viewer = createPptxViewer(shell, {
		source,
		theme: themes[themeKey].theme,
		onError: (message, error) => {
			console.error('pptx-vanilla-viewer failed to load', message, error);
			showLanding();
			showError(message || 'Failed to load the presentation');
		},
	});
}

function showLanding(): void {
	viewer?.destroy();
	viewer = null;
	document.title = 'pptx-vanilla-viewer demo';
	app.replaceChildren();
	mountThemePicker(app);
	app.append(
		createDropzone({
			onFile: (file) => {
				openViewer(file, file.name);
			},
			onSample: () => {
				openViewer(`${import.meta.env.BASE_URL}sample-deck.pptx`, 'Sample Deck');
			},
		}),
	);
}

applyRootVars();
showLanding();
