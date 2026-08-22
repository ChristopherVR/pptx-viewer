/**
 * @fileoverview Shape-tree parsing for the four "template" parts whose
 * artwork the Slide Master view renders and edits: `p:notesMaster`,
 * `p:handoutMaster`, `p:sldMaster` and `p:sldLayout`.
 *
 * Note the difference from {@link PptxHandlerRuntimeMasterElements.getMasterElements}
 * and {@link PptxHandlerRuntimeLayoutElements.getLayoutElementsByPath}: those
 * resolve the artwork a *slide* inherits, so they deliberately skip placeholder
 * shapes (a slide resolves its own placeholders through the inheritance chain)
 * and prefix ids with `master-` / `layout-`. The Slide Master view needs the
 * opposite: the part's own tree exactly as authored, placeholders included,
 * because "Click to edit Master title style" is the thing being edited.
 *
 * Historically only the notes and handout masters were parsed here (the
 * feature landed as "editable auxiliary master elements", fdb32c65), which
 * left `PptxSlideMaster.elements` / `PptxSlideLayout.elements` declared,
 * consumed by all five bindings' Slide Master views, and never written: the
 * Slides tab rendered a bare background on every real deck. The restriction
 * was scope, not design, so the same parser now covers all four root tags.
 */
import type {
	PptxElement,
	PptxHandoutMaster,
	PptxNotesMaster,
	PptxSlideMaster,
	XmlObject,
} from '../../types';
import { rememberAuxiliaryMasterUnparsedNodes } from './auxiliary-master-node-cache';
import { rememberMasterPartBackground } from './master-part-background-cache';
import { rememberMasterPartElementSignature } from './master-part-element-signature';
import { masterPartIdPrefix } from './master-part-tags';
import type { MasterPartRootTag } from './master-part-tags';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeMasterElements';

/** The slice of each master/layout model this parser writes to. */
export interface MasterPartElementHost {
	path: string;
	elements?: PptxElement[];
	backgroundImage?: string;
	/**
	 * Already resolved by the master/layout parser. Read here only so the save
	 * side can tell a chosen colour from a flattened `p:bgRef`.
	 */
	backgroundColor?: string;
}

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/** Parse every editable element in a master or layout shape tree. */
	protected async enrichMasterPartElements(
		part: MasterPartElementHost | undefined,
		rootTag: MasterPartRootTag,
	): Promise<void> {
		if (!part) {
			return;
		}
		const partPath = part.path;
		// Before anything can bail: the save side needs to know which colour the
		// loader resolved for this part, so a `p:bgRef` that was merely painted
		// is not mistaken for a colour the user picked. See
		// {@link module:master-part-background-cache}.
		rememberMasterPartBackground(this, partPath, part.backgroundColor);
		const xml = await this.zip.file(partPath)?.async('string');
		if (!xml) {
			return;
		}
		const data = this.parser.parse(xml) as XmlObject;
		const root = data[rootTag] as XmlObject | undefined;

		// The notes master's own text-list-style defaults (P-H4): reuse the
		// same `CT_TextListStyle` parser the slide-master `p:txStyles` children
		// use, since `p:notesStyle` has the identical `a:defPPr` +
		// `a:lvl1pPr`..`a:lvl9pPr` shape (ECMA-376 SS19.3.1.34). Parsed before
		// the spTree guard below since notesStyle is a sibling of `p:cSld`, not
		// a descendant, and must not be skipped just because the shape tree is
		// empty.
		if (rootTag === 'p:notesMaster') {
			const notesStyle = this.parseTextListStyle(root?.['p:notesStyle'] as XmlObject | undefined);
			if (notesStyle) {
				(part as PptxNotesMaster).notesStyle = notesStyle;
			}
		}

		const cSld = root?.['p:cSld'] as XmlObject | undefined;
		const spTree = cSld?.['p:spTree'] as XmlObject | undefined;
		if (!spTree) {
			part.elements = [];
			return;
		}

		const fileName = partPath.slice(partPath.lastIndexOf('/') + 1);
		const partDirectory = partPath.slice(0, partPath.lastIndexOf('/'));
		if (!this.slideRelsMap.has(partPath)) {
			await this.loadSlideRelationships(partPath, `${partDirectory}/_rels/${fileName}.rels`);
		}
		part.backgroundImage = await this.extractBackgroundImage(data, partPath, rootTag);
		this.unwrapAlternateContent(spTree as Record<string, unknown>);

		// A layout may re-route the colour aliases its own shapes resolve
		// through (`p:clrMapOvr/a:overrideClrMapping`), exactly as
		// getLayoutElementsByPath does for the slide-facing copy.
		const previousClrMapOverride = this.currentSlideClrMapOverride;
		if (rootTag === 'p:sldLayout') {
			const override = this.parseLayoutClrMapOverride(data);
			if (override) {
				this.currentSlideClrMapOverride = override;
			}
		}
		try {
			part.elements = await this.parseSpTreeChildren(
				spTree as Record<string, unknown>,
				partPath,
				xml,
				'p:spTree',
				masterPartIdPrefix(rootTag, partPath),
			);
		} finally {
			this.currentSlideClrMapOverride = previousClrMapOverride;
		}
		rememberMasterPartElementSignature(this, partPath, part.elements);
		this.rememberUnparsedMasterNodes(partPath, spTree, part.elements);
	}

	/**
	 * Populate `elements` on every slide master and on each of its layouts.
	 *
	 * Scheme colours on a master's own shapes must resolve through that
	 * master's colour map and theme, so the active master state is switched
	 * per part and reset to the deck-wide snapshot afterwards.
	 */
	protected async enrichSlideMasterElements(masters: PptxSlideMaster[]): Promise<void> {
		for (const master of masters) {
			try {
				this.applyMasterThemeState(master.path);
				await this.enrichMasterPartElements(master, 'p:sldMaster');
				for (const layout of master.layouts ?? []) {
					await this.enrichMasterPartElements(layout, 'p:sldLayout');
				}
			} catch (e) {
				console.warn(`Failed to parse slide master elements for ${master.path}:`, e);
			}
		}
		this.applyMasterThemeState(undefined);
	}

	/** Parse every editable element in a notes or handout master shape tree. */
	protected async enrichAuxiliaryMasterElements(
		master: PptxNotesMaster | PptxHandoutMaster | undefined,
		rootTag: 'p:notesMaster' | 'p:handoutMaster',
	): Promise<void> {
		await this.enrichMasterPartElements(master, rootTag);
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
