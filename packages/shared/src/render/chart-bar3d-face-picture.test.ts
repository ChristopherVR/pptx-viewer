import { describe, expect, it } from 'vitest';

import { resolveUntargetedBarFaceFill } from './chart-bar3d-face-picture';
import { shade, tint } from './chart-palette';

// COM-verified ground truth (PowerPoint Object 16, 2026-09): an untargeted
// bar3D extrusion face with a picture-only fill (no c:spPr/a:solidFill) does
// NOT render black and does NOT render the picture itself; PowerPoint paints
// a flat colour derived from the picture, shaded with its ordinary per-face
// lighting. Reproducing the picture-derived colour needs decoded pixel data
// this synchronous SVG builder never has, so this resolver keeps painting
// the resolved point/series colour (`resolvedFill`) through the SAME
// tint/shade transform every solid-filled bar already gets - see
// chart-bar3d-face-picture.ts's doc comment for the two test decks that
// established this.
describe('resolveUntargetedBarFaceFill', () => {
	it('tints the resolved fill for the top/end face (lighter, matching barExtrusion)', () => {
		expect(resolveUntargetedBarFaceFill('end', '#4472C4')).toBe(tint('#4472C4', 0.22));
	});

	it('shades the resolved fill for the side face (darker, matching barExtrusion)', () => {
		expect(resolveUntargetedBarFaceFill('side', '#4472C4')).toBe(shade('#4472C4', 0.25));
	});

	it('never returns black regardless of the resolved fill', () => {
		expect(resolveUntargetedBarFaceFill('end', '#ED7D31')).not.toBe('#000000');
		expect(resolveUntargetedBarFaceFill('side', '#ED7D31')).not.toBe('#000000');
	});
});
