import type { PptxViewerInstance, PptxViewerSource } from 'pptx-vanilla-viewer';
import { createPptxViewer, themeToCssVars } from 'pptx-vanilla-viewer';
import { PptxHandler } from 'pptx-viewer-core';

import { getLanguage, onLanguageChange, setLanguage, t, viewerMessages } from './demo-i18n';
import { createDropzone } from './dropzone';
import { createLanguagePicker } from './language-picker';
import { createThemePicker } from './theme-picker';
import { readStoredTheme, storeTheme, themes } from './themes';

import './styles.css';

/**
 * Demo app for `pptx-vanilla-viewer`, mirroring demos/demo-vue/src/App.vue
 * (minus collaboration, which the vanilla binding does not support yet): the
 * viewer fills the screen, floating theme + language pickers hover above it,
 * and a landing dropzone handles file open / sample deck loading.
 */

const appRoot = document.getElementById('app');
if (!appRoot) {
	throw new Error('missing #app root');
}
const app: HTMLElement = appRoot;

let themeKey = readStoredTheme();
let viewer: PptxViewerInstance | null = null;
let appliedVarKeys: string[] = [];

// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`,
// mirroring demo-vue's `App.vue`.
const smartArt3D = new URLSearchParams(window.location.search).get('smartArt3D') === '1';

const themePicker = createThemePicker(
	() => themeKey,
	(key) => {
		setTheme(key);
	},
);
const languagePicker = createLanguagePicker(
	() => themeKey,
	(code) => {
		setLanguage(code);
	},
);
document.body.append(themePicker.el, languagePicker.el);

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
	themePicker.refresh();
	languagePicker.refresh();
}

onLanguageChange((code) => {
	viewer?.setLocale(code);
	themePicker.refresh();
	languagePicker.refresh();
	if (!viewer) {
		showLanding();
	}
});

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

	const shell = document.createElement('div');
	shell.className = 'demo-shell';
	app.append(shell);

	document.title = `${name} - PPTX Viewer`;
	viewer = createPptxViewer(shell, {
		source,
		theme: themes[themeKey].theme,
		locale: getLanguage(),
		messages: viewerMessages,
		editable: true,
		smartArt3D,
		onError: (message, error) => {
			console.error('pptx-vanilla-viewer failed to load', message, error);
			showLanding();
			showError(message || t('demo.viewer.loadError'));
		},
	});
}

function showLanding(): void {
	viewer?.destroy();
	viewer = null;
	document.title = 'pptx-vanilla-viewer demo';
	app.replaceChildren();
	app.append(
		createDropzone({
			onFile: (file) => {
				openViewer(file, file.name);
			},
			onNewPresentation: () => {
				void (async () => {
					const { handler, data } = await PptxHandler.createBlank({
						title: 'Untitled Presentation',
						initialSlideCount: 1,
					});
					const bytes = await handler.save(data.slides);
					handler.dispose();
					openViewer(bytes, 'Untitled Presentation');
				})();
			},
		}),
	);
}

applyRootVars();
showLanding();
