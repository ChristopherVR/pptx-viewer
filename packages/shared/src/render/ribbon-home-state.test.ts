import { describe, expect, it } from 'vitest';

import {
	RIBBON_HOME_FAMILIES,
	canRequestHome,
	clipboardHomeControls,
	editingHomeControls,
	homeControlKey,
	homeFamilyControls,
	paragraphHomeAction,
	paragraphHomeAlign,
	paragraphHomeControls,
} from './ribbon-home-state';

describe('home family specs', () => {
	it('lists every control id once with a label and icon-ready id', () => {
		const ids = Object.keys(RIBBON_HOME_FAMILIES).flatMap((family) =>
			homeFamilyControls(family as keyof typeof RIBBON_HOME_FAMILIES).map((spec) =>
				homeControlKey(spec),
			),
		);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids).toContain('home.paragraph.justify');
		expect(ids).toContain('home.editing.replace');
	});

	it('rejects unknown, disabled and hidden requests', () => {
		const state = {
			controls: { 'home.editing.find': { disabled: true }, 'home.editing.replace': {} },
		};
		expect(canRequestHome('editing', state, { id: 'home.editing.replace' })).toBeTruthy();
		expect(canRequestHome('editing', state, { id: 'home.editing.find' })).toBeFalsy();
		expect(canRequestHome('editing', state, { id: 'home.font.bold' })).toBeFalsy();
		expect(
			canRequestHome(
				'editing',
				{ controls: { 'home.editing.find': { hidden: true } } },
				{ id: 'home.editing.find' },
			),
		).toBeFalsy();
	});
});

describe('clipboard gating', () => {
	const input = {
		editable: true,
		hasSelection: true,
		hasClipboard: true,
		formatPainterActive: false,
		canFormatPaint: true,
		showFormatPainter: true,
	};

	it('keeps Copy available read-only and the armed painter cancellable', () => {
		const readOnly = clipboardHomeControls({ ...input, editable: false });
		expect(readOnly['home.clipboard.copy']?.disabled).toBeFalsy();
		expect(readOnly['home.clipboard.cut']?.disabled).toBeTruthy();
		const armed = clipboardHomeControls({
			...input,
			formatPainterActive: true,
			canFormatPaint: false,
		});
		expect(armed['home.clipboard.formatPainter']?.disabled).toBeFalsy();
		expect(armed['home.clipboard.formatPainter']?.pressed).toBeTruthy();
	});
});

describe('paragraph actions', () => {
	it('decodes indent and alignment intents and ignores other ids', () => {
		expect(paragraphHomeAction('home.paragraph.decreaseIndent')).toStrictEqual({
			kind: 'indent',
			delta: -24,
		});
		expect(paragraphHomeAction('home.paragraph.increaseIndent')).toStrictEqual({
			kind: 'indent',
			delta: 24,
		});
		expect(paragraphHomeAction('home.paragraph.alignCenter')).toStrictEqual({
			kind: 'align',
			align: 'center',
		});
		expect(paragraphHomeAction('home.paragraph.lineSpacing')).toBeUndefined();
	});

	it('only reflects a pressed alignment the host can read', () => {
		expect(paragraphHomeAlign('right')).toBe('right');
		expect(paragraphHomeAlign('distributed')).toBeUndefined();
		const unknown = paragraphHomeControls({ enabled: true });
		expect(unknown['home.paragraph.alignLeft']?.pressed).toBeUndefined();
		const known = paragraphHomeControls({ enabled: true, align: 'justify' });
		expect(known['home.paragraph.justify']?.pressed).toBeTruthy();
		expect(known['home.paragraph.alignLeft']?.pressed).toBeFalsy();
	});
});

describe('editing state', () => {
	it('reflects an open find panel on Find and Replace', () => {
		expect(editingHomeControls({ findOpen: true })['home.editing.find']?.pressed).toBeTruthy();
		expect(editingHomeControls()['home.editing.find']?.pressed).toBeUndefined();
	});
});

describe('homeSnapshotTranslator', () => {
	it('resolves every key of the families up front and falls back to the translator', async () => {
		const { homeFamilyKeys, homeSnapshotTranslator } = await import('./ribbon-home-state');
		const calls: string[] = [];
		const t = (key: string) => {
			calls.push(key);
			return `de:${key}`;
		};
		const translate = homeSnapshotTranslator(['arrange-flip', 'slides'], t);
		expect(calls).toStrictEqual(expect.arrayContaining(homeFamilyKeys('slides')));
		expect(calls).toContain('pptx.arrange.flipH');
		const before = calls.length;
		expect(translate('pptx.arrange.flipH')).toBe('de:pptx.arrange.flipH');
		expect(calls).toHaveLength(before);
		expect(translate('other.key')).toBe('de:other.key');
	});
});
