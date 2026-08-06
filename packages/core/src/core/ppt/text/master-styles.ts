/**
 * TextMasterStyleAtom parsing ([MS-PPT] 2.9.33).
 *
 * The main master carries default text styles per text type (recInstance:
 * 0 = title, 1 = body, ...). Each atom holds cLevels indent levels, each a
 * TextPFException followed by a TextCFException. Instances >= 5 prefix each
 * level with a 2-byte level number.
 *
 * @module ppt/text/master-styles
 */

import type { PptColorScheme } from '../color-scheme';
import type { PptMasterTextLevel } from '../ppt-model';
import { iterateChildren } from '../record-stream';
import type { PptRecord } from '../record-stream';
import { RT, masterToEmu } from '../record-types';
import { parseCfExceptionAt, parsePfExceptionAt } from './style-props';

/**
 * Parse one TextMasterStyleAtom into per-level defaults.
 */
export function parseMasterStyleAtom(
	view: DataView,
	rec: PptRecord,
	scheme: PptColorScheme,
	fonts: string[],
): PptMasterTextLevel[] {
	const levels: PptMasterTextLevel[] = [];
	const end = rec.dataOffset + rec.recLen;
	if (rec.recLen < 2) {
		return levels;
	}
	const cLevels = view.getUint16(rec.dataOffset, true);
	let pos = rec.dataOffset + 2;

	for (let i = 0; i < cLevels && i < 10 && pos < end; i++) {
		if (rec.recInstance >= 5) {
			pos += 2; // explicit level number
		}
		const pf = parsePfExceptionAt(view, pos, end, scheme);
		if (!pf) {
			break;
		}
		pos = pf.next;
		const cf = parseCfExceptionAt(view, pos, end, scheme);
		if (!cf) {
			break;
		}
		pos = cf.next;

		const level: PptMasterTextLevel = {};
		if (cf.props.sizePt !== undefined) {
			level.sizePt = cf.props.sizePt;
		}
		if (cf.props.bold !== undefined) {
			level.bold = cf.props.bold;
		}
		if (cf.props.colorRgb !== undefined) {
			level.colorRgb = cf.props.colorRgb;
		}
		if (cf.props.fontRef !== undefined && fonts[cf.props.fontRef]) {
			level.fontName = fonts[cf.props.fontRef];
		}
		if (pf.props.align !== undefined) {
			level.align = pf.props.align;
		}
		if (pf.props.hasBullet !== undefined) {
			level.hasBullet = pf.props.hasBullet;
		}
		if (pf.props.bulletChar !== undefined) {
			level.bulletChar = pf.props.bulletChar;
		}
		if (pf.props.bulletFontRef !== undefined && fonts[pf.props.bulletFontRef]) {
			level.bulletFontName = fonts[pf.props.bulletFontRef];
		}
		if (pf.props.leftMarginMu !== undefined) {
			level.marginLeftEmu = masterToEmu(pf.props.leftMarginMu);
		}
		if (pf.props.indentMu !== undefined) {
			level.indentEmu = masterToEmu(pf.props.indentMu);
		}
		levels.push(level);
	}

	return levels;
}

/**
 * Collect the title (instance 0) and body (instance 1) master styles from a
 * MainMasterContainer.
 */
export function collectMasterStyles(
	view: DataView,
	masterContainer: PptRecord,
	scheme: PptColorScheme,
	fonts: string[],
): { titleStyles: PptMasterTextLevel[]; bodyStyles: PptMasterTextLevel[] } {
	let titleStyles: PptMasterTextLevel[] = [];
	let bodyStyles: PptMasterTextLevel[] = [];
	for (const child of iterateChildren(view, masterContainer)) {
		if (child.recType !== RT.TextMasterStyleAtom) {
			continue;
		}
		if (child.recInstance === 0 && titleStyles.length === 0) {
			titleStyles = parseMasterStyleAtom(view, child, scheme, fonts);
		} else if (child.recInstance === 1 && bodyStyles.length === 0) {
			bodyStyles = parseMasterStyleAtom(view, child, scheme, fonts);
		}
	}
	return { titleStyles, bodyStyles };
}
