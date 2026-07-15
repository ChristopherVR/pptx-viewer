import type {
	PresentationSessionMessage,
	PresentationSnapshot,
} from './presentation-session-types';
import { secureRandomUuid } from './secure-random';

export type * from './presentation-session-types';

export const PRESENTATION_CHANNEL_NAME = 'pptx-viewer-presenter';
export const PRESENTATION_HASH = '#pptx-audience';
export const PRESENTATION_NONCE_KEY = 'nonce';
export const PRESENTATION_MESSAGE_ORIGIN = 'pptx-viewer-presenter';

const DB_NAME = 'pptx-viewer-presentation';
const DB_VERSION = 1;
const STORE_NAME = 'decks';
const MAX_DECK_AGE_MS = 5 * 60 * 1000;

export interface AudienceScreenPlacement {
	left: number;
	top: number;
	width: number;
	height: number;
	label?: string;
}

interface ScreenDetailedLike extends Screen {
	availLeft: number;
	availTop: number;
	label?: string;
	isPrimary?: boolean;
}

interface ScreenDetailsLike {
	screens: ScreenDetailedLike[];
	currentScreen: ScreenDetailedLike;
}

interface WindowWithScreenDetails extends Window {
	getScreenDetails?: () => Promise<ScreenDetailsLike>;
}

interface StoredDeck {
	bytes: Uint8Array;
	createdAt: number;
}

export function createPresentationSessionId(): string {
	return secureRandomUuid();
}

export function createInitialPresentationSnapshot(slideIndex = 0): PresentationSnapshot {
	return {
		slideIndex: Math.max(0, Math.trunc(slideIndex)),
		buildStep: 0,
		sequence: 0,
		blackout: 'none',
		paused: false,
		elapsedMs: 0,
		zoom: { scale: 1, originX: 0.5, originY: 0.5 },
		pointer: { tool: 'none', x: 0.5, y: 0.5, color: '#ef4444' },
		inkStrokes: [],
		caption: '',
		subtitlesVisible: false,
	};
}

export function buildPresentationAudienceUrl(source: string, sessionId: string): string {
	const url = new URL(source);
	const params = new URLSearchParams();
	params.set(PRESENTATION_NONCE_KEY, sessionId);
	url.hash = `${PRESENTATION_HASH}&${params.toString()}`;
	return url.toString();
}

export function parsePresentationSessionId(hash: string): string | null {
	if (!hash.startsWith(PRESENTATION_HASH)) {
		return null;
	}
	const trailing = hash.slice(PRESENTATION_HASH.length).replace(/^[&;?]/u, '');
	if (!trailing) {
		return null;
	}
	return new URLSearchParams(trailing).get(PRESENTATION_NONCE_KEY);
}

export function isPresentationAudience(hash: string): boolean {
	return parsePresentationSessionId(hash) !== null;
}

export function isPresentationSessionMessage(value: unknown): value is PresentationSessionMessage {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const message = value as Record<string, unknown>;
	if (message.origin !== PRESENTATION_MESSAGE_ORIGIN || typeof message.sessionId !== 'string') {
		return false;
	}
	if (message.type === 'audience-ready' || message.type === 'presenter-exit') {
		return true;
	}
	if (message.type === 'presenter-slide-change') {
		return typeof message.slideIndex === 'number';
	}
	if (
		message.type !== 'presenter-state' ||
		!message.snapshot ||
		typeof message.snapshot !== 'object'
	) {
		return false;
	}
	const snapshot = message.snapshot as Record<string, unknown>;
	const zoom = snapshot.zoom as Record<string, unknown> | undefined;
	const pointer = snapshot.pointer as Record<string, unknown> | undefined;
	const inkStrokes = snapshot.inkStrokes;
	return (
		typeof snapshot.slideIndex === 'number' &&
		typeof snapshot.buildStep === 'number' &&
		typeof snapshot.sequence === 'number' &&
		(snapshot.blackout === 'none' ||
			snapshot.blackout === 'black' ||
			snapshot.blackout === 'white') &&
		typeof snapshot.paused === 'boolean' &&
		typeof snapshot.elapsedMs === 'number' &&
		(!zoom ||
			(typeof zoom.scale === 'number' &&
				typeof zoom.originX === 'number' &&
				typeof zoom.originY === 'number')) &&
		(!pointer ||
			(typeof pointer.tool === 'string' &&
				typeof pointer.x === 'number' &&
				typeof pointer.y === 'number' &&
				typeof pointer.color === 'string')) &&
		(inkStrokes === undefined || Array.isArray(inkStrokes)) &&
		(snapshot.caption === undefined || typeof snapshot.caption === 'string') &&
		(snapshot.subtitlesVisible === undefined || typeof snapshot.subtitlesVisible === 'boolean')
	);
}

export async function resolveAudienceScreenPlacement(
	sourceWindow: Window = window,
): Promise<AudienceScreenPlacement | null> {
	const managedWindow = sourceWindow as WindowWithScreenDetails;
	if (typeof managedWindow.getScreenDetails !== 'function') {
		return null;
	}
	try {
		const details = await managedWindow.getScreenDetails();
		const target =
			details.screens.find((screen) => screen !== details.currentScreen && !screen.isPrimary) ??
			details.screens.find((screen) => screen !== details.currentScreen);
		if (!target) {
			return null;
		}
		return {
			left: target.availLeft,
			top: target.availTop,
			width: target.availWidth,
			height: target.availHeight,
			label: target.label,
		};
	} catch {
		return null;
	}
}

export function placeAudienceWindow(target: Window, placement: AudienceScreenPlacement): void {
	try {
		target.moveTo(placement.left, placement.top);
		target.resizeTo(placement.width, placement.height);
		target.focus();
	} catch {
		// Window placement is a progressive enhancement.
	}
}

export async function swapPresentationWindows(
	presenter: Window,
	audience: Window,
): Promise<boolean> {
	const managedWindow = presenter as WindowWithScreenDetails;
	if (typeof managedWindow.getScreenDetails !== 'function') {
		return false;
	}
	try {
		const details = await managedWindow.getScreenDetails();
		const contains = (screen: ScreenDetailedLike, target: Window): boolean =>
			target.screenX >= screen.availLeft &&
			target.screenX < screen.availLeft + screen.availWidth &&
			target.screenY >= screen.availTop &&
			target.screenY < screen.availTop + screen.availHeight;
		const presenterScreen = details.screens.find((screen) => contains(screen, presenter));
		const audienceScreen = details.screens.find((screen) => contains(screen, audience));
		if (!presenterScreen || !audienceScreen || presenterScreen === audienceScreen) {
			return false;
		}
		placeAudienceWindow(audience, {
			left: presenterScreen.availLeft,
			top: presenterScreen.availTop,
			width: presenterScreen.availWidth,
			height: presenterScreen.availHeight,
		});
		placeAudienceWindow(presenter, {
			left: audienceScreen.availLeft,
			top: audienceScreen.availTop,
			width: audienceScreen.availWidth,
			height: audienceScreen.availHeight,
		});
		return true;
	} catch {
		return false;
	}
}

function openDeckDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME);
			}
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function storePresentationDeck(
	sessionId: string,
	content: ArrayBuffer | Uint8Array,
): Promise<void> {
	const db = await openDeckDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(STORE_NAME, 'readwrite');
		const bytes = content instanceof Uint8Array ? content : new Uint8Array(content);
		tx.objectStore(STORE_NAME).put(
			{ bytes, createdAt: Date.now() } satisfies StoredDeck,
			sessionId,
		);
		tx.oncomplete = () => {
			db.close();
			resolve();
		};
		tx.onerror = () => {
			db.close();
			reject(tx.error);
		};
	});
}

export async function loadPresentationDeck(sessionId: string): Promise<Uint8Array | null> {
	try {
		const db = await openDeckDb();
		return await new Promise((resolve, reject) => {
			const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(sessionId);
			request.onsuccess = () => {
				db.close();
				const record = request.result as StoredDeck | undefined;
				if (!record || Date.now() - record.createdAt > MAX_DECK_AGE_MS) {
					resolve(null);
					return;
				}
				const raw: unknown = record.bytes;
				resolve(
					raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : null,
				);
			};
			request.onerror = () => {
				db.close();
				reject(request.error);
			};
		});
	} catch {
		return null;
	}
}

export async function clearPresentationDeck(sessionId: string): Promise<void> {
	try {
		const db = await openDeckDb();
		await new Promise<void>((resolve) => {
			const tx = db.transaction(STORE_NAME, 'readwrite');
			tx.objectStore(STORE_NAME).delete(sessionId);
			tx.oncomplete = () => {
				db.close();
				resolve();
			};
			tx.onerror = () => {
				db.close();
				resolve();
			};
		});
	} catch {
		// IndexedDB is optional in restricted browsing modes.
	}
}
