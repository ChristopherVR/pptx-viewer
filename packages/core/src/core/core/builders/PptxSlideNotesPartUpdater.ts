import type { XMLBuilder, XMLParser } from 'fast-xml-parser';
import type JSZip from 'jszip';

import type { CompatibilityWarningInput } from '../../services';
import type { PptxSlide, XmlObject } from '../../types';
import type { IPptxSlideRelationshipRegistry } from './PptxSlideRelationshipRegistry';

export interface PptxSlideNotesPartUpdaterInput {
	slide: PptxSlide;
	relationshipRegistry: IPptxSlideRelationshipRegistry;
	slideNotesRelationshipType: string;
	zip: JSZip;
	parser: XMLParser;
	xmlBuilder: XMLBuilder;
	resolvePartPath: (slidePath: string, relationshipTarget: string) => string;
	updateNotesXmlText: (
		notesXmlObject: XmlObject,
		notesText: string,
		notesSegments?: PptxSlide['notesSegments'],
	) => boolean;
	compatibilityReporter: {
		reportWarning: (warning: CompatibilityWarningInput) => void;
	};
}

export interface IPptxSlideNotesPartUpdater {
	updateNotesPart(init: PptxSlideNotesPartUpdaterInput): Promise<void>;
}

export class PptxSlideNotesPartUpdater implements IPptxSlideNotesPartUpdater {
	public async updateNotesPart(init: PptxSlideNotesPartUpdaterInput): Promise<void> {
		if (
			init.slide.notes === undefined &&
			(!init.slide.notesSegments || init.slide.notesSegments.length === 0)
		) {
			return;
		}

		const notesRelationship = init.relationshipRegistry.findFirstByTypeOrTargetIncludes(
			init.slideNotesRelationshipType,
			'notesslide',
		);
		if (!notesRelationship) {
			await this.createNotesPart(init);
			return;
		}

		const notesTarget = String(notesRelationship['@_Target'] || '').trim();
		if (notesTarget.length === 0) {
			return;
		}

		const notesPath = init.resolvePartPath(init.slide.id, notesTarget);
		const notesXml = await init.zip.file(notesPath)?.async('string');
		if (!notesXml) {
			this.reportMissingNotesPart(init, notesPath);
			return;
		}

		const notesXmlObject = init.parser.parse(notesXml) as XmlObject;
		const didUpdate = init.updateNotesXmlText(
			notesXmlObject,
			init.slide.notes ?? '',
			init.slide.notesSegments,
		);
		if (!didUpdate) {
			this.reportSkippedNotesUpdate(init);
			return;
		}

		init.zip.file(notesPath, init.xmlBuilder.build(notesXmlObject));
	}

	private async createNotesPart(init: PptxSlideNotesPartUpdaterInput): Promise<void> {
		const notesMasterPath = Object.keys(init.zip.files).find((path) =>
			/^ppt\/notesMasters\/notesMaster\d+\.xml$/u.test(path),
		);
		if (!notesMasterPath) {
			this.reportMissingNotesRelationship(init);
			return;
		}
		const notesPath = this.nextNotesPartPath(init.zip);
		const fileName = notesPath.slice(notesPath.lastIndexOf('/') + 1);
		const strict = init.slideNotesRelationshipType.startsWith('http://purl.oclc.org/');
		const relationshipBase = strict
			? 'http://purl.oclc.org/ooxml/officeDocument/relationships/'
			: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
		const relationshipId = init.relationshipRegistry.nextRelationshipId();
		init.relationshipRegistry.upsertRelationship(
			relationshipId,
			init.slideNotesRelationshipType,
			`../notesSlides/${fileName}`,
		);
		init.zip.file(notesPath, init.xmlBuilder.build(this.buildNotesSlide(init.slide, strict)));
		init.zip.file(
			`ppt/notesSlides/_rels/${fileName}.rels`,
			init.xmlBuilder.build({
				Relationships: {
					'@_xmlns': 'http://schemas.openxmlformats.org/package/2006/relationships',
					Relationship: [
						{
							'@_Id': 'rId1',
							'@_Type': `${relationshipBase}notesMaster`,
							'@_Target': `../notesMasters/${notesMasterPath.slice(notesMasterPath.lastIndexOf('/') + 1)}`,
						},
						{
							'@_Id': 'rId2',
							'@_Type': `${relationshipBase}slide`,
							'@_Target': `../slides/${init.slide.id.slice(init.slide.id.lastIndexOf('/') + 1)}`,
						},
					],
				},
			}),
		);
		await this.addNotesContentType(init, notesPath);
	}

	private nextNotesPartPath(zip: JSZip): string {
		const used = new Set<number>();
		for (const path of Object.keys(zip.files)) {
			const index = /^ppt\/notesSlides\/notesSlide(?<index>\d+)\.xml$/u.exec(path)?.groups?.index;
			if (index) {
				used.add(Number.parseInt(index, 10));
			}
		}
		let index = 1;
		while (used.has(index)) {
			index += 1;
		}
		return `ppt/notesSlides/notesSlide${index}.xml`;
	}

	private buildNotesSlide(slide: PptxSlide, strict: boolean): XmlObject {
		const notesText =
			slide.notes ??
			slide.notesSegments?.map((segment) => String(segment.text ?? '')).join('') ??
			'';
		const p = strict
			? 'http://purl.oclc.org/ooxml/presentationml/main'
			: 'http://schemas.openxmlformats.org/presentationml/2006/main';
		const a = strict
			? 'http://purl.oclc.org/ooxml/drawingml/main'
			: 'http://schemas.openxmlformats.org/drawingml/2006/main';
		const r = strict
			? 'http://purl.oclc.org/ooxml/officeDocument/relationships'
			: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
		return {
			'p:notes': {
				'@_xmlns:a': a,
				'@_xmlns:r': r,
				'@_xmlns:p': p,
				'p:cSld': {
					'p:spTree': {
						'p:nvGrpSpPr': {
							'p:cNvPr': { '@_id': '1', '@_name': '' },
							'p:cNvGrpSpPr': {},
							'p:nvPr': {},
						},
						'p:grpSpPr': {
							'a:xfrm': {
								'a:off': { '@_x': '0', '@_y': '0' },
								'a:ext': { '@_cx': '0', '@_cy': '0' },
								'a:chOff': { '@_x': '0', '@_y': '0' },
								'a:chExt': { '@_cx': '0', '@_cy': '0' },
							},
						},
						'p:sp': {
							'p:nvSpPr': {
								'p:cNvPr': { '@_id': '2', '@_name': 'Notes Placeholder' },
								'p:cNvSpPr': {},
								'p:nvPr': { 'p:ph': { '@_type': 'body', '@_idx': '1' } },
							},
							'p:spPr': {},
							'p:txBody': {
								'a:bodyPr': {},
								'a:lstStyle': {},
								'a:p': {
									'a:r': { 'a:rPr': { '@_lang': 'en-US' }, 'a:t': notesText },
									'a:endParaRPr': { '@_lang': 'en-US' },
								},
							},
						},
					},
				},
				'p:clrMapOvr': { 'a:masterClrMapping': {} },
			},
		};
	}

	private async addNotesContentType(
		init: PptxSlideNotesPartUpdaterInput,
		notesPath: string,
	): Promise<void> {
		const xml = await init.zip.file('[Content_Types].xml')?.async('string');
		if (!xml) {
			return;
		}
		const data = init.parser.parse(xml) as XmlObject;
		const root = (data['Types'] ?? {}) as XmlObject;
		const raw = root['Override'];
		const overrides = Array.isArray(raw) ? (raw as XmlObject[]) : raw ? [raw as XmlObject] : [];
		overrides.push({
			'@_PartName': `/${notesPath}`,
			'@_ContentType':
				'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml',
		});
		root['Override'] = overrides;
		data['Types'] = root;
		init.zip.file('[Content_Types].xml', init.xmlBuilder.build(data));
	}

	private reportMissingNotesRelationship(init: PptxSlideNotesPartUpdaterInput): void {
		init.compatibilityReporter.reportWarning({
			code: 'SAVE_NOTES_RELATIONSHIP_MISSING',
			message:
				'Slide notes were edited, but the slide has no notes relationship. Notes update was skipped.',
			scope: 'save',
			slideId: init.slide.id,
		});
	}

	private reportMissingNotesPart(init: PptxSlideNotesPartUpdaterInput, notesPath: string): void {
		init.compatibilityReporter.reportWarning({
			code: 'SAVE_NOTES_PART_MISSING',
			message:
				'Speaker notes relationship exists but the notes part is missing. Notes update was skipped.',
			scope: 'save',
			slideId: init.slide.id,
			xmlPath: notesPath,
		});
	}

	private reportSkippedNotesUpdate(init: PptxSlideNotesPartUpdaterInput): void {
		init.compatibilityReporter.reportWarning({
			code: 'SAVE_NOTES_UPDATE_SKIPPED',
			message:
				'Speaker notes were present but no editable notes body was found. Notes were left unchanged.',
			scope: 'save',
			slideId: init.slide.id,
		});
	}
}
