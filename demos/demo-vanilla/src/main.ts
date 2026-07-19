import type {
	CollaborationConfig,
	PptxViewerInstance,
	PptxViewerSource,
} from 'pptx-vanilla-viewer';
import {
	createPptxViewer,
	loadPresentationDeck,
	parsePresentationSessionId,
	themeToCssVars,
} from 'pptx-vanilla-viewer';
import { PptxHandler } from 'pptx-viewer-core';

import { buildViewerAiConfig, createAiConfigCard } from './ai-config';
import { buildRoomConfig, readRoomFromUrl, resolveAutoName } from './collab';
import { getLanguage, onLanguageChange, t, viewerMessages } from './demo-i18n';
import { createDropzone } from './dropzone';
import { readStoredTheme, themes } from './themes';

import './styles.css';

/**
 * Demo app for `pptx-vanilla-viewer`, mirroring demos/demo-vue/src/App.vue: the
 * viewer fills the screen and a landing dropzone handles file open / sample deck
 * loading. A `?room=<id>` URL
 * param auto-joins a serverless (WebRTC) collaboration session. Starting a new
 * session is dialog-driven: the viewer's own toolbar Share/Broadcast buttons
 * open the built-in modal dialogs (see `pptx-vanilla-viewer`'s
 * `viewer/collab/ui`), prefilled with a demo-generated display name via
 * `shareDefaults`.
 */

const appRoot = document.getElementById('app');
if (!appRoot) {
	throw new Error('missing #app root');
}
const app: HTMLElement = appRoot;

const themeKey = readStoredTheme();
let viewer: PptxViewerInstance | null = null;
let appliedVarKeys: string[] = [];

// A demo-generated display name, offered to the viewer's built-in Share and
// Broadcast dialogs as a prefilled default (see `shareDefaults` below).
const userName = resolveAutoName();

// Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`,
// mirroring demo-vue's `App.vue`.
const smartArt3D = new URLSearchParams(window.location.search).get('smartArt3D') === '1';

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

onLanguageChange((code) => {
	viewer?.setLocale(code);
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
	app.replaceChildren();

	const shell = document.createElement('main');
	shell.className = 'demo-shell';
	shell.dataset.pptxViewer = '';
	app.append(shell);

	document.title = `${name} - PPTX Viewer`;
	viewer = createPptxViewer(shell, {
		source,
		fileName: name,
		theme: themes[themeKey].theme,
		locale: getLanguage(),
		messages: viewerMessages,
		editable: true,
		autosave: true,
		collaboration,
		smartArt3D,
		ai: buildViewerAiConfig(),
		shareDefaults: { userName },
		onError: (message, error) => {
			console.error('pptx-vanilla-viewer failed to load', message, error);
			showLanding();
			showError(message || t('demo.viewer.loadError'));
		},
	});
	// e2e/debug seam: expose the live viewer handle for scripted verification.
	(window as unknown as { __pptxViewer?: PptxViewerInstance }).__pptxViewer = viewer;
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
		createAiConfigCard(),
	);
}

applyRootVars();

/**
 * `?sample=1` auto-loads the bundled sample deck (used by the docs landing page
 * to embed a live, pre-populated viewer). Returns null when unavailable so the
 * caller can fall back to its default flow.
 */
async function fetchSampleDeck(): Promise<Uint8Array | null> {
	try {
		const res = await fetch(`${import.meta.env.BASE_URL}sample-deck.pptx`);
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}`);
		}
		return new Uint8Array(await res.arrayBuffer());
	} catch {
		return null;
	}
}

// A `?room=<id>` link auto-joins a collaboration session: open a blank deck
// wired to the room so the host's slides arrive through late-joiner sync. With
// `?sample=1` too, the sample deck seeds the session instead of a blank one.
const audienceSession = parsePresentationSessionId(window.location.hash);
const joinRoom = readRoomFromUrl();
const wantSample = new URLSearchParams(window.location.search).get('sample') === '1';
if (audienceSession) {
	void loadPresentationDeck(audienceSession).then((content) => {
		if (content) {
			openViewer(content, 'Audience View');
		}
		return undefined;
	});
} else if (joinRoom) {
	void (async () => {
		const sample = wantSample ? await fetchSampleDeck() : null;
		if (sample) {
			openViewer(sample, 'sample-deck.pptx', buildRoomConfig(joinRoom, userName));
			return;
		}
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Shared Session',
			initialSlideCount: 1,
		});
		const bytes = await handler.save(data.slides);
		handler.dispose();
		openViewer(bytes, 'Shared Session', buildRoomConfig(joinRoom, userName));
	})();
} else if (wantSample) {
	void fetchSampleDeck().then((sample) => {
		if (sample) {
			openViewer(sample, 'sample-deck.pptx');
		} else {
			showLanding();
		}
		return undefined;
	});
} else {
	showLanding();
}
