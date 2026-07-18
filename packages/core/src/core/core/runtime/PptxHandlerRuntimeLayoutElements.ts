import { XmlObject, PptxElement } from '../../types';
import { stripParentDirSegments } from '../../utils/strip-parent-dir-segments';
import { xmlAttr, xmlChild, xmlPath } from '../../utils/xml-access';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeAuxiliaryMasterElements';
import type { PlaceholderInfo } from './PptxHandlerRuntimeTypes';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	protected async getLayoutElements(slidePath: string): Promise<PptxElement[]> {
		// Get the slide's relationship file to find the layout
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return [];
		}

		// Find the slideLayout relationship
		let layoutPath: string | undefined;
		for (const [, target] of slideRels.entries()) {
			if (target.includes('slideLayout')) {
				const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
				layoutPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(slideDir, target)
						: `ppt/${stripParentDirSegments(target)}`;
				break;
			}
		}

		if (!layoutPath) {
			return [];
		}

		// Check cache first
		if (this.layoutCache.has(layoutPath)) {
			return this.layoutCache.get(layoutPath)!;
		}

		// Namespace generated element IDs with the owning layout part so that
		// e.g. slideLayout4's first picture doesn't collide with slideLayout7's
		// (indexInType is only unique within a single layout's own spTree).
		const layoutToken =
			layoutPath
				.split('/')
				.pop()
				?.replace(/\.xml$/u, '') ?? layoutPath;

		try {
			const layoutXmlStr = await this.zip.file(layoutPath)?.async('string');
			if (!layoutXmlStr) {
				return [];
			}

			const layoutXmlObj = this.parser.parse(layoutXmlStr);
			this.layoutXmlMap.set(layoutPath, layoutXmlObj as XmlObject);

			// Load layout relationships
			const layoutRelsPath = `${layoutPath.replace('slideLayouts/', 'slideLayouts/_rels/')}.rels`;
			await this.loadSlideRelationships(layoutPath, layoutRelsPath);

			// Apply layout-level colour map override while parsing its elements
			const layoutClrMapOverride = this.parseLayoutClrMapOverride(layoutXmlObj as XmlObject);
			const prevClrMapOverride = this.currentSlideClrMapOverride;
			if (layoutClrMapOverride) {
				this.currentSlideClrMapOverride = layoutClrMapOverride;
			}

			// Parse layout elements - but mark them as from layout (non-editable in basic editor)
			const spTree = layoutXmlObj['p:sldLayout']?.['p:cSld']?.['p:spTree'];
			if (!spTree) {
				this.layoutCache.set(layoutPath, []);
				return [];
			}

			// Unwrap mc:AlternateContent blocks before accessing element arrays
			this.unwrapAlternateContent(spTree as Record<string, unknown>);

			// First pass: extract placeholder defaults from shapes (before
			// document-order iteration) so that the inheritance chain is fully
			// populated regardless of element order.
			const shapes = this.ensureArray(spTree['p:sp']);
			const placeholderShapeIndices = new Set<number>();
			for (let idx = 0; idx < shapes.length; idx++) {
				const shape = shapes[idx];
				const ph = xmlPath(shape, 'p:nvSpPr', 'p:nvPr', 'p:ph');
				if (ph) {
					placeholderShapeIndices.add(idx);
					const phDefaults = this.extractPlaceholderDefaultsFromShape(shape as XmlObject);
					if (phDefaults) {
						if (!this.layoutPlaceholderDefaultsCache.has(layoutPath)) {
							this.layoutPlaceholderDefaultsCache.set(layoutPath, new Map());
						}
						const phInfo: PlaceholderInfo = {
							type: phDefaults.type,
							idx: phDefaults.idx !== undefined ? String(phDefaults.idx) : undefined,
						};
						const key = this.buildPlaceholderDefaultsKey(phInfo);
						this.layoutPlaceholderDefaultsCache.get(layoutPath)!.set(key, phDefaults);
					}
				}
			}

			// Parse elements in document order (preserving z-order)
			const childOrder = this.extractSpTreeChildOrder(
				layoutXmlStr,
				spTree as Record<string, unknown>,
				'p:spTree',
			);
			const elements: PptxElement[] = [];

			for (const entry of childOrder) {
				if (entry.tag === 'p:sp') {
					// Skip placeholder shapes — they were already processed above
					if (placeholderShapeIndices.has(entry.indexInType)) {
						continue;
					}
					const shape = shapes[entry.indexInType];
					if (!shape) {
						continue;
					}

					const spPr = xmlChild(shape, 'p:spPr');
					let element: PptxElement | null = null;

					if (spPr && xmlChild(spPr, 'a:blipFill')) {
						element = await this.parseShapeWithImageFill(
							shape,
							`layout-shape-img-${layoutToken}-${entry.indexInType}`,
							layoutPath,
						);
					} else {
						element = this.parseShape(
							shape,
							`layout-shape-${layoutToken}-${entry.indexInType}`,
							layoutPath,
						);
					}

					if (element) {
						element.id = `layout-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:pic') {
					const pics = this.ensureArray(spTree['p:pic']);
					const pic = pics[entry.indexInType];
					if (!pic) {
						continue;
					}
					const element = await this.parsePicture(
						pic,
						`layout-pic-${layoutToken}-${entry.indexInType}`,
						layoutPath,
					);
					if (element) {
						element.id = `layout-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:graphicFrame') {
					const frames = this.ensureArray(spTree['p:graphicFrame']);
					const frame = frames[entry.indexInType];
					if (!frame) {
						continue;
					}
					const element = this.parseGraphicFrame(
						frame,
						`layout-frame-${layoutToken}-${entry.indexInType}`,
						layoutPath,
					);
					if (element) {
						element.id = `layout-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:cxnSp') {
					// Layouts commonly use connectors for divider lines. They are
					// renderable layout artwork, not placeholder content.
					const connectors = this.ensureArray(spTree['p:cxnSp']);
					const connector = connectors[entry.indexInType] as XmlObject | undefined;
					if (!connector) {
						continue;
					}
					const element = this.parseConnector(
						connector,
						`layout-conn-${layoutToken}-${entry.indexInType}`,
						layoutPath,
					);
					if (element) {
						element.id = `layout-${element.id}`;
						elements.push(element);
					}
				} else if (entry.tag === 'p:grpSp') {
					// Themed decks often place ALL their decorative background
					// artwork inside a top-level group on the layout (e.g. the
					// "Balloons" family). Skipping groups here dropped the entire
					// themed background; parse them like slide groups instead.
					const groups = this.ensureArray(spTree['p:grpSp']);
					const group = groups[entry.indexInType] as XmlObject | undefined;
					if (!group) {
						continue;
					}
					const element = await this.parseGroupShapeAsGroup(
						group,
						`layout-group-${layoutToken}-${entry.indexInType}`,
						layoutPath,
					);
					if (element) {
						element.id = `layout-${element.id}`;
						elements.push(element);
					}
				}
				// Other element types (p:contentPart) are uncommon in layouts
				// but could be added here if needed.
			}

			// Check whether master shapes should be shown on this layout
			// (p:sldLayout/@showMasterSp — defaults to true when absent)
			const layoutShowMasterSp = xmlAttr(
				xmlChild(layoutXmlObj as XmlObject, 'p:sldLayout'),
				'showMasterSp',
			);
			const showMasterSp =
				layoutShowMasterSp === undefined ||
				(layoutShowMasterSp.trim().toLowerCase() !== '0' &&
					layoutShowMasterSp.trim().toLowerCase() !== 'false');

			// Get master elements while the layout's clrMapOvr is still active,
			// so master shapes drawn through this layout resolve scheme colours
			// against the layout's override (Phase 2 Stream B / C-H5).
			const masterElements = showMasterSp ? await this.getMasterElements(layoutPath) : [];

			// Restore colour map override only after master shapes have been parsed.
			this.currentSlideClrMapOverride = prevClrMapOverride;

			const allElements = [...masterElements, ...elements];

			this.layoutCache.set(layoutPath, allElements);
			return allElements;
		} catch (e) {
			console.warn('Failed to parse layout:', e);
			return [];
		}
	}
}
