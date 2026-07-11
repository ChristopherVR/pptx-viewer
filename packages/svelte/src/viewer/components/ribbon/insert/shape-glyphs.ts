import type { ShapePresetGlyph } from 'pptx-viewer-shared';

/**
 * Maps the shared shape-preset catalogue's framework-neutral `glyph` names
 * and Tailwind-flavoured `glyphClass` tokens to this binding's inline-SVG
 * icon system (this binding has no Tailwind build, so the class tokens are
 * translated to literal CSS transforms instead, same approach as the
 * vanilla binding's `glyphClassToTransform`).
 */

const GLYPH_PATHS: Record<ShapePresetGlyph, string> = {
	square: 'M3 3.5h10v9H3z',
	circle: 'M8 3a5 5 0 1 0 0.01 0Z',
	database: 'M3 4.5c0-1 2.2-1.8 5-1.8s5 .8 5 1.8v7c0 1-2.2 1.8-5 1.8s-5-.8-5-1.8z',
	diamond: 'M8 2.5 13.5 8 8 13.5 2.5 8Z',
	minus: 'M3 8h10',
	moveRight: 'M2.5 8h9m0 0-3-3m3 3-3 3',
	plus: 'M8 3v10M3 8h10',
	triangle: 'M8 2.5 14 13H2Z',
};

const GLYPH_STROKE_ONLY: ReadonlySet<ShapePresetGlyph> = new Set(['minus', 'moveRight', 'plus']);

/** The SVG path `d` string for a catalogue glyph. */
export function shapeGlyphPath(glyph: ShapePresetGlyph): string {
	return GLYPH_PATHS[glyph];
}

/** Whether the glyph should render as a stroked line (vs a filled/outlined shape). */
export function isStrokeGlyph(glyph: ShapePresetGlyph): boolean {
	return GLYPH_STROKE_ONLY.has(glyph);
}

/** Convert the catalogue's Tailwind-flavoured `glyphClass` token to a CSS `transform`. */
export function glyphClassToTransform(glyphClass: string): string {
	switch (glyphClass) {
		case 'rotate-45':
			return 'rotate(45deg)';
		case 'rotate-90':
			return 'rotate(90deg)';
		case '-rotate-90':
			return 'rotate(-90deg)';
		case 'rotate-180':
			return 'rotate(180deg)';
		case '-skew-x-12':
			return 'skewX(-12deg)';
		default:
			return 'none';
	}
}
