/**
 * Focused-target context: when the user scopes the assistant to specific slides
 * or elements (via {@link PptxAiBridge.getFocusedTargets}), this module turns
 * those targets into a compact text block the model is told to focus on, and
 * assembles the full per-turn deck context (the normal {@link PptxAiContextStrategy}
 * output plus the focus block).
 */

import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import type { PptxAiBridge, PptxAiFocusedTarget } from './bridge';
import type { PptxAiContextStrategy } from './config';
import { buildDeckOutline, buildSlideMarkdown, clampToTokenBudget, slideTitle } from './context';

/** Tuning knobs for the focus block (all optional, with conservative defaults). */
export interface FocusedContextOptions {
	/** Token cap for the entire focus block. Default `1500`. */
	maxTokens?: number;
	/** Max table cells rendered per element target before truncation. Default `60`. */
	maxTableCells?: number;
}

/** Format an element's bounds as `(x,y WxH)` in rounded CSS pixels. */
function bounds(el: PptxElement): string {
	return `(${Math.round(el.x)},${Math.round(el.y)} ${Math.round(el.width)}x${Math.round(el.height)})`;
}

/** One-line inventory entry for an element (id, type, bounds, short text). */
function elementLine(el: PptxElement): string {
	const text =
		'text' in el && typeof el.text === 'string' ? el.text.trim().replace(/\s+/gu, ' ') : '';
	const snippet = text ? `: "${text.slice(0, 60)}"` : '';
	return `  - ${el.type}#${el.id} ${bounds(el)}${snippet}`;
}

/** Render a table element's rows/cols and cell text, capped at `maxCells`. */
function describeTable(el: PptxElement, maxCells: number): string[] {
	if (el.type !== 'table' || !el.tableData) {
		return [];
	}
	const rows = el.tableData.rows;
	const cols = rows.reduce((max, row) => Math.max(max, row.cells.length), 0);
	const lines = [`  ${rows.length}x${cols} table cells:`];
	let rendered = 0;
	for (let r = 0; r < rows.length; r++) {
		if (rendered >= maxCells) {
			lines.push('  ...[table truncated to fit context budget]');
			break;
		}
		const cells: string[] = [];
		for (const cell of rows[r].cells) {
			if (rendered >= maxCells) {
				cells.push('...');
				break;
			}
			cells.push(cell.text.replace(/\s+/gu, ' ').trim());
			rendered += 1;
		}
		lines.push(`    R${r}: ${cells.join(' | ')}`);
	}
	return lines;
}

/** Describe a single element target (type, id, bounds, and table cells). */
function describeElementTarget(
	slides: PptxSlide[],
	target: Extract<PptxAiFocusedTarget, { kind: 'element' }>,
	maxCells: number,
): string {
	const slide = slides[target.slideIndex];
	const el = slide?.elements.find((e) => e.id === target.elementId);
	if (!el) {
		return `Element ${target.elementId} on slide ${target.slideIndex + 1} (not found).`;
	}
	const header = `Element ${el.type}#${el.id} on slide ${target.slideIndex + 1} ${bounds(el)}`;
	const tableLines = describeTable(el, maxCells);
	if (tableLines.length > 0) {
		return [header, ...tableLines].join('\n');
	}
	if ('text' in el && typeof el.text === 'string' && el.text.trim()) {
		return `${header}\n  text: "${el.text.trim().replace(/\s+/gu, ' ').slice(0, 200)}"`;
	}
	return header;
}

/** Describe a whole-slide target (index, title, and element inventory). */
function describeSlideTarget(
	slides: PptxSlide[],
	target: Extract<PptxAiFocusedTarget, { kind: 'slide' }>,
): string {
	const slide = slides[target.slideIndex];
	if (!slide) {
		return `Slide ${target.slideIndex + 1} (not found).`;
	}
	const title = slideTitle(slide) ?? '(no title)';
	const lines = [`Slide ${target.slideIndex + 1}: ${title}`];
	for (const el of slide.elements) {
		lines.push(elementLine(el));
	}
	return lines.join('\n');
}

/**
 * Build the focus block for the bridge's current focused targets, or `undefined`
 * when the bridge exposes no targets (method absent or empty). The block is
 * prefixed so the model treats these targets as the scope of the request.
 */
export function buildFocusedTargetsContext(
	bridge: PptxAiBridge,
	options: FocusedContextOptions = {},
): string | undefined {
	const targets = bridge.getFocusedTargets?.() ?? [];
	if (targets.length === 0) {
		return undefined;
	}
	const slides = bridge.getSlides();
	const maxCells = options.maxTableCells ?? 60;
	const blocks = targets.map((target) =>
		target.kind === 'slide'
			? describeSlideTarget(slides, target)
			: describeElementTarget(slides, target, maxCells),
	);
	const body = [
		'The user has selected the following to focus on. Scope your work to these unless asked otherwise:',
		'',
		...blocks,
	].join('\n');
	return clampToTokenBudget(body, options.maxTokens ?? 1500);
}

/**
 * Assemble the full per-turn deck context: the configured
 * {@link PptxAiContextStrategy} output (whole-deck outline / current slide /
 * none) followed by the focused-targets block when the user has scoped the
 * assistant. Returns an empty string when there is nothing to add.
 */
export async function buildDeckContext(
	bridge: PptxAiBridge,
	options: {
		strategy: PptxAiContextStrategy;
		maxTokens?: number;
		focus?: FocusedContextOptions;
	},
): Promise<string> {
	const meta = bridge.getDeckMeta();
	const slides = bridge.getSlides();
	const parts: string[] = [];

	if (options.strategy === 'outline') {
		parts.push(buildDeckOutline(slides, meta, { maxTokens: options.maxTokens }));
	} else if (options.strategy === 'current-slide') {
		parts.push(
			await buildSlideMarkdown(slides, meta.activeSlideIndex, meta, {
				maxTokens: options.maxTokens,
			}),
		);
	}

	const focus = buildFocusedTargetsContext(bridge, options.focus);
	if (focus) {
		parts.push(focus);
	}
	return parts.filter((part) => part.trim()).join('\n\n');
}
