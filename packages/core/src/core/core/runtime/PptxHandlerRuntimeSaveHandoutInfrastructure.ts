import type { PptxHandoutMaster, XmlObject } from '../../types';
import type { PptxSaveConstants } from '../factories';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeSaveNotesInfrastructure';

const HANDOUT_MASTER_CONTENT_TYPE =
	'application/vnd.openxmlformats-officedocument.presentationml.handoutMaster+xml';

function asArray(value: unknown): XmlObject[] {
	return Array.isArray(value) ? (value as XmlObject[]) : value ? [value as XmlObject] : [];
}

function relationshipBase(strict: boolean): string {
	return strict
		? 'http://purl.oclc.org/ooxml/officeDocument/relationships/'
		: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
}

function presentationNamespace(strict: boolean): string {
	return strict
		? 'http://purl.oclc.org/ooxml/presentationml/main'
		: 'http://schemas.openxmlformats.org/presentationml/2006/main';
}

function drawingNamespace(strict: boolean): string {
	return strict
		? 'http://purl.oclc.org/ooxml/drawingml/main'
		: 'http://schemas.openxmlformats.org/drawingml/2006/main';
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Ensure an authored handout master has complete OPC package infrastructure. */
	protected async ensureHandoutMasterInfrastructure(
		handoutMaster: PptxHandoutMaster | undefined,
		constants: PptxSaveConstants,
	): Promise<void> {
		if (!handoutMaster || !this.presentationData) {
			return;
		}

		const strict = constants.conformance === 'strict';
		const masterPath = handoutMaster.path;
		if (!this.zip.file(masterPath)) {
			this.zip.file(masterPath, this.builder.build(this.buildDefaultHandoutMaster(strict)));
		}
		await this.ensureHandoutThemeRelationship(masterPath, constants, strict);

		const relsPath = 'ppt/_rels/presentation.xml.rels';
		const relsXml = await this.zip.file(relsPath)?.async('string');
		if (!relsXml) {
			return;
		}
		const relsData = this.parser.parse(relsXml) as XmlObject;
		const relsRoot = (relsData['Relationships'] ?? {}) as XmlObject;
		const relationships = asArray(relsRoot['Relationship']);
		const target = masterPath.startsWith('ppt/') ? masterPath.slice(4) : masterPath;
		let relationship = relationships.find(
			(rel) =>
				String(rel['@_Type'] ?? '').endsWith('/handoutMaster') &&
				String(rel['@_Target'] ?? '').replace(/^\.\//u, '') === target,
		);
		if (!relationship) {
			const usedIds = new Set(relationships.map((rel) => String(rel['@_Id'] ?? '')));
			let index = 1;
			while (usedIds.has(`rId${index}`)) {
				index += 1;
			}
			relationship = {
				'@_Id': `rId${index}`,
				'@_Type': `${relationshipBase(strict)}handoutMaster`,
				'@_Target': target,
			};
			relationships.push(relationship);
			relsRoot['Relationship'] = relationships;
			relsData['Relationships'] = relsRoot;
			this.zip.file(relsPath, this.builder.build(relsData));
		}

		this.ensurePresentationHandoutReference(String(relationship['@_Id']));
		await this.addHandoutContentTypeOverride(masterPath);
	}

	private async ensureHandoutThemeRelationship(
		masterPath: string,
		constants: PptxSaveConstants,
		strict: boolean,
	): Promise<void> {
		const fileName = masterPath.slice(masterPath.lastIndexOf('/') + 1);
		const directory = masterPath.slice(0, masterPath.lastIndexOf('/'));
		const relsPath = `${directory}/_rels/${fileName}.rels`;
		const themePath =
			Object.keys(this.zip.files).find((path) => /^ppt\/theme\/theme\d+\.xml$/u.test(path)) ??
			'ppt/theme/theme1.xml';
		const existingXml = await this.zip.file(relsPath)?.async('string');
		if (existingXml) {
			const data = this.parser.parse(existingXml) as XmlObject;
			const root = (data['Relationships'] ?? {}) as XmlObject;
			const relationships = asArray(root['Relationship']);
			if (relationships.some((rel) => String(rel['@_Type'] ?? '').endsWith('/theme'))) {
				return;
			}
			const usedIds = new Set(relationships.map((rel) => String(rel['@_Id'] ?? '')));
			let index = 1;
			while (usedIds.has(`rId${index}`)) {
				index += 1;
			}
			relationships.push({
				'@_Id': `rId${index}`,
				'@_Type': `${relationshipBase(strict)}theme`,
				'@_Target': `../theme/${themePath.slice(themePath.lastIndexOf('/') + 1)}`,
			});
			root['Relationship'] = relationships;
			data['Relationships'] = root;
			this.zip.file(relsPath, this.builder.build(data));
			return;
		}
		this.zip.file(
			relsPath,
			this.builder.build({
				Relationships: {
					'@_xmlns': constants.relationshipsNamespace,
					Relationship: {
						'@_Id': 'rId1',
						'@_Type': `${relationshipBase(strict)}theme`,
						'@_Target': `../theme/${themePath.slice(themePath.lastIndexOf('/') + 1)}`,
					},
				},
			}),
		);
	}

	private ensurePresentationHandoutReference(relationshipId: string): void {
		const presentation = this.presentationData?.['p:presentation'] as XmlObject | undefined;
		if (!presentation) {
			return;
		}
		const existing = presentation['p:handoutMasterIdLst'] as XmlObject | undefined;
		if (existing) {
			existing['p:handoutMasterId'] = { '@_r:id': relationshipId };
			return;
		}
		const reordered: XmlObject = {};
		let inserted = false;
		for (const [key, value] of Object.entries(presentation)) {
			if (!inserted && key === 'p:sldIdLst') {
				reordered['p:handoutMasterIdLst'] = {
					'p:handoutMasterId': { '@_r:id': relationshipId },
				};
				inserted = true;
			}
			reordered[key] = value;
		}
		if (!inserted) {
			reordered['p:handoutMasterIdLst'] = {
				'p:handoutMasterId': { '@_r:id': relationshipId },
			};
		}
		for (const key of Object.keys(presentation)) {
			delete presentation[key];
		}
		Object.assign(presentation, reordered);
	}

	private buildDefaultHandoutMaster(strict: boolean): XmlObject {
		return {
			'p:handoutMaster': {
				'@_xmlns:a': drawingNamespace(strict),
				'@_xmlns:r': relationshipBase(strict).slice(0, -1),
				'@_xmlns:p': presentationNamespace(strict),
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
					},
				},
				'p:clrMap': {
					'@_accent1': 'accent1',
					'@_accent2': 'accent2',
					'@_accent3': 'accent3',
					'@_accent4': 'accent4',
					'@_accent5': 'accent5',
					'@_accent6': 'accent6',
					'@_bg1': 'lt1',
					'@_bg2': 'lt2',
					'@_folHlink': 'folHlink',
					'@_hlink': 'hlink',
					'@_tx1': 'dk1',
					'@_tx2': 'dk2',
				},
			},
		};
	}

	private async addHandoutContentTypeOverride(masterPath: string): Promise<void> {
		const xml = await this.zip.file('[Content_Types].xml')?.async('string');
		if (!xml) {
			return;
		}
		const data = this.parser.parse(xml) as XmlObject;
		const root = (data['Types'] ?? {}) as XmlObject;
		const overrides = asArray(root['Override']);
		const partName = `/${masterPath}`;
		if (!overrides.some((entry) => entry['@_PartName'] === partName)) {
			overrides.push({ '@_PartName': partName, '@_ContentType': HANDOUT_MASTER_CONTENT_TYPE });
		}
		root['Override'] = overrides;
		data['Types'] = root;
		this.zip.file('[Content_Types].xml', this.builder.build(data));
	}
}
