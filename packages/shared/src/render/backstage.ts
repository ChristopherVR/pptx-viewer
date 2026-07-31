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
	/** Dictionary key for `name`, so bindings can render a translated gallery. */
	nameKey: string;
	/** Dictionary key for `description`. */
	descriptionKey: string;
	preview: string;
}

/**
 * Look up a dotted UI string. Matches the call shape every binding's
 * translation function already has (react-i18next / vue-i18n `t`,
 * ngx-translate's `instant`, and the Vanilla/Svelte `Translator`), so a
 * binding can pass its own `t` straight through.
 */
export type BackstageTranslate = (key: string, params?: Record<string, string | number>) => string;

/**
 * `label` stays the English fallback so a host that renders the nav without a
 * dictionary still gets readable text; `labelKey` is what the bindings feed to
 * their translator. Both live here rather than in five view layers so the nav
 * cannot drift between bindings.
 */
export const BACKSTAGE_NAV: ReadonlyArray<{
	id: BackstagePage;
	label: string;
	labelKey: string;
	group?: 'footer';
}> = [
	{ id: 'home', label: 'Home', labelKey: 'pptx.backstage.nav.home' },
	{ id: 'new', label: 'New', labelKey: 'pptx.backstage.nav.new' },
	{ id: 'open', label: 'Open', labelKey: 'pptx.backstage.nav.open' },
	{ id: 'info', label: 'Info', labelKey: 'pptx.backstage.nav.info' },
	{ id: 'save', label: 'Save', labelKey: 'pptx.backstage.nav.save' },
	{ id: 'saveAs', label: 'Save As', labelKey: 'pptx.backstage.nav.saveAs' },
	{ id: 'print', label: 'Print', labelKey: 'pptx.backstage.nav.print' },
	{ id: 'share', label: 'Share', labelKey: 'pptx.backstage.nav.share' },
	{ id: 'export', label: 'Export', labelKey: 'pptx.backstage.nav.export' },
	{ id: 'close', label: 'Close', labelKey: 'pptx.backstage.nav.close' },
	{ id: 'account', label: 'Account', labelKey: 'pptx.backstage.nav.account', group: 'footer' },
	{ id: 'options', label: 'Options', labelKey: 'pptx.backstage.nav.options', group: 'footer' },
];

export const BACKSTAGE_TEMPLATES: readonly BackstageTemplate[] = [
	{
		id: 'blank',
		name: 'Blank Presentation',
		description: 'Start with a clean canvas',
		nameKey: 'pptx.backstage.template.blank.name',
		descriptionKey: 'pptx.backstage.template.blank.description',
		preview: 'linear-gradient(145deg, #fff 0 88%, #d34a1f 88%)',
	},
	{
		id: 'warm',
		name: 'Warm Welcome',
		description: 'Bold editorial title slides',
		nameKey: 'pptx.backstage.template.warm.name',
		descriptionKey: 'pptx.backstage.template.warm.description',
		preview: 'linear-gradient(135deg, #d94b20 0 62%, #f4b183 62%)',
	},
	{
		id: 'geometry',
		name: 'Geometric',
		description: 'Modern shapes and strong contrast',
		nameKey: 'pptx.backstage.template.geometry.name',
		descriptionKey: 'pptx.backstage.template.geometry.description',
		preview: 'conic-gradient(from 220deg, #173b8f, #dce6ff, #efb7bd, #173b8f)',
	},
	{
		id: 'mono',
		name: 'Urban Monochrome',
		description: 'Architectural black and white',
		nameKey: 'pptx.backstage.template.mono.name',
		descriptionKey: 'pptx.backstage.template.mono.description',
		preview: 'linear-gradient(125deg, #171717, #eee 49%, #777 50%, #fafafa)',
	},
	{
		id: 'earth',
		name: 'Earthy Inspiration',
		description: 'Natural, calm presentation system',
		nameKey: 'pptx.backstage.template.earth.name',
		descriptionKey: 'pptx.backstage.template.earth.description',
		preview: 'radial-gradient(circle at 70% 30%, #be9473, #34271f 38%, #111 70%)',
	},
	{
		id: 'future',
		name: 'Future Forward',
		description: 'Clean technology storytelling',
		nameKey: 'pptx.backstage.template.future.name',
		descriptionKey: 'pptx.backstage.template.future.description',
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

function splitFilePath(
	path: string,
	translate?: BackstageTranslate,
): { name: string; location: string } {
	const normalized = path.replace(/\\/g, '/');
	const parts = normalized.split('/').filter(Boolean);
	const label = (key: string, fallback: string): string => translate?.(key) ?? fallback;
	return {
		name: parts[parts.length - 1] || label('pptx.backstage.untitled', 'Untitled Presentation.pptx'),
		location:
			parts.slice(0, -1).join('/') || label('pptx.backstage.browserStorage', 'Browser storage'),
	};
}

/**
 * Recent autosave snapshots, newest first. `translate` only covers the two
 * fallback labels for a snapshot with no usable path; pass the binding's `t`
 * so those read in the user's language rather than English.
 */
export async function listBackstageRecentFiles(
	translate?: BackstageTranslate,
): Promise<BackstageRecentFile[]> {
	if (typeof indexedDB === 'undefined') {
		return [];
	}
	try {
		const snapshots = await listAutosaveSnapshots();
		return snapshots
			.map((snapshot) => ({ ...snapshot, ...splitFilePath(snapshot.key, translate) }))
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

/**
 * Relative "date modified" for a recent-files row. `translate` is optional so
 * existing two-argument calls keep working; without it the English wording is
 * used, which is also what the unit tests pin.
 */
export function formatBackstageDate(
	timestamp: number,
	now = Date.now(),
	translate?: BackstageTranslate,
): string {
	const elapsed = Math.max(0, now - timestamp);
	if (elapsed < 60_000) {
		return translate?.('pptx.backstage.justNow') ?? 'Just now';
	}
	if (elapsed < 3_600_000) {
		const count = Math.floor(elapsed / 60_000);
		return translate?.('pptx.backstage.minutesAgo', { count }) ?? `${count} min ago`;
	}
	if (elapsed < 86_400_000) {
		const count = Math.floor(elapsed / 3_600_000);
		return translate?.('pptx.backstage.hoursAgo', { count }) ?? `${count} hr ago`;
	}
	return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

export function formatBackstageSize(bytes: number): string {
	if (bytes < 1024 * 1024) {
		return `${Math.max(1, Math.round(bytes / 1024))} KB`;
	}
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
