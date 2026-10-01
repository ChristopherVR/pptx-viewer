/** Insert tab artwork on the shared 20px stroke grid. */
export const RIBBON_INSERT_ICON_PATHS: Readonly<Record<string, string>> = {
	table: 'M3 4h14v12H3ZM3 8h14M3 12h14M8 4v12M13 4v12',
	image: 'M3 4h14v12H3ZM3 14l4-4 3 3 3-4 4 5M6 7.5a1 1 0 1 0 2 0 1 1 0 1 0-2 0',
	layers: 'M10 3 2 7l8 4 8-4ZM2 10.5l8 4 8-4M2 14l8 4 8-4',
	link: 'M8 12a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1M12 8a3 3 0 0 0-4 0l-3 3a3 3 0 0 0 4 4l1-1',
	textBox: 'M3 3h14v14H3ZM6.5 7h7M10 7v7',
	headerFooter: 'M3 3h14v14H3ZM3 7h14M3 13h14',
	equation: 'M3.5 14h5M6 11.7v5M11.7 5.8l3.8 8.3M12.9 11.7h4.2',
	shapes: 'M3 3h7v7H3ZM6.5 12.5 3 17.5h7ZM11 14a3 3 0 1 0 6 0 3 3 0 1 0-6 0',
	chart: 'M3 3v14h14M6 10v4M10 6v8M14 9v5',
	action: 'M3 3h14v14H3ZM9 6.5l4 3.5-4 3.5',
	field: 'M3 5h14M3 10h9M3 15h10M14 13.5a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
	penTool: 'M3 17l2-6 8-8 4 4-8 8ZM3 17l5-2M12 6l4 4',
	chevronDown: 'm5 8 5 5 5-5',
};

/** Shape picker glyphs (16px grid, matching the shared preset catalogue). */
export const INSERT_SHAPE_GLYPH_PATHS: Readonly<Record<string, string>> = {
	square: 'M3 3.5h10v9H3z',
	circle: 'M8 3a5 5 0 1 0 0.01 0Z',
	database: 'M3 4.5c0-1 2.2-1.8 5-1.8s5 .8 5 1.8v7c0 1-2.2 1.8-5 1.8s-5-.8-5-1.8z',
	diamond: 'M8 2.5 13.5 8 8 13.5 2.5 8Z',
	minus: 'M3 8h10',
	moveRight: 'M2.5 8h9m0 0-3-3m3 3-3 3',
	plus: 'M8 3v10M3 8h10',
	triangle: 'M8 2.5 14 13H2Z',
};

const TRANSFORMS: Readonly<Record<string, string>> = {
	'rotate-45': 'rotate(45deg)',
	'rotate-90': 'rotate(90deg)',
	'-rotate-90': 'rotate(-90deg)',
	'rotate-180': 'rotate(180deg)',
	'-skew-x-12': 'skewX(-12deg)',
};

/** Catalogue glyph classes are Tailwind tokens; translate them to a CSS transform. */
export function insertGlyphTransform(glyphClass: string): string {
	return TRANSFORMS[glyphClass] ?? 'none';
}
