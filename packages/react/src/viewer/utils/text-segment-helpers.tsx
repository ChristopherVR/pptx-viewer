import type { BulletInfo } from 'pptx-viewer-core';
import { resolvePictureBullet, sanitizeMathMl } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React from 'react';

import { convertOmmlToMathMl } from './omml-to-mathml';
import type { OmmlNode } from './omml-to-mathml';
import { renderTabbedLine } from './text-tab-layout';
import type { TabRenderContext } from './text-tab-layout';
import { segmentByScript, resolveFontForScript } from './unicode-script-detection';

/* Highlight info for a single segment, used by Find & Replace */
export interface TextSegmentHighlight {
	startOffset: number;
	length: number;
	isCurrent: boolean; // true for the currently focused match
}

/* Highlights grouped by segment index for an element */
export type ElementFindHighlights = Map<number, TextSegmentHighlight[]>;

/** Per-script font family set used by script-aware text rendering. */
export interface ScriptFonts {
	latin: string;
	eastAsia: string;
	complexScript: string;
	symbol: string;
}

/**
 * Render text with per-script font spans when fonts differ across Unicode
 * script categories (latin, eastAsia, complexScript, symbol).
 *
 * When all script fonts are the same (common case), returns the plain text
 * string with zero extra DOM overhead.
 */
export function renderScriptAwareText(
	text: string,
	needsScriptFonts: boolean,
	scriptFonts: ScriptFonts,
	baseFontFamily: string,
	keyPrefix: string,
): React.ReactNode {
	if (!needsScriptFonts || !text) {
		return text;
	}

	const runs = segmentByScript(text);
	if (runs.length <= 1) {
		// Single script: resolve font for that script inline
		if (runs.length === 1) {
			const font = resolveFontForScript(runs[0].script, scriptFonts);
			if (font && font !== baseFontFamily) {
				return <span style={{ fontFamily: font }}>{text}</span>;
			}
		}
		return text;
	}

	return runs.map((run, i) => {
		const font = resolveFontForScript(run.script, scriptFonts);
		if (!font || font === baseFontFamily) {
			return <React.Fragment key={`${keyPrefix}-r${i}`}>{run.text}</React.Fragment>;
		}
		return (
			<span key={`${keyPrefix}-r${i}`} style={{ fontFamily: font }}>
				{run.text}
			</span>
		);
	});
}

/**
 * Render the inner content of a text segment span, handling both the
 * no-highlight fast path and the find-highlight split path.
 */
export function renderSegmentContent(
	elementId: string,
	segmentIndex: number,
	textValue: string,
	lines: string[],
	needsScriptFonts: boolean,
	scriptFonts: ScriptFonts,
	baseFontFamily: string,
	findHighlights: ElementFindHighlights | undefined,
	/** When present, `\t` is laid out with real tab stops (align + leaders). */
	tabContext?: TabRenderContext,
): React.ReactNode {
	const segHl = findHighlights?.get(segmentIndex);
	if (!segHl || segHl.length === 0) {
		// Fast path: no highlights, render lines with script-aware fonts.
		return lines.map((line: string, lineIndex: number) => {
			const lineKey = `${elementId}-seg-${segmentIndex}-line-${lineIndex}`;
			const renderPiece = (text: string, key: string): React.ReactNode =>
				renderScriptAwareText(text, needsScriptFonts, scriptFonts, baseFontFamily, key);
			return (
				<React.Fragment key={lineKey}>
					{tabContext && line.includes('\t')
						? renderTabbedLine(line, tabContext, lineKey, renderPiece)
						: renderPiece(line, lineKey)}
					{lineIndex < lines.length - 1 ? <br /> : null}
				</React.Fragment>
			);
		});
	}

	// Split the entire segment text into highlighted/plain chunks
	const sorted = [...segHl].sort((a, b) => a.startOffset - b.startOffset);
	const chunks: Array<{
		text: string;
		highlighted: boolean;
		isCurrent: boolean;
	}> = [];
	let cursor = 0;
	for (const hl of sorted) {
		if (hl.startOffset > cursor) {
			chunks.push({
				text: textValue.slice(cursor, hl.startOffset),
				highlighted: false,
				isCurrent: false,
			});
		}
		chunks.push({
			text: textValue.slice(hl.startOffset, hl.startOffset + hl.length),
			highlighted: true,
			isCurrent: hl.isCurrent,
		});
		cursor = hl.startOffset + hl.length;
	}
	if (cursor < textValue.length) {
		chunks.push({
			text: textValue.slice(cursor),
			highlighted: false,
			isCurrent: false,
		});
	}
	return chunks.map((chunk, ci) =>
		chunk.highlighted ? (
			<mark
				key={`${elementId}-seg-${segmentIndex}-hl-${ci}`}
				style={{
					backgroundColor: chunk.isCurrent ? '#f97316' : '#facc15',
					color: 'inherit',
					borderRadius: 2,
				}}
			>
				{renderScriptAwareText(
					chunk.text,
					needsScriptFonts,
					scriptFonts,
					baseFontFamily,
					`${elementId}-seg-${segmentIndex}-hl-${ci}`,
				)}
			</mark>
		) : (
			<React.Fragment key={`${elementId}-seg-${segmentIndex}-hl-${ci}`}>
				{renderScriptAwareText(
					chunk.text,
					needsScriptFonts,
					scriptFonts,
					baseFontFamily,
					`${elementId}-seg-${segmentIndex}-hl-${ci}`,
				)}
			</React.Fragment>
		),
	);
}

/**
 * Render an equation segment (inline MathML from OMML).
 * Returns a React node, or `null` if not an equation.
 *
 * When `equationNumber` is provided, the equation is rendered centered with
 * the number right-aligned using a flexbox `justify-content: space-between`
 * layout, matching the standard academic equation numbering convention.
 */
export function renderEquationSegment(
	elementId: string,
	segmentIndex: number,
	equationXml: Record<string, unknown>,
	equationNumber?: string,
): React.ReactNode {
	const mathml = convertOmmlToMathMl(equationXml as OmmlNode);
	const safeMathml = mathml ? sanitizeMathMl(mathml) : '';

	const equationContent = safeMathml ? (
		<span
			className='inline-block align-middle'
			style={{
				fontFamily: '"Cambria Math", "STIX Two Math", serif',
			}}
			dangerouslySetInnerHTML={{ __html: safeMathml }}
		/>
	) : (
		<span className='inline-block px-1 py-0.5 rounded text-xs bg-gray-200/20 text-gray-400 italic'>
			{translationsEn['pptx.textSegment.equationFallback']}
		</span>
	);

	// When an equation number is provided, wrap in a flex container:
	// equation centered, number right-aligned.
	if (equationNumber) {
		return (
			<span
				key={`${elementId}-seg-${segmentIndex}`}
				style={{
					display: 'flex',
					justifyContent: 'space-between',
					alignItems: 'center',
					width: '100%',
				}}
			>
				{/* Left spacer to balance the right-aligned number */}
				<span style={{ visibility: 'hidden', whiteSpace: 'nowrap' }}>({equationNumber})</span>
				<span style={{ textAlign: 'center', flex: 1 }}>{equationContent}</span>
				<span
					style={{
						whiteSpace: 'nowrap',
						fontFamily: '"Cambria Math", "STIX Two Math", serif',
					}}
				>
					({equationNumber})
				</span>
			</span>
		);
	}

	return <span key={`${elementId}-seg-${segmentIndex}`}>{equationContent}</span>;
}

/**
 * Render a picture bullet as an `<img>` element.
 *
 * When `bulletInfo.imageDataUrl` is available, renders an `<img>` sized to
 * match the bullet/font size. When only `imageRelId` is set (image not yet
 * resolved), falls back to a default character bullet so the user never sees
 * a broken image icon.
 */
export function renderPictureBullet(
	elementId: string,
	segmentIndex: number,
	bulletInfo: BulletInfo,
	baseFontSize: number,
): React.ReactNode {
	const picture = resolvePictureBullet(bulletInfo, baseFontSize) ?? {
		sizePx: baseFontSize,
		fallbackMarker: '•',
		accessibleLabel: 'Bullet',
	};

	// Fallback: when no resolved image data URL is available, render a
	// default character bullet instead of a broken <img>.
	// Uses marginInlineEnd so that the spacing is correct in both LTR
	// (margin appears on the right) and RTL (margin appears on the left).
	if (!picture.src) {
		return (
			<span
				key={`${elementId}-seg-${segmentIndex}-bullet-fallback`}
				style={{
					fontSize: picture.sizePx,
					display: 'inline-block',
					verticalAlign: 'middle',
					marginInlineEnd: 4,
					color: bulletInfo.color || undefined,
					fontFamily: bulletInfo.fontFamily || undefined,
				}}
				aria-label={picture.accessibleLabel}
			>
				{`${picture.fallbackMarker} `}
			</span>
		);
	}

	return (
		<img
			key={`${elementId}-seg-${segmentIndex}-bullet-img`}
			src={picture.src}
			alt={picture.accessibleLabel}
			style={{
				width: picture.sizePx,
				height: picture.sizePx,
				display: 'inline-block',
				verticalAlign: 'middle',
				marginInlineEnd: 4,
				objectFit: 'contain',
			}}
		/>
	);
}

// Underline decoration (extracted to pptx-viewer-shared).
// `resolveUnderlineDecorationStyle` + `UnderlineDecorationCss` now live in
// `pptx-viewer-shared` (render/text-decoration). Re-exported here so existing
// React import paths keep working.
export type { UnderlineDecorationCss } from 'pptx-viewer-shared';
export { resolveUnderlineDecorationStyle } from 'pptx-viewer-shared';
