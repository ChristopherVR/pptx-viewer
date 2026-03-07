import type { TextSegment } from '../core';

/** Extracted bullet information type, guaranteed non-null. */
type SegmentBulletInfo = NonNullable<TextSegment['bulletInfo']>;

/**
 * Groups text segments that belong to the same paragraph.
 * Paragraph breaks split segments into consecutive groups.
 */
interface ParagraphGroup {
	/** Zero-based paragraph index within the text body. */
	index: number;
	/** Non-break segments belonging to this paragraph. */
	segments: TextSegment[];
}

/**
 * Result of rendering a single paragraph, including the formatted
 * text and whether it was rendered as a list item.
 */
interface ParagraphRenderResult {
	/** The rendered text (Markdown or HTML). */
	text: string;
	/** True if this paragraph was rendered as a bullet or numbered list item. */
	isListItem: boolean;
}

/**
 * Options controlling how text segments are rendered into Markdown or HTML.
 */
export interface TextSegmentRenderOptions {
	/** Per-paragraph indent/margin data for computing list nesting levels. */
	paragraphIndents?: Array<{ marginLeft?: number; indent?: number }>;
	/** Current slide number, used to resolve `slidenum` field placeholders. */
	slideNumber?: number;
	/** Date/time string for resolving `datetime` field placeholders. */
	dateTimeText?: string;
	/** When true, paragraphs are joined with `<br />` instead of double newlines. */
	inlineMode?: boolean;
	/** When true, bullet/numbered list rendering is suppressed. */
	disableLists?: boolean;
	/** When true, `<p align="...">` wrappers are suppressed for non-left-aligned text. */
	disableAlignment?: boolean;
	/**
	 * When true, emit HTML formatting tags (`<strong>`, `<em>`, `<a>`, etc.)
	 * instead of Markdown syntax.  Use this for text that will be embedded
	 * inside an HTML block element (e.g. a positioned `<div>`) where
	 * Markdown syntax would be rendered literally.
	 *
	 * This does NOT add inline font-family / font-size / colour styles --
	 * it only converts formatting tokens.
	 */
	htmlFormatting?: boolean;
}

export class TextSegmentRenderer {
	public render(
		segments: TextSegment[],
		options: TextSegmentRenderOptions = {}
	): string {
		if (segments.length === 0) return '';
		const paragraphs = this.groupParagraphs(segments);
		const renderedParagraphs = paragraphs
			.map((group) => this.renderParagraph(group, options))
			.filter((paragraph) => paragraph.text.length > 0);
		if (renderedParagraphs.length === 0) return '';

		if (options.inlineMode) {
			return renderedParagraphs.map((entry) => entry.text).join('<br />');
		}

		// Inside an HTML block, newlines don't produce visual breaks.
		// Use <br> to separate non-block paragraphs.
		if (options.htmlFormatting) {
			return renderedParagraphs.map((entry) => entry.text).join('<br>');
		}

		const output: string[] = [];
		for (let index = 0; index < renderedParagraphs.length; index += 1) {
			if (index > 0) {
				const previous = renderedParagraphs[index - 1];
				const current = renderedParagraphs[index];
				output.push(
					previous.isListItem && current.isListItem ? '\n' : '\n\n'
				);
			}
			output.push(renderedParagraphs[index].text);
		}
		return output.join('');
	}

	public renderInline(
		segments: TextSegment[],
		options: TextSegmentRenderOptions = {}
	): string {
		return this.render(segments, {
			...options,
			inlineMode: true,
			disableLists: true,
			disableAlignment: true,
		});
	}

	public plainText(
		segments: TextSegment[],
		options: TextSegmentRenderOptions = {}
	): string {
		const paragraphs = this.groupParagraphs(segments);
		const rendered = paragraphs
			.map((group) =>
				group.segments
					.map((segment) =>
						this.resolvePlainSegmentText(segment, options)
					)
					.join('')
					.trim()
			)
			.filter((text) => text.length > 0);
		return rendered.join(' ').trim();
	}

	private groupParagraphs(segments: TextSegment[]): ParagraphGroup[] {
		const groups: ParagraphGroup[] = [];
		let buffer: TextSegment[] = [];
		let paragraphIndex = 0;

		for (const segment of segments) {
			if (segment.isParagraphBreak) {
				if (buffer.length > 0) {
					groups.push({ index: paragraphIndex, segments: buffer });
					buffer = [];
				}
				paragraphIndex += 1;
				continue;
			}
			buffer.push(segment);
		}

		if (buffer.length > 0) {
			groups.push({ index: paragraphIndex, segments: buffer });
		}
		return groups;
	}

	private renderParagraph(
		group: ParagraphGroup,
		options: TextSegmentRenderOptions
	): ParagraphRenderResult {
		let rawText = group.segments
			.map((segment) => this.renderSegment(segment, options))
			.join('');

		// Collapse adjacent identical formatting markers that result
		// from consecutive same-styled segments.
		if (options.htmlFormatting) {
			rawText = rawText
				.replace(/<\/strong><strong>/g, '')
				.replace(/<\/em><em>/g, '')
				.replace(/<\/s><s>/g, '');
		} else {
			rawText = rawText
				.replace(/\*\*\*\*/g, '')
				.replace(/~~~~/g, '');
		}

		// Inside an HTML block, literal newlines don't produce visual
		// line breaks — convert them to <br> so each line renders
		// on its own row.
		if (options.htmlFormatting) {
			rawText = rawText.replace(/\n/g, '<br>');
		}

		rawText = rawText.trim();

		if (!rawText) {
			return { text: '', isListItem: false };
		}

		if (!options.disableLists && !options.inlineMode) {
			const bullet = group.segments.find((segment) =>
				Boolean(segment.bulletInfo)
			)?.bulletInfo;
			if (bullet && !bullet.none) {
				const level = this.resolveListLevel(
					bullet,
					group.index,
					options.paragraphIndents
				);
				const marker = this.resolveListMarker(bullet, group.index);

				// Avoid doubling – if the text already starts with a
				// matching numbered marker (e.g. "1. "), don't prepend
				// another one.
				const alreadyNumbered =
					bullet.autoNumType &&
					/^\d+[.)]\s/.test(rawText);
				const prefix = alreadyNumbered ? '' : `${marker} `;

				if (options.htmlFormatting) {
					const pad = level * 1.5;
					return {
						text: `<div style="padding-left:${pad}em">${prefix}${rawText}</div>`,
						isListItem: true,
					};
				}
				return {
					text: `${'  '.repeat(level)}${prefix}${rawText}`,
					isListItem: true,
				};
			}
		}

		const align = group.segments[0]?.style.align;
		if (
			!options.disableAlignment &&
			!options.inlineMode &&
			align &&
			align !== 'left'
		) {
			return {
				text: `<p align="${align}">${rawText}</p>`,
				isListItem: false,
			};
		}

		return {
			text: rawText,
			isListItem: false,
		};
	}

	private renderSegment(
		segment: TextSegment,
		options: TextSegmentRenderOptions
	): string {
		const plain = this.resolvePlainSegmentText(segment, options);
		if (!plain) return '';

		if (segment.equationXml) {
			const normalized = plain.trim() || '[equation]';
			return `$${normalized}$`;
		}

		const useHtml = options.htmlFormatting ?? false;
		let text = useHtml
			? this.escapeHtml(plain)
			: this.escapeMarkdown(plain);

		if (segment.style.textCaps === 'all') {
			text = text.toUpperCase();
		}

		if (!useHtml) {
			const isCode = this.isCodeLike(segment);
			if (isCode) {
				text = this.wrapCode(text);
			}
		}

		if (segment.style.strikethrough) {
			text = useHtml ? `<s>${text}</s>` : `~~${text}~~`;
		}
		if (segment.style.bold && segment.style.italic) {
			text = useHtml
				? `<strong><em>${text}</em></strong>`
				: `***${text}***`;
		} else {
			if (segment.style.bold) {
				text = useHtml ? `<strong>${text}</strong>` : `**${text}**`;
			}
			if (segment.style.italic) {
				text = useHtml ? `<em>${text}</em>` : `*${text}*`;
			}
		}
		if (segment.style.underline) {
			text = `<u>${text}</u>`;
		}
		if (segment.style.baseline && segment.style.baseline > 0) {
			text = `<sup>${text}</sup>`;
		}
		if (segment.style.baseline && segment.style.baseline < 0) {
			text = `<sub>${text}</sub>`;
		}
		if (segment.style.textCaps === 'small') {
			text = `<span style="font-variant:small-caps">${text}</span>`;
		}
		if (segment.style.hyperlink) {
			const destination = this.renderLinkDestination(
				segment.style.hyperlink
			);
			if (useHtml) {
				text = `<a href="${destination}">${text}</a>`;
			} else {
				const title = segment.style.hyperlinkTooltip
					? ` "${this.escapeLinkTitle(segment.style.hyperlinkTooltip)}"`
					: '';
				text = `[${text}](${destination}${title})`;
			}
		}

		if (segment.style.rtl) {
			text = `\u200F${text}`;
		}

		return text;
	}

	private resolvePlainSegmentText(
		segment: TextSegment,
		options: TextSegmentRenderOptions
	): string {
		if (segment.fieldType) {
			return this.resolveFieldSegment(
				segment.fieldType,
				segment.text,
				options
			);
		}

		if (segment.equationXml) {
			const fromXml = this.extractOmmlLatex(segment.equationXml).trim();
			if (fromXml) return fromXml;
			if (segment.text.trim()) return segment.text.trim();
			return '[equation]';
		}

		return segment.text;
	}

	private resolveFieldSegment(
		fieldType: string,
		defaultText: string,
		options: TextSegmentRenderOptions
	): string {
		const normalizedFieldType = fieldType.trim().toLowerCase();
		if (normalizedFieldType.includes('slidenum')) {
			if (typeof options.slideNumber === 'number') {
				return String(options.slideNumber);
			}
			return defaultText;
		}
		if (
			normalizedFieldType.includes('datetime') ||
			normalizedFieldType.includes('date')
		) {
			if (options.dateTimeText) {
				return options.dateTimeText;
			}
			return defaultText;
		}
		return defaultText;
	}

	private isCodeLike(segment: TextSegment): boolean {
		if (segment.style.hyperlink) return false;
		const family = segment.style.fontFamily?.toLowerCase() ?? '';
		return (
			family.includes('mono') ||
			family.includes('courier') ||
			family.includes('consolas') ||
			family.includes('code')
		);
	}

	private resolveListLevel(
		bulletInfo: SegmentBulletInfo,
		paragraphIndex: number,
		paragraphIndents:
			| Array<{ marginLeft?: number; indent?: number }>
			| undefined
	): number {
		const explicitLevel = this.readUnknownNumericProp(bulletInfo, 'level');
		if (typeof explicitLevel === 'number') {
			return Math.max(0, Math.floor(explicitLevel));
		}

		const indentInfo = paragraphIndents?.[paragraphIndex];
		const marginLeft = indentInfo?.marginLeft ?? 0;
		const indent = indentInfo?.indent ?? 0;
		const spacingPoints = Math.max(0, marginLeft + Math.max(indent, 0));
		if (spacingPoints <= 0) return 0;

		return Math.max(0, Math.round(spacingPoints / 24));
	}

	private resolveListMarker(
		bulletInfo: SegmentBulletInfo,
		paragraphIndex: number
	): string {
		if (bulletInfo.autoNumType) {
			const startAt = bulletInfo.autoNumStartAt ?? 1;
			const offset = bulletInfo.paragraphIndex ?? paragraphIndex;
			const value = Math.max(1, startAt + offset);
			return this.formatAutoNumber(value, bulletInfo.autoNumType);
		}

		if (bulletInfo.char) {
			const marker = bulletInfo.char.trim();
			if (/^[-*+>]$/.test(marker)) {
				return marker;
			}
		}

		return '-';
	}

	private formatAutoNumber(value: number, autoNumType: string): string {
		const normalized = autoNumType.toLowerCase();
		let token = String(value);
		if (normalized.includes('roman')) {
			token = this.toRoman(value);
			if (normalized.includes('lc')) token = token.toLowerCase();
		}
		if (normalized.includes('alpha')) {
			token = this.toAlphabetic(value);
			if (normalized.includes('uc')) token = token.toUpperCase();
			if (normalized.includes('lc')) token = token.toLowerCase();
		}
		if (normalized.includes('parenboth')) {
			return `(${token})`;
		}
		if (normalized.includes('parenr')) {
			return `${token})`;
		}
		if (normalized.includes('minus')) {
			return `${token}-`;
		}
		return `${token}.`;
	}

	private toAlphabetic(value: number): string {
		let remaining = Math.max(1, value);
		let result = '';
		while (remaining > 0) {
			remaining -= 1;
			result = String.fromCharCode(97 + (remaining % 26)) + result;
			remaining = Math.floor(remaining / 26);
		}
		return result;
	}

	private toRoman(value: number): string {
		const numerals: Array<[number, string]> = [
			[1000, 'M'],
			[900, 'CM'],
			[500, 'D'],
			[400, 'CD'],
			[100, 'C'],
			[90, 'XC'],
			[50, 'L'],
			[40, 'XL'],
			[10, 'X'],
			[9, 'IX'],
			[5, 'V'],
			[4, 'IV'],
			[1, 'I'],
		];
		let remaining = Math.max(1, value);
		let result = '';
		for (const [numeric, literal] of numerals) {
			while (remaining >= numeric) {
				result += literal;
				remaining -= numeric;
			}
		}
		return result;
	}

	private readUnknownNumericProp(
		source: unknown,
		key: string
	): number | undefined {
		if (!source || typeof source !== 'object') return undefined;
		const value = (source as Record<string, unknown>)[key];
		if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
		return value;
	}

	private wrapCode(text: string): string {
		const matches = text.match(/`+/g);
		const maxTicks =
			matches && matches.length > 0
				? Math.max(...matches.map((entry) => entry.length))
				: 0;
		const fence = '`'.repeat(Math.max(1, maxTicks + 1));
		return `${fence}${text}${fence}`;
	}

	private renderLinkDestination(href: string): string {
		if (/\s/.test(href) || href.includes(')')) {
			return `<${href}>`;
		}
		return href;
	}

	private escapeLinkTitle(value: string): string {
		return value.replace(/"/g, '&quot;');
	}

	private escapeMarkdown(text: string): string {
		return text.replace(/([\\`*_{}[\]|])/g, '\\$1');
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	private extractOmmlLatex(root: Record<string, unknown>): string {
		const rendered = this.renderOmmlNode(root).replace(/\s+/g, ' ').trim();
		if (rendered) return rendered;
		return this.collectOmmlText(root).replace(/\s+/g, ' ').trim();
	}

	private renderOmmlNode(node: unknown): string {
		if (node === null || node === undefined) return '';
		if (typeof node === 'string') return node;
		if (typeof node === 'number') return String(node);
		if (Array.isArray(node)) {
			return node.map((entry) => this.renderOmmlNode(entry)).join('');
		}
		if (typeof node !== 'object') return '';

		const record = node as Record<string, unknown>;
		if (typeof record['#text'] === 'string') return record['#text'];
		if (typeof record['m:t'] === 'string') return String(record['m:t']);
		if (record['m:t']) return this.renderOmmlNode(record['m:t']);

		const fraction = this.tryRenderFraction(record);
		if (fraction) return fraction;
		const superscript = this.tryRenderSuperscript(record);
		if (superscript) return superscript;
		const subscript = this.tryRenderSubscript(record);
		if (subscript) return subscript;
		const subSup = this.tryRenderSubSup(record);
		if (subSup) return subSup;
		const radical = this.tryRenderRadical(record);
		if (radical) return radical;
		const nary = this.tryRenderNary(record);
		if (nary) return nary;
		const delimiter = this.tryRenderDelimiter(record);
		if (delimiter) return delimiter;
		const matrix = this.tryRenderMatrix(record);
		if (matrix) return matrix;

		const ignored = new Set(['@_', 'm:rPr', 'm:ctrlPr', 'm:argPr']);
		let output = '';
		for (const [key, value] of Object.entries(record)) {
			if (ignored.has(key)) continue;
			if (key.startsWith('@_')) continue;
			output += this.renderOmmlNode(value);
		}
		return output;
	}

	private tryRenderFraction(node: Record<string, unknown>): string | null {
		const value = node['m:f'];
		if (!value) return null;
		const fraction = this.firstRecord(value);
		if (!fraction) return null;
		const numerator = this.renderOmmlNode(fraction['m:num']).trim();
		const denominator = this.renderOmmlNode(fraction['m:den']).trim();
		if (!numerator && !denominator) return null;
		return `\\frac{${numerator || ' '}}{${denominator || ' '}}`;
	}

	private tryRenderSuperscript(node: Record<string, unknown>): string | null {
		const value = node['m:sSup'];
		if (!value) return null;
		const sup = this.firstRecord(value);
		if (!sup) return null;
		const base = this.renderOmmlNode(sup['m:e']).trim();
		const exponent = this.renderOmmlNode(sup['m:sup']).trim();
		if (!base && !exponent) return null;
		return `${base}^{${exponent || ' '}}`;
	}

	private tryRenderSubscript(node: Record<string, unknown>): string | null {
		const value = node['m:sSub'];
		if (!value) return null;
		const sub = this.firstRecord(value);
		if (!sub) return null;
		const base = this.renderOmmlNode(sub['m:e']).trim();
		const index = this.renderOmmlNode(sub['m:sub']).trim();
		if (!base && !index) return null;
		return `${base}_{${index || ' '}}`;
	}

	private tryRenderSubSup(node: Record<string, unknown>): string | null {
		const value = node['m:sSubSup'];
		if (!value) return null;
		const subSup = this.firstRecord(value);
		if (!subSup) return null;
		const base = this.renderOmmlNode(subSup['m:e']).trim();
		const sub = this.renderOmmlNode(subSup['m:sub']).trim();
		const sup = this.renderOmmlNode(subSup['m:sup']).trim();
		if (!base && !sub && !sup) return null;
		return `${base}_{${sub || ' '}}^{${sup || ' '}}`;
	}

	private tryRenderRadical(node: Record<string, unknown>): string | null {
		const value = node['m:rad'];
		if (!value) return null;
		const radical = this.firstRecord(value);
		if (!radical) return null;
		const degree = this.renderOmmlNode(radical['m:deg']).trim();
		const expression = this.renderOmmlNode(radical['m:e']).trim();
		if (!expression && !degree) return null;
		if (degree) {
			return `\\sqrt[${degree}]{${expression || ' '}}`;
		}
		return `\\sqrt{${expression || ' '}}`;
	}

	private tryRenderNary(node: Record<string, unknown>): string | null {
		const value = node['m:nary'];
		if (!value) return null;
		const nary = this.firstRecord(value);
		if (!nary) return null;

		const naryPr = this.firstRecord(nary['m:naryPr']);
		const chrNode = this.firstRecord(naryPr?.['m:chr']);
		const symbol = this.readAttribute(chrNode, 'val') ?? '\\sum';
		const lower = this.renderOmmlNode(nary['m:sub']).trim();
		const upper = this.renderOmmlNode(nary['m:sup']).trim();
		const expression = this.renderOmmlNode(nary['m:e']).trim();

		let prefix = symbol;
		if (lower) prefix += `_{${lower}}`;
		if (upper) prefix += `^{${upper}}`;
		if (!expression) return prefix;
		return `${prefix} ${expression}`;
	}

	private tryRenderDelimiter(node: Record<string, unknown>): string | null {
		const value = node['m:d'];
		if (!value) return null;
		const delimiter = this.firstRecord(value);
		if (!delimiter) return null;

		const dPr = this.firstRecord(delimiter['m:dPr']);
		const begin =
			this.readAttribute(this.firstRecord(dPr?.['m:begChr']), 'val') ??
			'(';
		const end =
			this.readAttribute(this.firstRecord(dPr?.['m:endChr']), 'val') ??
			')';
		const expression = this.renderOmmlNode(delimiter['m:e']).trim();
		if (!expression) return null;
		return `\\left${begin}${expression}\\right${end}`;
	}

	private tryRenderMatrix(node: Record<string, unknown>): string | null {
		const value = node['m:m'];
		if (!value) return null;
		const matrix = this.firstRecord(value);
		if (!matrix) return null;

		const rows = this.toRecordArray(matrix['m:mr'])
			.map((row) => {
				const cells = this.toRecordArray(row['m:e'])
					.map((entry) => this.renderOmmlNode(entry).trim())
					.filter((entry) => entry.length > 0);
				return cells.join(' & ');
			})
			.filter((row) => row.length > 0);
		if (rows.length === 0) return null;
		return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
	}

	private collectOmmlText(node: unknown): string {
		if (node === null || node === undefined) return '';
		if (typeof node === 'string' || typeof node === 'number')
			return String(node);
		if (Array.isArray(node)) {
			return node.map((entry) => this.collectOmmlText(entry)).join(' ');
		}
		if (typeof node !== 'object') return '';

		const record = node as Record<string, unknown>;
		const textTokens: string[] = [];
		if (typeof record['m:t'] === 'string') textTokens.push(record['m:t']);
		if (typeof record['#text'] === 'string')
			textTokens.push(record['#text']);
		for (const [key, value] of Object.entries(record)) {
			if (key === 'm:t' || key === '#text' || key.startsWith('@_'))
				continue;
			textTokens.push(this.collectOmmlText(value));
		}
		return textTokens.join(' ');
	}

	private firstRecord(value: unknown): Record<string, unknown> | null {
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (
					entry &&
					typeof entry === 'object' &&
					!Array.isArray(entry)
				) {
					return entry as Record<string, unknown>;
				}
			}
			return null;
		}
		if (value && typeof value === 'object') {
			return value as Record<string, unknown>;
		}
		return null;
	}

	private toRecordArray(value: unknown): Array<Record<string, unknown>> {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.filter(
				(entry): entry is Record<string, unknown> =>
					Boolean(entry) &&
					typeof entry === 'object' &&
					!Array.isArray(entry)
			);
		}
		if (typeof value === 'object') {
			return [value as Record<string, unknown>];
		}
		return [];
	}

	private readAttribute(
		node: Record<string, unknown> | null,
		key: string
	): string | null {
		if (!node) return null;
		const direct = node[`@_${key}`];
		if (typeof direct === 'string') return direct;
		const fallback = node[key];
		if (typeof fallback === 'string') return fallback;
		return null;
	}
}
