import type { XMLBuilder } from 'fast-xml-parser';
import type JSZip from 'jszip';

import type { PptxSlide } from '../../types';
import type { OoxmlConformanceClass } from '../../utils';
import type { PptxSaveState } from './PptxSaveSessionBuilder';
import type {
	IPptxSlideRelationshipRegistry,
	PptxSlideCommentRelationshipInfo,
} from './PptxSlideRelationshipRegistry';
import type { IPptxSlideCommentsXmlFactory } from './xml';

export interface PptxSlideCommentPartWriterInput {
	slide: PptxSlide;
	saveState: PptxSaveState;
	existingCommentRelationship: PptxSlideCommentRelationshipInfo;
	relationshipRegistry: IPptxSlideRelationshipRegistry;
	slideCommentRelationshipType: string;
	zip: JSZip;
	xmlBuilder: XMLBuilder;
	slideCommentsXmlFactory: IPptxSlideCommentsXmlFactory;
	resolvePartPath: (slidePath: string, relationshipTarget: string) => string;
	conformance: OoxmlConformanceClass;
}

export interface IPptxSlideCommentPartWriter {
	writeComments(init: PptxSlideCommentPartWriterInput): void;
}

export class PptxSlideCommentPartWriter implements IPptxSlideCommentPartWriter {
	public writeComments(init: PptxSlideCommentPartWriterInput): void {
		const sanitizedComments = (init.slide.comments || [])
			.filter((comment) => comment.format !== 'modern')
			.map((comment) => ({
				...comment,
				text: String(comment.text || '').trim(),
			}))
			.filter((comment) => comment.text.length > 0);
		if (sanitizedComments.length === 0) {
			return;
		}

		const commentRelationshipId =
			init.existingCommentRelationship.relationshipId.length > 0
				? init.existingCommentRelationship.relationshipId
				: init.relationshipRegistry.nextRelationshipId();
		let commentTarget = init.existingCommentRelationship.target;
		if (commentTarget.length === 0) {
			commentTarget = init.saveState.toSlideCommentTarget(init.saveState.nextCommentPath());
		} else if (commentTarget.startsWith('comments/')) {
			commentTarget = `../${commentTarget}`;
		}

		const resolvedCommentPartPath = init.resolvePartPath(init.slide.id, commentTarget);
		init.saveState.activateCommentPath(resolvedCommentPartPath);
		init.zip.file(
			resolvedCommentPartPath,
			init.xmlBuilder.build(
				init.slideCommentsXmlFactory.createXmlElement({
					slideComments: sanitizedComments,
					saveState: init.saveState,
					conformance: init.conformance,
				}),
			),
		);
		init.relationshipRegistry.upsertRelationship(
			commentRelationshipId,
			init.slideCommentRelationshipType,
			commentTarget,
		);
	}
}
