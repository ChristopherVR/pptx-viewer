/**
 * The main master's placeholder shapes (title, body, date, footer, slide
 * number), written the way PowerPoint's own 97-2003 SaveAs writes them.
 *
 * They are not decoration: COM-measured, PowerPoint derives
 * `SlideMaster.TextStyles` (and every new slide's placeholder text) from
 * the master's title and body placeholders. A master with no placeholder
 * shapes reopens reporting PowerPoint's default theme styles (`+mj-lt` 44pt
 * title, `+mn-lt` 28pt body) even though its TextMasterStyleAtoms carry the
 * deck's own; splicing PowerPoint's own master placeholders into the same
 * file made it report the deck's styles.
 *
 * Record layout per shape, copied from PowerPoint 16.0's SaveAs format 1:
 * FSP (rectangle, `fHaveAnchor | fHaveSpt`), FOPT (locks, no fill, no line,
 * text anchor, name), ClientAnchor, ClientData { OEPlaceholderAtom with the
 * master position 0-4 }, ClientTextbox { the prompt text or the `*` field }.
 *
 * @module ppt/writer/master-placeholders-writer
 */

import { OA, RT } from '../record-types';
import { buildClientAnchor } from './anchor-writer';
import { ByteWriter, record } from './byte-writer';
import { buildFopt } from './fopt-writer';
import type { ShapeIdAllocator } from './shape-id-allocator';
import { buildStyleTextPropAtom } from './text-atom-writer';
import type { WMasterPlaceholder, WMasterPlaceholderKind } from './write-model';

/** `fHaveAnchor | fHaveSpt`. */
const FSP_FLAGS = 0x0a00;
const RECTANGLE_SPT = 1;
const TEXT_TYPE_TITLE = 0;
const TEXT_TYPE_BODY = 1;
const TEXT_TYPE_OTHER = 4;

interface PlaceholderSpec {
	position: number;
	/** PlaceholderEnum ([MS-PPT] 2.13.21). */
	placementId: number;
	/** PlaceholderSize: 0 full, 1 half, 2 quarter. */
	size: number;
	name: string;
	/** anchorText (0x87): 1 = middle; omitted (top) for the body. */
	anchorMiddle: boolean;
}

const SPECS: Record<WMasterPlaceholderKind, PlaceholderSpec> = {
	title: {
		position: 0,
		placementId: 0x01,
		size: 0,
		name: 'Title Placeholder 1',
		anchorMiddle: true,
	},
	body: {
		position: 1,
		placementId: 0x02,
		size: 0,
		name: 'Text Placeholder 2',
		anchorMiddle: false,
	},
	date: { position: 2, placementId: 0x07, size: 1, name: 'Date Placeholder 3', anchorMiddle: true },
	footer: {
		position: 3,
		placementId: 0x09,
		size: 2,
		name: 'Footer Placeholder 4',
		anchorMiddle: true,
	},
	slideNumber: {
		position: 4,
		placementId: 0x08,
		size: 2,
		name: 'Slide Number Placeholder 5',
		anchorMiddle: true,
	},
};

/** PowerPoint's master order, which is also the `position` order. */
export const MASTER_PLACEHOLDER_ORDER: readonly WMasterPlaceholderKind[] = [
	'title',
	'body',
	'date',
	'footer',
	'slideNumber',
];

const TITLE_PROMPT = 'Click to edit Master title style';
const BODY_PROMPT = [
	'Click to edit Master text styles',
	'Second level',
	'Third level',
	'Fourth level',
	'Fifth level',
];

function utf16z(text: string): Uint8Array {
	return new ByteWriter().utf16(text).u16(0).toBytes();
}

function atom(recType: number, data: Uint8Array): Uint8Array {
	return record(recType, data, 0, false, 0);
}

function textHeader(textType: number): Uint8Array {
	return atom(RT.TextHeaderAtom, new ByteWriter().u32(textType).toBytes());
}

/** TextSpecInfoAtom: one run covering `count` characters, spell info only (as PowerPoint writes). */
function textSpecInfo(count: number): Uint8Array {
	return atom(RT.TextSpecInfoAtom, new ByteWriter().u32(count).u32(1).u16(0).toBytes());
}

/** TextBytesAtom + MasterTextPropAtom for the prompt paragraphs at levels 0, 1, 2, ... */
function promptText(textType: number, paragraphs: string[]): Uint8Array {
	const text = paragraphs.join('\r');
	const levels = new ByteWriter();
	paragraphs.forEach((para, level) => {
		levels.u32(para.length + 1).u16(level);
	});
	return new ByteWriter()
		.bytes(textHeader(textType))
		.bytes(atom(RT.TextBytesAtom, new ByteWriter().ansi(text).toBytes()))
		.bytes(atom(RT.MasterTextPropAtom, levels.toBytes()))
		.bytes(textSpecInfo(text.length + 1))
		.toBytes();
}

/** The date / footer / slide-number text: an optional `*` field, sized like the source. */
function fieldText(
	kind: WMasterPlaceholderKind,
	sizePt: number | undefined,
	fontIndex: number | undefined,
): Uint8Array {
	const field =
		kind === 'date' ? RT.GenericDateMCAtom : kind === 'slideNumber' ? RT.SlideNumberMCAtom : 0;
	const text = field ? '*' : '';
	const style = buildStyleTextPropAtom(
		{
			textType: TEXT_TYPE_OTHER,
			paragraphs: [{ indentLevel: 0, runs: [{ text, ...(sizePt ? { sizePt } : {}) }] }],
		},
		() => fontIndex,
	);
	const w = new ByteWriter().bytes(textHeader(TEXT_TYPE_OTHER));
	if (text) {
		w.bytes(atom(RT.TextCharsAtom, new ByteWriter().utf16(text).toBytes()));
	}
	w.bytes(style);
	if (field) {
		w.bytes(atom(field, new ByteWriter().u32(0).toBytes())); // position of the `*`
	}
	return w.bytes(textSpecInfo(text.length + 1)).toBytes();
}

function clientTextbox(placeholder: WMasterPlaceholder, fontIndex: number | undefined): Uint8Array {
	switch (placeholder.kind) {
		case 'title':
			return promptText(TEXT_TYPE_TITLE, [TITLE_PROMPT]);
		case 'body':
			return promptText(TEXT_TYPE_BODY, BODY_PROMPT);
		default:
			return fieldText(placeholder.kind, placeholder.sizePt, fontIndex);
	}
}

function buildPlaceholderContainer(
	placeholder: WMasterPlaceholder,
	allocator: ShapeIdAllocator,
	fontIndex: number | undefined,
): Uint8Array {
	const spec = SPECS[placeholder.kind];
	const fsp = record(
		OA.FSP,
		new ByteWriter().u32(allocator.next()).u32(FSP_FLAGS).toBytes(),
		RECTANGLE_SPT,
		false,
		2,
	);
	const simple = [
		{ id: 0x7f, value: 0x01ef0001 }, // lock against grouping, as PowerPoint writes
		{ id: 0xbf, value: 0x00060000 }, // text booleans
		{ id: 0x1bf, value: 0x00110001 }, // fill: none
		{ id: 0x1ff, value: 0x00090001 }, // line: none
		{ id: 0x33f, value: 0x00080000 }, // shape booleans
		{ id: 0x3bf, value: 0x00020000 }, // group-shape booleans
	];
	if (spec.anchorMiddle) {
		simple.push({ id: 0x87, value: 1 }); // anchorText: middle
	}
	const placeholderAtom = new ByteWriter()
		.i32(spec.position)
		.u8(spec.placementId)
		.u8(spec.size)
		.u16(0)
		.toBytes();
	const data = new ByteWriter()
		.bytes(fsp)
		.bytes(buildFopt(simple, [{ id: 0x380, bytes: utf16z(spec.name) }]))
		.bytes(buildClientAnchor(placeholder.rect))
		.bytes(record(OA.ClientData, atom(RT.OEPlaceholderAtom, placeholderAtom), 0, true))
		.bytes(record(OA.ClientTextbox, clientTextbox(placeholder, fontIndex), 0, true))
		.toBytes();
	return record(OA.SpContainer, data, 0, true);
}

/**
 * PowerPoint's default Office Theme master frames on a 16:9 (12192000 x
 * 6858000 EMU) slide, as [x, y, w, h].
 */
const DEFAULT_FRAMES: Record<WMasterPlaceholderKind, [number, number, number, number]> = {
	title: [838200, 365125, 10515600, 1325563],
	body: [838200, 1825625, 10515600, 4351338],
	date: [838200, 6356350, 2743200, 365125],
	footer: [4038600, 6356350, 4114800, 365125],
	slideNumber: [8610600, 6356350, 2743200, 365125],
};

/**
 * Fill in every master placeholder `given` lacks with PowerPoint's default
 * frame, scaled to the slide size.
 */
export function completeMasterPlaceholders(
	given: readonly WMasterPlaceholder[],
	widthEmu: number,
	heightEmu: number,
): WMasterPlaceholder[] {
	const sx = widthEmu / 12192000;
	const sy = heightEmu / 6858000;
	return MASTER_PLACEHOLDER_ORDER.map((kind) => {
		const found = given.find((p) => p.kind === kind);
		if (found) {
			return found;
		}
		const [x, y, w, h] = DEFAULT_FRAMES[kind];
		const rect = {
			x: Math.round(x * sx),
			y: Math.round(y * sy),
			w: Math.round(w * sx),
			h: Math.round(h * sy),
		};
		return kind === 'title' || kind === 'body' ? { kind, rect } : { kind, rect, sizePt: 12 };
	});
}

/**
 * Build the master's placeholder SpContainers, in PowerPoint's position
 * order. `fieldFontIndex` is the date / footer / number text's font (the
 * theme's minor face, as PowerPoint writes it) in the FontCollection.
 */
export function buildMasterPlaceholders(
	placeholders: readonly WMasterPlaceholder[],
	allocator: ShapeIdAllocator,
	fieldFontIndex?: number,
): Uint8Array[] {
	return MASTER_PLACEHOLDER_ORDER.flatMap((kind) => {
		const placeholder = placeholders.find((p) => p.kind === kind);
		return placeholder ? [buildPlaceholderContainer(placeholder, allocator, fieldFontIndex)] : [];
	});
}
