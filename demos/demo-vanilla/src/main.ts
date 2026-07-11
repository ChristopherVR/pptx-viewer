import type {
	CollaborationConfig,
	PptxViewerInstance,
	PptxViewerSource,
} from 'pptx-vanilla-viewer';
import { createPptxViewer, themeToCssVars } from 'pptx-vanilla-viewer';
import { PptxHandler } from 'pptx-viewer-core';

import {
	buildRoomConfig,
	buildShareUrl,
	readRoomFromUrl,
	resolveAutoName,
	resolveAutoRoomId,
} from './collab';
import { getLanguage, onLanguageChange, setLanguage, t, viewerMessages } from './demo-i18n';
import { createDropzone } from './dropzone';
import type { ExportBar } from './export-bar';
import { createExportBar } from './export-bar';
import { createLanguagePicker } from './language-picker';
import { observeNotesHeight } from './notes-offset';
import { createThemePicker } from './theme-picker';
import { readStoredTheme, storeTheme, themes } from './themes';

import './styles.css';

/**
 * Demo app for `pptx-vanilla-viewer`, mirroring demos/demo-vue/src/App.vue: the
 * viewer fills the screen, floating theme + language pickers hover above it, and
 * a landing dropzone handles file open / sample deck loading. A `?room=<id>` URL
 * param auto-joins a serverless (WebRTC) collaboration session, and a floating
 * Collaborate button starts one and copies the share link.
 */

const appRoot = document.getElementById('app');
if (!appRoot) {
	throw new Error('missing #app root');
}
const app: HTMLElement = appRoot;

let themeKey = readStoredTheme();
let viewer: PptxViewerInstance | null = null;
let exportBar: ExportBar | null = null;
let appliedVarKeys: string[] = [];
let stopNotesObserver: (() => void) | null = null;

// ── Collaboration ──────────────────────────────────────────────────────────
const userName = resolveAutoName();
let activeRoomId: string | null = null;

const shareBtn = document.createElement('button');
shareBtn.type = 'button';
shareBtn.className = 'demo-share-btn';
shareBtn.textContent = 'Collaborate';
shareBtn.hidden = true;
shareBtn.setAttribute(
	'style',
	'position:fixed;bottom:16px;left:16px;z-index:50;padding:8px 14px;border-radius:8px;' +
		'border:1px solid var(--pptx-border,#3336);background:var(--pptx-card,#1e1e1e);' +
		'color:var(--pptx-foreground,#eee);font:500 13px system-ui,sans-serif;cursor:pointer;',
);
shareBtn.addEventListener('click', () => void startSharing());
document.body.append(shareBtn);

/** Start a session (or copy the link if one is already running). */
async function startSharing(): Promise<void> {
	if (!viewer) {
		return;
	}
	if (!activeRoomId) {
		activeRoomId = resolveAutoRoomId();
		await viewer.startCollaboration(buildRoomConfig(activeRoomId, userName));
		window.history.replaceState({}, '', buildShareUrl(activeRoomId));
	}
	try {
		await navigator.clipboard.writeText(buildShareUrl(activeRoomId));
		shareBtn.textContent = 'Link copied';
	} catch {
		shareBtn.textContent = 'Collaborating';
	}
}

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
	exportBar?.refresh();
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

function openViewer(
	source: PptxViewerSource,
	name: string,
	collaboration?: CollaborationConfig,
): void {
	viewer?.destroy();
	viewer = null;
	exportBar?.destroy();
	exportBar = null;
	stopNotesObserver?.();
	stopNotesObserver = null;
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
		autosave: true,
		collaboration,
		smartArt3D,
		onCollaborationStatus: (status) => {
			shareBtn.textContent =
				status === 'connected'
					? 'Collaborating'
					: status === 'error'
						? 'Collab error'
						: 'Collaborate';
		},
		onError: (message, error) => {
			console.error('pptx-vanilla-viewer failed to load', message, error);
			showLanding();
			showError(message || t('demo.viewer.loadError'));
		},
	});
	activeRoomId = collaboration?.roomId ?? null;
	shareBtn.hidden = false;
	shareBtn.textContent = collaboration ? 'Copy link' : 'Collaborate';
	// e2e/debug seam: expose the live viewer handle for scripted verification.
	(window as unknown as { __pptxViewer?: PptxViewerInstance }).__pptxViewer = viewer;
	exportBar = createExportBar({
		exportPng: () => viewer?.exportSlidePng() ?? Promise.resolve(),
		exportPdf: () => viewer?.exportPdf() ?? Promise.resolve(),
		exportGif: () => viewer?.exportGif() ?? Promise.resolve(),
		exportVideo: () => viewer?.exportVideo() ?? Promise.resolve(),
		print: async () => {
			// `false` = popup blocked; the click handler context normally allows it.
			const opened = (await viewer?.print()) ?? false;
			if (!opened) {
				console.warn('[pptx-vanilla-viewer demo] print window blocked by the browser');
			}
		},
	});
	shell.append(exportBar.el);

	// Keep the pickers/export bar clear of the notes panel as it expands
	// (see notes-offset.ts): the viewer chrome mounts synchronously above, so
	// `.pptxv-notes` is already in the DOM here.
	const notesEl = shell.querySelector('.pptxv-notes');
	if (notesEl) {
		stopNotesObserver = observeNotesHeight(notesEl);
	}
}

function showLanding(): void {
	viewer?.destroy();
	viewer = null;
	exportBar?.destroy();
	exportBar = null;
	stopNotesObserver?.();
	stopNotesObserver = null;
	activeRoomId = null;
	shareBtn.hidden = true;
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

// A `?room=<id>` link auto-joins a collaboration session: open a blank deck
// wired to the room so the host's slides arrive through late-joiner sync.
const joinRoom = readRoomFromUrl();
if (joinRoom) {
	void (async () => {
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Shared Session',
			initialSlideCount: 1,
		});
		const bytes = await handler.save(data.slides);
		handler.dispose();
		openViewer(bytes, 'Shared Session', buildRoomConfig(joinRoom, userName));
	})();
} else {
	showLanding();
}
