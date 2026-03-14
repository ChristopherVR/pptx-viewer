import type { TextSegment } from '../core';
import {
	isCodeLikeFont,
	resolveListLevel,
	resolveListMarker,
	type SegmentBulletInfo,
} from './ListMarkerHelper';
import { OmmlLatexConverter } from './OmmlLatexConverter';

/**
 * Groups text segments that belong to the same paragraph.
 */
interface ParagraphGroup {
	/** Zero-based paragraph index within the text body. */
	index: number;
	/** Non-break segments belonging to this paragraph. */
	segments: TextSegment[];
}

/**
 * Result of rendering a single paragraph.
 */
interface ParagraphRenderResult {
	text: string;
	isListItem: boolean;
}

/**
 * Options controlling how text segments are rendered.
 */
export interface TextSegmentRenderOptions {
	paragraphIndents?: Array<{ marginLeft?: number; indent?: number }>;
	slideNumber?: number;
	dateTimeText?: string;
	inlineMode?: boolean;
	disableLists?: boolean;
	disableAlignment?: boolean;
	/**
	 * When true, emit HTML formatting tags instead of Markdown syntax.
	 */
	htmlFormatting?: boolean;
}

export class TextSegmentRenderer {
	private readonly ommlConverter = new OmmlLatexConverter();

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
					.map((segment) => {
						const base = this.resolvePlainSegmentText(segment, options);
						// Append ruby annotation in parentheses for plain text output
						if (segment.rubyText) {
							return `${base}(${segment.rubyText})`;
						}
						return base;
					})
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
			)?.bulletInfo as SegmentBulletInfo | undefined;
			if (bullet && !bullet.none) {
				const level = resolveListLevel(
					bullet, group.index, options.paragraphIndents
				);
				const marker = resolveListMarker(bullet, group.index);
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

		return { text: rawText, isListItem: false };
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

		// Ruby text (phonetic guide): wrap with <ruby> in HTML mode,
		// or append in parentheses in Markdown mode
		if (segment.rubyText) {
			const rt = useHtml
				? this.escapeHtml(segment.rubyText)
				: segment.rubyText;
			if (useHtml) {
				text = `<ruby>${text}<rp>(</rp><rt>${rt}</rt><rp>)</rp></ruby>`;
			} else {
				text = `${text}(${rt})`;
			}
		}

		if (segment.style.textCaps === 'all') {
			text = text.toUpperCase();
		}

		if (!useHtml && isCodeLikeFont(segment)) {
			text = this.wrapCode(text);
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
			const dest = this.renderLinkDestination(segment.style.hyperlink);
			if (useHtml) {
				text = `<a href="${dest}">${text}</a>`;
			} else {
				const title = segment.style.hyperlinkTooltip
					? ` "${this.escapeLinkTitle(segment.style.hyperlinkTooltip)}"`
					: '';
				text = `[${text}](${dest}${title})`;
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
				segment.fieldType, segment.text, options
			);
		}
		if (segment.equationXml) {
			const fromXml = this.ommlConverter.convert(segment.equationXml).trim();
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
		const normalized = fieldType.trim().toLowerCase();
		if (normalized.includes('slidenum')) {
			if (typeof options.slideNumber === 'number') {
				return String(options.slideNumber);
			}
			return defaultText;
		}
		if (normalized.includes('datetime') || normalized.includes('date')) {
			if (options.dateTimeText) return options.dateTimeText;
			return defaultText;
		}
		return defaultText;
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
		if (/\s/.test(href) || href.includes(')')) return `<${href}>`;
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
}
