import type { PptxSmartArtChrome } from 'pptx-viewer-core';
import React from 'react';

// ── Font sizing ─────────────────────────────────────────────────────────────

/**
 * Compute the largest font size that will fit `text` within a bounding box
 * defined by `maxWidth` x `maxHeight`, capped at `baseSize`.
 *
 * The heuristic assumes each character is roughly 0.6x the font size in width.
 * The returned value is clamped to a minimum of 6 px to remain legible.
 *
 * @param text      - The string to measure.
 * @param maxWidth  - Available horizontal space in pixels.
 * @param maxHeight - Available vertical space in pixels.
 * @param baseSize  - Maximum (ideal) font size in pixels.
 * @returns The computed font size in pixels (>= 6).
 */
export function fitFontSize(
	text: string,
	maxWidth: number,
	maxHeight: number,
	baseSize: number,
): number {
	// Approximate: each character is ~0.6x the font size in width
	const charWidthRatio = 0.6;
	const maxByWidth = maxWidth / (text.length * charWidthRatio);
	const maxByHeight = maxHeight * 0.5;
	return Math.max(6, Math.min(baseSize, maxByWidth, maxByHeight));
}

// ── SVG shape helpers ───────────────────────────────────────────────────────

/**
 * Generate SVG polygon `points` for a chevron / arrow shape inscribed in the
 * bounding box starting at (`x`, `y`) with size `w` x `h`.
 *
 * The chevron has a notch on the left side and an arrow tip on the right.
 *
 * @param x - Left edge x coordinate.
 * @param y - Top edge y coordinate.
 * @param w - Width of the bounding box.
 * @param h - Height of the bounding box.
 * @returns A space-separated list of "x,y" coordinate pairs.
 */
export function chevronPoints(x: number, y: number, w: number, h: number): string {
	const depth = Math.min(w * 0.2, h * 0.4);
	return [
		`${x},${y}`,
		`${x + w - depth},${y}`,
		`${x + w},${y + h / 2}`,
		`${x + w - depth},${y + h}`,
		`${x},${y + h}`,
		`${x + depth},${y + h / 2}`,
	].join(' ');
}

/**
 * Generate an SVG path string for a gear shape with teeth.
 *
 * The gear is centred at (`cx`, `cy`). Teeth alternate between `outerR` and
 * `innerR` radii around the centre.
 *
 * @param cx     - Centre x coordinate.
 * @param cy     - Centre y coordinate.
 * @param outerR - Outer (tooth tip) radius.
 * @param innerR - Inner (tooth valley) radius.
 * @param teeth  - Number of teeth around the gear.
 * @returns An SVG path data string (M/L/Z).
 */
export function gearPath(
	cx: number,
	cy: number,
	outerR: number,
	innerR: number,
	teeth: number,
): string {
	const segments: string[] = [];
	const step = (Math.PI * 2) / (teeth * 2);

	for (let i = 0; i < teeth * 2; i++) {
		const angle = i * step - Math.PI / 2;
		const r = i % 2 === 0 ? outerR : innerR;
		const x = cx + r * Math.cos(angle);
		const y = cy + r * Math.sin(angle);
		segments.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
	}
	segments.push('Z');
	return segments.join(' ');
}

// ── Chrome wrapper ──────────────────────────────────────────────────────────

/**
 * Wrap SmartArt content in a chrome container that applies optional
 * background colour and outline border from the diagram's chrome settings.
 *
 * @param chrome    - Optional chrome styling (background, outline).
 * @param content   - The React element to wrap.
 * @param className - Additional CSS classes for the wrapper `<div>`.
 * @returns A `<div>` wrapping the content with chrome styles applied.
 */
export function wrapChrome(
	chrome: PptxSmartArtChrome | undefined,
	content: React.ReactElement,
	className: string,
): React.ReactElement {
	const wrapperStyle: React.CSSProperties = {};
	if (chrome?.backgroundColor) {
		wrapperStyle.backgroundColor = chrome.backgroundColor;
	}
	if (chrome?.outlineColor) {
		wrapperStyle.border = `${chrome.outlineWidth ?? 1}px solid ${chrome.outlineColor}`;
	}

	return (
		<div className={`w-full h-full ${className}`} style={wrapperStyle}>
			{content}
		</div>
	);
}
