/**
 * `updateThemeColorScheme` / `updateThemeFontScheme` used to rewrite ONLY the
 * primary theme part, so the second master of a two-master deck kept its old
 * scheme, and they baked `tx1 = dk1` / `bg1 = lt1` into the colour map no
 * matter what the master's `p:clrMap` said.
 */
import { describe, it, expect } from 'vitest';

import type { PptxThemeColorScheme, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

const MASTER1 = 'ppt/slideMasters/slideMaster1.xml';
const MASTER2 = 'ppt/slideMasters/slideMaster2.xml';
const THEME1 = 'ppt/theme/theme1.xml';
const THEME2 = 'ppt/theme/theme2.xml';

const SCHEME: PptxThemeColorScheme = {
	dk1: '#111111',
	lt1: '#EEEEEE',
	dk2: '#222222',
	lt2: '#DDDDDD',
	accent1: '#AA0000',
	accent2: '#00AA00',
	accent3: '#0000AA',
	accent4: '#AAAA00',
	accent5: '#AA00AA',
	accent6: '#00AAAA',
	hlink: '#0000FF',
	folHlink: '#800080',
};

function themeXml(name: string): string {
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		`<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${name}">` +
		'<a:themeElements><a:clrScheme name="Office">' +
		'<a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
		'<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>' +
		'<a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2>' +
		'<a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>' +
		'<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>' +
		'<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>' +
		'</a:clrScheme><a:fontScheme name="Office">' +
		'<a:majorFont><a:latin typeface="Calibri Light"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>' +
		'<a:minorFont><a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>' +
		'</a:fontScheme><a:fmtScheme name="Office"/></a:themeElements></a:theme>'
	);
}

/** A deck with two masters, each on its own theme part; master 2 swaps light and dark. */
class TwoMasterRuntime extends PptxHandlerRuntime {
	public constructor() {
		super();
		this.zip.file(THEME1, themeXml('Theme One'));
		this.zip.file(THEME2, themeXml('Theme Two'));
		this.masterThemePaths.set(MASTER1, THEME1);
		this.masterThemePaths.set(MASTER2, THEME2);
		this.masterThemeColorMaps.set(MASTER1, { accent1: '4F81BD' });
		this.masterThemeColorMaps.set(MASTER2, { accent1: '4F81BD' });
		this.masterThemeFontMaps.set(MASTER1, { 'mj-lt': 'Calibri Light' });
		this.masterThemeFontMaps.set(MASTER2, { 'mj-lt': 'Calibri Light' });
		this.masterClrMaps.set(MASTER2, { bg1: 'dk1', tx1: 'lt1', bg2: 'dk2', tx2: 'lt2' });
		this.currentMasterClrMap = this.masterClrMaps.get(MASTER2) ?? null;
		this.themeColorMap = { accent1: '4F81BD' };
	}

	public async themePart(path: string): Promise<XmlObject> {
		return this.parser.parse(await this.zip.file(path)!.async('string')) as XmlObject;
	}

	public colorMapOf(masterPath: string): Record<string, string> {
		return this.masterThemeColorMaps.get(masterPath)!;
	}

	public fontMapOf(masterPath: string): Record<string, string> {
		return this.masterThemeFontMaps.get(masterPath)!;
	}

	public get activeColorMap(): Record<string, string> {
		return this.themeColorMap;
	}

	public get snapshotColorMap(): Record<string, string> {
		return this.globalThemeColorMapSnapshot;
	}

	public get activeFontMap(): Record<string, string> {
		return this.themeFontMap;
	}
}

function accent1Of(theme: XmlObject): unknown {
	const elements = (theme['a:theme'] as XmlObject)['a:themeElements'] as XmlObject;
	const scheme = elements['a:clrScheme'] as XmlObject;
	return ((scheme['a:accent1'] as XmlObject)['a:srgbClr'] as XmlObject)['@_val'];
}

function majorLatinOf(theme: XmlObject): unknown {
	const elements = (theme['a:theme'] as XmlObject)['a:themeElements'] as XmlObject;
	const fonts = (elements['a:fontScheme'] as XmlObject)['a:majorFont'] as XmlObject;
	return (fonts['a:latin'] as XmlObject)['@_typeface'];
}

describe('updateThemeColorScheme across masters', () => {
	it('rewrites every theme part a master references, not just the primary one', async () => {
		const runtime = new TwoMasterRuntime();
		await runtime.updateThemeColorScheme(SCHEME);
		expect(accent1Of(await runtime.themePart(THEME1))).toBe('AA0000');
		expect(accent1Of(await runtime.themePart(THEME2))).toBe('AA0000');
		expect(runtime.colorMapOf(MASTER1).accent1).toBe('AA0000');
		expect(runtime.colorMapOf(MASTER2).accent1).toBe('AA0000');
		expect(runtime.snapshotColorMap.accent1).toBe('AA0000');
	});

	it('routes the alias slots through each master clrMap instead of assuming tx1 = dk1', async () => {
		const runtime = new TwoMasterRuntime();
		await runtime.updateThemeColorScheme(SCHEME);
		// Master 1 has no clrMap: schema defaults apply.
		expect(runtime.colorMapOf(MASTER1)).toMatchObject({ tx1: '111111', bg1: 'EEEEEE' });
		// Master 2 swaps light and dark, and the active map is master 2's.
		expect(runtime.colorMapOf(MASTER2)).toMatchObject({
			tx1: 'EEEEEE',
			bg1: '111111',
			tx2: 'DDDDDD',
			bg2: '222222',
		});
		expect(runtime.activeColorMap).toMatchObject({ tx1: 'EEEEEE', bg1: '111111' });
	});

	it('honours an explicit target list', async () => {
		const runtime = new TwoMasterRuntime();
		await runtime.updateThemeColorScheme(SCHEME, [THEME2]);
		expect(accent1Of(await runtime.themePart(THEME1))).toBe('4F81BD');
		expect(accent1Of(await runtime.themePart(THEME2))).toBe('AA0000');
		expect(runtime.colorMapOf(MASTER1).accent1).toBe('4F81BD');
		expect(runtime.colorMapOf(MASTER2).accent1).toBe('AA0000');
	});

	it('is a no-op when no target exists', async () => {
		const runtime = new TwoMasterRuntime();
		await runtime.updateThemeColorScheme(SCHEME, ['ppt/theme/theme9.xml']);
		expect(runtime.activeColorMap.accent1).toBe('4F81BD');
	});
});

describe('updateThemeFontScheme and updateThemeName across masters', () => {
	it('rewrites fonts on every theme part and per-master font map', async () => {
		const runtime = new TwoMasterRuntime();
		await runtime.updateThemeFontScheme({ majorFont: { latin: 'Georgia' } });
		expect(majorLatinOf(await runtime.themePart(THEME1))).toBe('Georgia');
		expect(majorLatinOf(await runtime.themePart(THEME2))).toBe('Georgia');
		expect(runtime.fontMapOf(MASTER1)['mj-lt']).toBe('Georgia');
		expect(runtime.fontMapOf(MASTER2)['mj-cs']).toBe('Georgia');
		expect(runtime.activeFontMap['mj-lt']).toBe('Georgia');
	});

	it('renames every theme part', async () => {
		const runtime = new TwoMasterRuntime();
		await runtime.updateThemeName('Corporate');
		expect((await runtime.themePart(THEME1))['a:theme']).toMatchObject({ '@_name': 'Corporate' });
		expect((await runtime.themePart(THEME2))['a:theme']).toMatchObject({ '@_name': 'Corporate' });
	});
});
