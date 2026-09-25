/**
 * TextPFException / TextCFException encoders ([MS-PPT] 2.9.18 / 2.9.13),
 * shared by a slide shape's `StyleTextPropAtom` (`text-atom-writer.ts`) and
 * the main master's `TextMasterStyleAtom`s (`master-text-styles-writer.ts`).
 *
 * Only the properties a paragraph or run actually sets are written (their
 * mask bits set), so everything else inherits from the master style, as
 * PowerPoint's own output does.
 *
 * @module ppt/writer/text-exception-writer
 */

import type { ByteWriter } from './byte-writer';
import { encodeColorIndex } from './colors';
import type { WParagraph, WRun } from './write-model';

/** Paragraph-level fields a TextPFException can carry. */
export type WParagraphProps = Omit<WParagraph, 'runs' | 'indentLevel'>;

/** Character-level fields a TextCFException can carry. */
export type WRunProps = Omit<WRun, 'text' | 'hyperlink'>;

/** Resolves a font name to its `FontCollection` index. */
export type FontIndexer = (name?: string) => number | undefined;

const ALIGN_CODE: Record<NonNullable<WParagraph['align']>, number> = {
	l: 0,
	ctr: 1,
	r: 2,
	just: 3,
};

/** Master units (576 per inch) from EMU. */
const EMU_PER_MASTER_UNIT = 914400 / 576;

/** Encode one TextPFException for a paragraph. */
export function writePfException(w: ByteWriter, para: WParagraphProps): void {
	let mask = 0;
	if (para.hasBullet !== undefined) {
		mask |= 0x0001;
	}
	if (para.bulletChar !== undefined) {
		mask |= 0x0080;
	}
	if (para.bulletColorRgb !== undefined) {
		mask |= 0x0020;
	}
	if (para.align !== undefined) {
		mask |= 0x0800;
	}
	if (para.marginLeftEmu !== undefined) {
		mask |= 0x0100;
	}
	if (para.indentEmu !== undefined) {
		mask |= 0x0400;
	}
	w.u32(mask);
	if (mask & 0x0000000f) {
		w.u16(para.hasBullet ? 1 : 0);
	}
	if (mask & 0x0080) {
		w.u16(para.bulletChar!.charCodeAt(0));
	}
	if (mask & 0x0020) {
		const [r, g, b, idx] = encodeColorIndex(para.bulletColorRgb);
		w.u8(r).u8(g).u8(b).u8(idx);
	}
	if (mask & 0x0800) {
		w.u16(ALIGN_CODE[para.align!]);
	}
	if (mask & 0x0100) {
		w.u16(Math.round(para.marginLeftEmu! / EMU_PER_MASTER_UNIT));
	}
	if (mask & 0x0400) {
		w.u16(Math.round(para.indentEmu! / EMU_PER_MASTER_UNIT));
	}
}

/** Encode one TextCFException for a run. */
export function writeCfException(w: ByteWriter, run: WRunProps, fontIndex: FontIndexer): void {
	// Only the style bits the run actually sets go in the mask, as PowerPoint
	// writes them (COM-measured: a bold-only run is mask `0x1`, fontStyle
	// `0x1`). Setting bold+italic+underline together for any styled run (this
	// writer's earlier behaviour) made PowerPoint read ALL THREE as on.
	let mask = 0;
	if (run.bold !== undefined) {
		mask |= 0x0001;
	}
	if (run.italic !== undefined) {
		mask |= 0x0002;
	}
	if (run.underline !== undefined) {
		mask |= 0x0004;
	}
	const fontRef = fontIndex(run.fontName);
	if (fontRef !== undefined) {
		mask |= 0x10000;
	}
	if (run.sizePt !== undefined) {
		mask |= 0x20000;
	}
	if (run.colorRgb !== undefined) {
		mask |= 0x40000;
	}
	w.u32(mask);
	if (mask & 0x0000ffff) {
		let style = 0;
		if (run.bold) {
			style |= 0x1;
		}
		if (run.italic) {
			style |= 0x2;
		}
		if (run.underline) {
			style |= 0x4;
		}
		w.u16(style);
	}
	if (mask & 0x10000) {
		w.u16(fontRef!);
	}
	if (mask & 0x20000) {
		w.i16(Math.round(run.sizePt!));
	}
	if (mask & 0x40000) {
		const [r, g, b, idx] = encodeColorIndex(run.colorRgb);
		w.u8(r).u8(g).u8(b).u8(idx);
	}
}
