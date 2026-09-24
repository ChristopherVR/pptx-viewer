import { describe, expect, it } from 'vitest';

import { forceSvgStretchFill } from './svg-stretch-fill';

describe('forceSvgStretchFill', () => {
	it('inserts preserveAspectRatio="none" when the root has no such attribute', () => {
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><circle/></svg>';
		const result = forceSvgStretchFill(svg);
		expect(result).toContain('preserveAspectRatio="none"');
		expect(result).toContain('<circle/></svg>');
	});

	it('overrides an existing preserveAspectRatio value with "none"', () => {
		const svg =
			'<svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" viewBox="0 0 10 10"><rect/></svg>';
		const result = forceSvgStretchFill(svg);
		expect(result).toContain('preserveAspectRatio="none"');
		expect(result).not.toContain('xMidYMid');
	});

	it('handles a single-quoted existing attribute', () => {
		const svg =
			"<svg xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='xMinYMin slice'><g/></svg>";
		const result = forceSvgStretchFill(svg);
		expect(result).toContain('preserveAspectRatio="none"');
	});

	it('preserves an XML prologue before the root element', () => {
		const svg =
			'<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>';
		const result = forceSvgStretchFill(svg);
		expect(result.startsWith('<?xml')).toBeTruthy();
		expect(result).toContain('preserveAspectRatio="none"');
	});

	it('returns the input unchanged when there is no <svg> root', () => {
		const notSvg = '<div>not an svg</div>';
		expect(forceSvgStretchFill(notSvg)).toBe(notSvg);
	});

	it("applies regardless of the SVG document's own intrinsic size, since the caller may place it in a frame the crop tool never resized", () => {
		// COM-verified (2026-09-25): PowerPoint stretches a cropped SVG to fill
		// its frame identically whether the frame was shrunk to the crop's
		// aspect ratio (the crop-tool result) or left at its pre-crop size
		// (a hand-authored or round-tripped `<a:srcRect>` with an unrelated
		// `<a:ext>`). This function has no frame-size parameter on purpose: it
		// always forces `none`, because OOXML's `a:stretch/a:fillRect` fill
		// mode has no "frame happens to match the crop" special case either.
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle/></svg>';
		expect(forceSvgStretchFill(svg)).toContain('preserveAspectRatio="none"');
	});
});
