import type { PptxHandoutMaster, PptxNotesMaster, XmlObject } from '../../types';
import { rememberAuxiliaryMasterUnparsedNodes } from './auxiliary-master-node-cache';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeMasterElements';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Parse every editable element in a notes or handout master shape tree. */
	protected async enrichAuxiliaryMasterElements(
		master: PptxNotesMaster | PptxHandoutMaster | undefined,
		rootTag: 'p:notesMaster' | 'p:handoutMaster',
	): Promise<void> {
		if (!master) {
			return;
		}
		const partPath = master.path;
		const xml = await this.zip.file(partPath)?.async('string');
		if (!xml) {
			return;
		}
		const data = this.parser.parse(xml) as XmlObject;
		const root = data[rootTag] as XmlObject | undefined;
		const cSld = root?.['p:cSld'] as XmlObject | undefined;
		const spTree = cSld?.['p:spTree'] as XmlObject | undefined;
		if (!spTree) {
			master.elements = [];
			return;
		}

		const fileName = partPath.slice(partPath.lastIndexOf('/') + 1);
		const partDirectory = partPath.slice(0, partPath.lastIndexOf('/'));
		await this.loadSlideRelationships(partPath, `${partDirectory}/_rels/${fileName}.rels`);
		master.backgroundImage = await this.extractBackgroundImage(data, partPath, rootTag);
		this.unwrapAlternateContent(spTree as Record<string, unknown>);

		const prefix = rootTag === 'p:notesMaster' ? 'notes-master-' : 'handout-master-';
		master.elements = await this.parseSpTreeChildren(
			spTree as Record<string, unknown>,
			partPath,
			xml,
			'p:spTree',
			prefix,
		);
		this.rememberUnparsedMasterNodes(partPath, spTree, master.elements);
	}

	private rememberUnparsedMasterNodes(
		partPath: string,
		spTree: XmlObject,
		elements: NonNullable<PptxNotesMaster['elements']>,
	): void {
		const parsedNodes = new Set(elements.map((element) => element.rawXml).filter(Boolean));
		const byTag = new Map<string, XmlObject[]>();
		for (const tag of [
			'p:sp',
			'p:pic',
			'p:cxnSp',
			'p:graphicFrame',
			'p:grpSp',
			'p16:model3D',
			'p:contentPart',
		]) {
			const unparsed = (this.ensureArray(spTree[tag]) as XmlObject[]).filter(
				(node) => !parsedNodes.has(node),
			);
			if (unparsed.length > 0) {
				byTag.set(tag, unparsed);
			}
		}
		rememberAuxiliaryMasterUnparsedNodes(this, partPath, byTag);
	}
}
