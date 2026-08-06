/**
 * Slide master, layout and theme part generation for converted .ppt decks.
 *
 * @module ppt/pptx/master-writer
 */

import { SCHEME } from '../color-scheme';
import type { PptDeck, PptMasterTextLevel } from '../ppt-model';
import { shapeXml } from './shape-writer';
import type { ShapeWriterContext } from './shape-writer';
import { emu, esc, solidFill } from './xml-utils';

const XMLNS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

function levelXml(tag: string, level: PptMasterTextLevel, fallbackSizePt: number): string {
	const attrs: string[] = [];
	if (level.marginLeftEmu !== undefined) {
		attrs.push(`marL="${emu(level.marginLeftEmu)}"`);
	}
	if (level.indentEmu !== undefined) {
		attrs.push(`indent="${-Math.abs(emu(level.indentEmu))}"`);
	}
	attrs.push(`algn="${level.align ?? 'l'}"`);

	let bullet = '';
	if (level.hasBullet === false) {
		bullet = '<a:buNone/>';
	} else if (level.hasBullet === true || level.bulletChar !== undefined) {
		if (level.bulletFontName !== undefined) {
			bullet += `<a:buFont typeface="${esc(level.bulletFontName)}"/>`;
		}
		bullet += `<a:buChar char="${esc(level.bulletChar ?? '•')}"/>`;
	}

	const size = Math.round((level.sizePt ?? fallbackSizePt) * 100);
	const bold = level.bold ? ' b="1"' : '';
	const color =
		level.colorRgb !== undefined
			? solidFill(level.colorRgb)
			: '<a:solidFill><a:schemeClr val="tx1"/></a:solidFill>';
	const font =
		level.fontName !== undefined
			? `<a:latin typeface="${esc(level.fontName)}"/>`
			: '<a:latin typeface="+mn-lt"/>';
	const defRPr = `<a:defRPr sz="${size}" kern="1200"${bold}>${color}${font}</a:defRPr>`;
	return `<a:${tag} ${attrs.join(' ')}>${bullet}${defRPr}</a:${tag}>`;
}

function styleLevels(levels: PptMasterTextLevel[], fallbackSizePt: number): string {
	const result: string[] = [];
	const count = Math.max(1, Math.min(levels.length, 9));
	for (let i = 0; i < count; i++) {
		result.push(levelXml(`lvl${i + 1}pPr`, levels[i] ?? {}, fallbackSizePt));
	}
	return result.join('');
}

/** Generate ppt/slideMasters/slideMaster1.xml. */
export function slideMasterXml(deck: PptDeck, ctx: ShapeWriterContext): string {
	const backgroundRgb = deck.masterBackgroundRgb ?? deck.scheme[SCHEME.background];
	const shapes = deck.masterShapes.map((shape) => shapeXml(shape, ctx)).join('');
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster ${XMLNS}>
  <p:cSld>
    <p:bg><p:bgPr>${solidFill(backgroundRgb)}<a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${shapes}
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
  <p:txStyles>
    <p:titleStyle>${styleLevels(deck.titleStyles, 44)}</p:titleStyle>
    <p:bodyStyle>${styleLevels(deck.bodyStyles, 32)}</p:bodyStyle>
    <p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:otherStyle>
  </p:txStyles>
</p:sldMaster>`;
}

/** Generate ppt/slideLayouts/slideLayout1.xml (blank layout). */
export function slideLayoutXml(): string {
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout ${XMLNS} type="blank" preserve="1">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

/**
 * Generate ppt/theme/theme1.xml from the .ppt color scheme.
 *
 * Scheme slot mapping: background -> lt1, text -> dk1, shadow -> lt2,
 * title text -> dk2, fills -> accent1, accents -> accent2/3.
 */
export function themeXml(deck: PptDeck): string {
	const s = deck.scheme;
	const majorFont = deck.fonts[0] ?? 'Arial';
	const minorFont = deck.fonts[0] ?? 'Arial';
	const clr = (name: string, value: string): string =>
		`<a:${name}><a:srgbClr val="${value}"/></a:${name}>`;
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Imported PPT Theme">
  <a:themeElements>
    <a:clrScheme name="Imported PPT">
      ${clr('dk1', s[SCHEME.textAndLines])}
      ${clr('lt1', s[SCHEME.background])}
      ${clr('dk2', s[SCHEME.titleText])}
      ${clr('lt2', s[SCHEME.shadows])}
      ${clr('accent1', s[SCHEME.fills])}
      ${clr('accent2', s[SCHEME.accent1])}
      ${clr('accent3', s[SCHEME.accent2])}
      ${clr('accent4', s[SCHEME.accent3])}
      ${clr('accent5', s[SCHEME.accent1])}
      ${clr('accent6', s[SCHEME.accent2])}
      ${clr('hlink', s[SCHEME.accent2])}
      ${clr('folHlink', s[SCHEME.accent3])}
    </a:clrScheme>
    <a:fontScheme name="Imported PPT">
      <a:majorFont><a:latin typeface="${esc(majorFont)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>
      <a:minorFont><a:latin typeface="${esc(minorFont)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Imported PPT">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
        <a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
  <a:objectDefaults/>
  <a:extraClrSchemeLst/>
</a:theme>`;
}
