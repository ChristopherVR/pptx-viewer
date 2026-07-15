import { PptxComment, PptxCommentAuthor, XmlObject } from '../../types';
import {
	MODERN_AUTHOR_RELATIONSHIP,
	MODERN_COMMENT_RELATIONSHIP,
	parseModernAuthors,
	parseModernCommentPart,
} from '../../utils/modern-comment-xml';
import { xmlChild } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeThemeProcessing';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse modern threaded comments (PowerPoint 2019+ / Office 365).
	 * Modern comments use `p188:cmLst`/`p15:cmLst` roots within
	 * `ppt/comments/modernComment*.xml` or `ppt/comments-extended/...`.
	 * Each `p188:cm` / `p15:cm` node carries `@_id`, `@_authorId`,
	 * `@_created`, `@_status`, text body in `p188:txBody`/`p15:txBody`,
	 * and thread-parent via `@_parentCmId`.
	 */
	protected async extractModernSlideComments(slidePath: string): Promise<PptxComment[]> {
		try {
			const relsPath = `${slidePath.replace('slides/', 'slides/_rels/')}.rels`;
			const relsXml = await this.zip.file(relsPath)?.async('string');
			if (!relsXml) {
				return [];
			}

			const relsData = this.parser.parse(relsXml) as XmlObject;
			const rels = this.ensureArray(
				xmlChild(relsData, 'Relationships')?.Relationship,
			) as XmlObject[];

			const modernCommentRels = rels.filter(
				(rel) => String(rel?.['@_Type'] || '') === MODERN_COMMENT_RELATIONSHIP,
			);
			if (modernCommentRels.length === 0) {
				return [];
			}

			const modernComments: PptxComment[] = [];
			for (const rel of modernCommentRels) {
				const target = String(rel?.['@_Target'] || '').trim();
				if (!target) {
					continue;
				}
				const filePath = this.resolvePath(slidePath, target);
				const xml = await this.zip.file(filePath)?.async('string');
				if (!xml) {
					continue;
				}

				const parsed = parseModernCommentPart(
					this.parser.parse(xml) as XmlObject,
					{
						path: filePath,
						relationshipId: String(rel?.['@_Id'] || '').trim(),
					},
					(id) => this.modernCommentAuthors.get(id)?.name,
					PptxHandlerRuntime.EMU_PER_PX,
				);
				modernComments.push(...parsed.comments);
				this.modernCommentParts.set(slidePath, parsed.part);
			}
			return modernComments;
		} catch (e) {
			console.warn('Failed to parse modern comments:', e);
		}
		return [];
	}

	protected async loadModernCommentAuthors(): Promise<void> {
		const relsXml = await this.zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
		if (!relsXml) {
			return;
		}
		const relsData = this.parser.parse(relsXml) as XmlObject;
		const relationships = this.ensureArray(
			xmlChild(relsData, 'Relationships')?.Relationship,
		) as XmlObject[];
		const relationship = relationships.find(
			(entry) => String(entry?.['@_Type'] || '') === MODERN_AUTHOR_RELATIONSHIP,
		);
		const target = String(relationship?.['@_Target'] || '').trim();
		if (!target) {
			return;
		}
		const partPath = this.resolvePath('ppt/presentation.xml', target);
		const xml = await this.zip.file(partPath)?.async('string');
		if (!xml) {
			return;
		}
		const parsed = parseModernAuthors(this.parser.parse(xml) as XmlObject);
		this.modernCommentAuthors.clear();
		for (const author of parsed.authors) {
			if (author.id) {
				this.modernCommentAuthors.set(author.id, author);
			}
		}
		this.modernCommentAuthorsRootXml = parsed.root;
		this.modernCommentAuthorsPartPath = partPath;
		this.modernCommentAuthorsRelationshipId = String(relationship?.['@_Id'] || '').trim();
	}

	protected async resolveSlideCommentTarget(slidePath: string): Promise<string | undefined> {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (slideRels) {
			for (const [, target] of slideRels.entries()) {
				const normalizedTarget = String(target || '').toLowerCase();
				if (normalizedTarget.includes('comments/comment')) {
					return target;
				}
			}
		}

		// Some decks use non-standard comment part naming. Fall back to relationship type detection.
		const relsPath = `${slidePath.replace('slides/', 'slides/_rels/')}.rels`;
		const relsXml = await this.zip.file(relsPath)?.async('string');
		if (!relsXml) {
			return undefined;
		}

		try {
			const relsData = this.parser.parse(relsXml) as XmlObject;
			const rels = this.ensureArray(
				xmlChild(relsData, 'Relationships')?.Relationship,
			) as XmlObject[];
			const commentRelation = rels.find((relation) => {
				const relationType = String(relation?.['@_Type'] || '').toLowerCase();
				return relationType.endsWith('/comments');
			});
			const target = String(commentRelation?.['@_Target'] || '').trim();
			return target.length > 0 ? target : undefined;
		} catch (error) {
			console.warn('Failed to parse slide relationships for comments:', error);
			return undefined;
		}
	}

	protected extractCommentText(commentNode: XmlObject): string {
		const directText =
			commentNode?.['p:text'] ??
			commentNode?.['text'] ??
			this.xmlLookupService.getChildByLocalName(commentNode, 'text');
		if (typeof directText === 'string') {
			return directText.trim();
		}
		if (directText !== undefined && directText !== null) {
			return String(directText).trim();
		}

		const textBody =
			(commentNode?.['p:txBody'] as XmlObject | undefined) ||
			this.xmlLookupService.getChildByLocalName(commentNode, 'txBody');
		const bodyText = this.extractTextFromTxBody(textBody);
		if (bodyText.length > 0) {
			return bodyText;
		}

		return '';
	}

	protected async extractSlideComments(slidePath: string): Promise<PptxComment[]> {
		const commentTarget = await this.resolveSlideCommentTarget(slidePath);
		if (!commentTarget) {
			return [];
		}

		const commentsPath = this.resolveImagePath(slidePath, commentTarget);
		const commentsXml = await this.zip.file(commentsPath)?.async('string');
		if (!commentsXml) {
			return [];
		}

		try {
			const commentsData = this.parser.parse(commentsXml) as XmlObject;
			const commentsRoot = this.xmlLookupService.getChildByLocalName(commentsData, 'cmLst');
			const commentNodes = this.xmlLookupService.getChildrenArrayByLocalName(commentsRoot, 'cm');

			return commentNodes.map((commentNode, index) => {
				const commentId = String(commentNode?.['@_idx'] || commentNode?.['@_id'] || index).trim();
				const authorId = String(commentNode?.['@_authorId'] || '').trim();
				const createdAtRaw = String(commentNode?.['@_dt'] || '').trim();
				const position =
					(commentNode?.['p:pos'] as XmlObject | undefined) ||
					this.xmlLookupService.getChildByLocalName(commentNode, 'pos');
				const xValue = Number.parseInt(String(position?.['@_x'] || ''), 10);
				const yValue = Number.parseInt(String(position?.['@_y'] || ''), 10);

				// Check if comment is resolved/done
				const resolvedToken = String(commentNode?.['@_done'] || commentNode?.['@_resolved'] || '')
					.trim()
					.toLowerCase();
				const resolved = resolvedToken === '1' || resolvedToken === 'true' ? true : undefined;

				return {
					id: commentId.length > 0 ? commentId : String(index),
					text: this.extractCommentText(commentNode),
					author:
						authorId.length > 0
							? this.commentAuthorMap.get(authorId) || `Author ${authorId}`
							: undefined,
					createdAt: createdAtRaw.length > 0 ? createdAtRaw : undefined,
					x: Number.isFinite(xValue)
						? Math.round(xValue / PptxHandlerRuntime.EMU_PER_PX)
						: undefined,
					y: Number.isFinite(yValue)
						? Math.round(yValue / PptxHandlerRuntime.EMU_PER_PX)
						: undefined,
					resolved,
					rawXml: commentNode,
				};
			});
		} catch (error) {
			console.warn('Failed to parse slide comments:', error);
			return [];
		}
	}

	protected async loadCommentAuthors(): Promise<void> {
		const commentAuthorsXml = await this.zip.file('ppt/commentAuthors.xml')?.async('string');
		if (!commentAuthorsXml) {
			return;
		}

		try {
			const commentAuthorsData = this.parser.parse(commentAuthorsXml) as XmlObject;
			const authorRoot = this.xmlLookupService.getChildByLocalName(
				commentAuthorsData,
				'cmAuthorLst',
			);
			this.commentAuthorsRootXml = authorRoot;
			const authors = this.xmlLookupService.getChildrenArrayByLocalName(authorRoot, 'cmAuthor');

			authors.forEach((author, index) => {
				const authorId = String(author?.['@_id'] || index).trim();
				if (authorId.length === 0) {
					return;
				}

				const authorNameRaw = String(
					author?.['@_name'] || author?.['@_initials'] || `Author ${authorId}`,
				).trim();
				const authorName = authorNameRaw.length > 0 ? authorNameRaw : `Author ${authorId}`;
				this.commentAuthorMap.set(authorId, authorName);

				// Preserve full author details for round-trip
				const initialsRaw = String(author?.['@_initials'] || '').trim();
				const lastIdxRaw = Number.parseInt(String(author?.['@_lastIdx'] || '0'), 10);
				const clrIdxRaw = Number.parseInt(String(author?.['@_clrIdx'] || '0'), 10);
				const authorDetail: PptxCommentAuthor = {
					id: authorId,
					name: authorName,
					initials: initialsRaw.length > 0 ? initialsRaw : this.toCommentInitials(authorName),
					lastIdx: Number.isFinite(lastIdxRaw) ? lastIdxRaw : 0,
					clrIdx: Number.isFinite(clrIdxRaw) ? clrIdxRaw : 0,
					rawXml: author,
				};
				this.commentAuthorDetails.set(authorId, authorDetail);
			});
		} catch (error) {
			console.warn('Failed to parse PowerPoint comment authors:', error);
		}
	}

	/** Derive initials from an author name (first letter of up to 2 tokens). */
	private toCommentInitials(authorName: string): string {
		const tokens = authorName
			.split(/\s+/)
			.map((token) => token.trim())
			.filter((token) => token.length > 0);
		if (tokens.length === 0) {
			return 'U';
		}
		return tokens
			.slice(0, 2)
			.map((token) => token[0].toUpperCase())
			.join('');
	}
}
