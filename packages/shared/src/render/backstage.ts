import type { PptxSlide } from 'pptx-viewer-core';

import { getAutosaveSnapshot, listAutosaveSnapshots } from './autosave-store';
import { createBlankSlide } from './slide-operations';

export type BackstagePage =
	| 'home'
	| 'new'
	| 'open'
	| 'info'
	| 'save'
	| 'saveAs'
	| 'print'
	| 'share'
	| 'export'
	| 'close'
	| 'account'
	| 'options';

export interface BackstageRecentFile {
	key: string;
	name: string;
	location: string;
	timestamp: number;
	size: number;
}

export interface BackstageTemplate {
	id: string;
	name: string;
	description: string;
	preview: string;
}

export const BACKSTAGE_NAV: ReadonlyArray<{
	id: BackstagePage;
	label: string;
	group?: 'footer';
}> = [
	{ id: 'home', label: 'Home' },
	{ id: 'new', label: 'New' },
	{ id: 'open', label: 'Open' },
	{ id: 'info', label: 'Info' },
	{ id: 'save', label: 'Save' },
	{ id: 'saveAs', label: 'Save As' },
	{ id: 'print', label: 'Print' },
	{ id: 'share', label: 'Share' },
	{ id: 'export', label: 'Export' },
	{ id: 'close', label: 'Close' },
	{ id: 'account', label: 'Account', group: 'footer' },
	{ id: 'options', label: 'Options', group: 'footer' },
];

export const BACKSTAGE_TEMPLATES: readonly BackstageTemplate[] = [
	{
		id: 'blank',
		name: 'Blank Presentation',
		description: 'Start with a clean canvas',
		preview: 'linear-gradient(145deg, #fff 0 88%, #d34a1f 88%)',
	},
	{
		id: 'warm',
		name: 'Warm Welcome',
		description: 'Bold editorial title slides',
		preview: 'linear-gradient(135deg, #d94b20 0 62%, #f4b183 62%)',
	},
	{
		id: 'geometry',
		name: 'Geometric',
		description: 'Modern shapes and strong contrast',
		preview: 'conic-gradient(from 220deg, #173b8f, #dce6ff, #efb7bd, #173b8f)',
	},
	{
		id: 'mono',
		name: 'Urban Monochrome',
		description: 'Architectural black and white',
		preview: 'linear-gradient(125deg, #171717, #eee 49%, #777 50%, #fafafa)',
	},
	{
		id: 'earth',
		name: 'Earthy Inspiration',
		description: 'Natural, calm presentation system',
		preview: 'radial-gradient(circle at 70% 30%, #be9473, #34271f 38%, #111 70%)',
	},
	{
		id: 'future',
		name: 'Future Forward',
		description: 'Clean technology storytelling',
		preview: 'repeating-radial-gradient(ellipse at bottom, #111 0 3px, #fff 4px 13px)',
	},
];

const TEMPLATE_BACKGROUNDS: Readonly<
	Record<string, Pick<PptxSlide, 'backgroundColor' | 'backgroundGradient'>>
> = {
	blank: { backgroundColor: '#ffffff' },
	warm: {
		backgroundColor: '#d94b20',
		backgroundGradient: 'linear-gradient(135deg, #d94b20 0 62%, #f4b183 62%)',
	},
	geometry: {
		backgroundColor: '#dce6ff',
		backgroundGradient: 'linear-gradient(135deg, #173b8f, #dce6ff 54%, #efb7bd)',
	},
	mono: {
		backgroundColor: '#f4f4f4',
		backgroundGradient: 'linear-gradient(125deg, #171717, #eeeeee 49%, #777777 50%, #fafafa)',
	},
	earth: {
		backgroundColor: '#34271f',
		backgroundGradient: 'radial-gradient(circle at 70% 30%, #be9473, #34271f 38%, #111111 70%)',
	},
	future: {
		backgroundColor: '#ffffff',
		backgroundGradient:
			'repeating-radial-gradient(ellipse at bottom, #111111 0 3px, #ffffff 4px 13px)',
	},
};

/** Build a fresh one-slide deck from a backstage template selection. */
export function createBackstagePresentation(templateId: string): PptxSlide[] {
	const slide = createBlankSlide(1);
	return [{ ...slide, ...(TEMPLATE_BACKGROUNDS[templateId] ?? TEMPLATE_BACKGROUNDS.blank) }];
}

function splitFilePath(path: string): { name: string; location: string } {
	const normalized = path.replace(/\\/g, '/');
	const parts = normalized.split('/').filter(Boolean);
	return {
		name: parts[parts.length - 1] || 'Untitled Presentation.pptx',
		location: parts.slice(0, -1).join('/') || 'Browser storage',
	};
}

export async function listBackstageRecentFiles(): Promise<BackstageRecentFile[]> {
	if (typeof indexedDB === 'undefined') {
		return [];
	}
	try {
		const snapshots = await listAutosaveSnapshots();
		return snapshots
			.map((snapshot) => ({ ...snapshot, ...splitFilePath(snapshot.key) }))
			.sort((a, b) => b.timestamp - a.timestamp);
	} catch {
		return [];
	}
}

export async function readBackstageRecentFile(key: string): Promise<Uint8Array | undefined> {
	if (typeof indexedDB === 'undefined') {
		return undefined;
	}
	return (await getAutosaveSnapshot(key))?.data;
}

export function formatBackstageDate(timestamp: number, now = Date.now()): string {
	const elapsed = Math.max(0, now - timestamp);
	if (elapsed < 60_000) {
		return 'Just now';
	}
	if (elapsed < 3_600_000) {
		return `${Math.floor(elapsed / 60_000)} min ago`;
	}
	if (elapsed < 86_400_000) {
		return `${Math.floor(elapsed / 3_600_000)} hr ago`;
	}
	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

export function formatBackstageSize(bytes: number): string {
	if (bytes < 1024 * 1024) {
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
