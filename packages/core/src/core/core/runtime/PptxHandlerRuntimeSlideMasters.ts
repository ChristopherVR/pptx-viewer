import { XmlObject } from '../../types';
import type {
	PptxSlideMaster,
	PptxSlideLayout,
	PptxCustomShow,
	PptxHandoutMaster,
	PptxNotesMaster,
} from '../../types';
import { parseCustomShows } from '../../utils/presentation-collections';
import { xmlAttr, xmlChild, xmlPath } from '../../utils/xml-access';
import { parseMasterColorMap } from './master-color-map';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeDocProperties';
import { parseHeaderFooterFlags } from './PptxHandlerRuntimeMasterElements';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Parse background colour from a `p:bg` node.
	 */
	protected parseBackgroundColor(bg: XmlObject | undefined): string | undefined {
		if (!bg) {
			return undefined;
		}
		const bgPr = xmlChild(bg, 'p:bgPr');
		if (bgPr) {
			return this.parseColor(xmlChild(bgPr, 'a:solidFill'));
		}
		const bgRef = xmlChild(bg, 'p:bgRef');
		if (bgRef) {
			return this.parseColor(bgRef);
		}
		return undefined;
	}

	/**
	 * Extract placeholder type+idx from all shapes in a shape tree.
	 */
	protected extractPlaceholderList(
		spTree: XmlObject | undefined,
	): Array<{ type: string; idx?: string }> {
		if (!spTree) {
			return [];
		}
		const shapes = this.ensureArray(spTree['p:sp']);
		const result: Array<{ type: string; idx?: string }> = [];
		for (const sp of shapes) {
			const ph = xmlPath(sp, 'p:nvSpPr', 'p:nvPr', 'p:ph');
			if (!ph) {
				continue;
			}
			const type = (xmlAttr(ph, 'type') ?? 'body').trim();
			const idx = xmlAttr(ph, 'idx');
			result.push({ type, idx });
		}
		return result;
	}

	/**
	 * Allowed top-level OPC archive directories (Load M1).
	 * After path resolution, the first segment must be one of these or the
	 * path is rejected as a traversal attempt. PPTX archives only ever
	 * legitimately reference parts under these roots.
	 */
	private static readonly ALLOWED_PATH_ROOTS: ReadonlySet<string> = new Set([
		'ppt',
		'customXml',
		'docProps',
		'_rels',
	]);

	protected resolvePath(base: string, relative: string): string {
		const baseParts = base.split('/').filter(Boolean);
		const relParts = relative.split('/');

		// Remove filename from base if present
		if (baseParts.length > 0 && !base.endsWith('/')) {
			baseParts.pop();
		}

		for (const part of relParts) {
			if (part === '..') {
				// Load M1: reject paths that traverse above the archive root.
				// Without this check, `../../../etc/passwd`-style targets
				// would resolve to whatever happens to be left after popping
				// off the empty array. Returning '' makes downstream
				// `zip.file('')` lookups fail safely.
				if (baseParts.length === 0) {
					return '';
				}
				baseParts.pop();
			} else if (part !== '.') {
				baseParts.push(part);
			}
		}

		const resolved = baseParts.join('/');
		if (resolved.length === 0) {
			return '';
		}

		// Load M1: enforce allowed-roots prefix. Any first segment outside
		// the OPC-defined directories is treated as an escape attempt.
		const firstSegment = baseParts[0];
		if (!PptxHandlerRuntime.ALLOWED_PATH_ROOTS.has(firstSegment)) {
			return '';
		}

		return resolved;
	}

	protected resolveImagePath(slidePath: string, target: string): string {
		const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
		const resolved = target.startsWith('..')
			? this.resolvePath(slideDir, target)
			: target.startsWith('/')
				? target.substring(1)
				: slideDir + target;

		// Load M1: validate the post-resolution first segment is one of the
		// permitted OPC roots. `resolvePath` already does this for the `..`
		// branch, so we only need to check the other two.
		if (resolved.length === 0) {
			return '';
		}
		const firstSlash = resolved.indexOf('/');
		const firstSegment = firstSlash === -1 ? resolved : resolved.substring(0, firstSlash);
		if (!PptxHandlerRuntime.ALLOWED_PATH_ROOTS.has(firstSegment)) {
			return '';
		}
		return resolved;
	}

	/**
	 * Parse all slide masters into structured PptxSlideMaster objects.
	 */
	protected async parseSlideMasters(): Promise<PptxSlideMaster[]> {
		const results: PptxSlideMaster[] = [];
		try {
			const masterFiles = this.zip.file(/^ppt\/slideMasters\/slideMaster\d+\.xml$/);
			if (!masterFiles || masterFiles.length === 0) {
				return results;
			}

			for (const file of masterFiles) {
				const path = file.name;
				const xml = await file.async('string');
				const data = this.parser.parse(xml) as XmlObject;
				const sldMaster = data?.['p:sldMaster'] as XmlObject | undefined;
				if (!sldMaster) {
					continue;
				}

				// Cache the parsed master XML so the save-side master writer
				// can mutate it in place. Without this seed, layouts/masters
				// that were never rendered (no slide referenced them) would
				// not have an XmlObject available at save time and the
				// passthrough flush would skip them.
				if (!this.masterXmlMap.has(path)) {
					this.masterXmlMap.set(path, data);
				}

				// Background
				const bg = (sldMaster['p:cSld'] as XmlObject | undefined)?.['p:bg'] as
					| XmlObject
					| undefined;
				const backgroundColor = this.parseBackgroundColor(bg);

				// Placeholders
				const spTree = (sldMaster['p:cSld'] as XmlObject | undefined)?.['p:spTree'] as
					| XmlObject
					| undefined;
				const placeholders = this.extractPlaceholderList(spTree);

				// Theme reference (from relationship)
				let themePath: string | undefined;
				const relsPath = path.replace(
					/ppt\/slideMasters\/(slideMaster\d+)\.xml/,
					'ppt/slideMasters/_rels/$1.xml.rels',
				);
				const relsFile = this.zip.file(relsPath);
				if (relsFile) {
					const relsXml = await relsFile.async('string');
					const relsData = this.parser.parse(relsXml) as XmlObject;
					const rels = this.ensureArray(
						xmlChild(relsData, 'Relationships')?.['Relationship'],
					) as XmlObject[];
					for (const rel of rels) {
						const relType = String(rel['@_Type'] || '');
						if (relType.includes('/theme')) {
							themePath = this.resolveImagePath(path, String(rel['@_Target'] || ''));
							break;
						}
					}
				}

				// Layouts associated with this master
				const layoutPaths: string[] = [];
				if (relsFile) {
					const relsXml = await relsFile.async('string');
					const relsData = this.parser.parse(relsXml) as XmlObject;
					const rels = this.ensureArray(
						xmlChild(relsData, 'Relationships')?.['Relationship'],
					) as XmlObject[];
					for (const rel of rels) {
						const relType = String(rel['@_Type'] || '');
						if (relType.includes('/slideLayout')) {
							layoutPaths.push(this.resolveImagePath(path, String(rel['@_Target'] || '')));
						}
					}
				}

				// Parse layout attributes
				const layouts: PptxSlideLayout[] = [];
				for (const lp of layoutPaths) {
					const layout = await this.parseSlideLayoutAttributes(lp);
					if (layout) {
						layouts.push(layout);
					}
				}

				results.push({
					path,
					backgroundColor,
					themePath,
					layoutPaths: layoutPaths.length > 0 ? layoutPaths : undefined,
					layouts: layouts.length > 0 ? layouts : undefined,
					placeholders: placeholders.length > 0 ? placeholders : undefined,
				});
			}
		} catch (e) {
			console.warn('Failed to parse slide masters:', e);
		}
		return results;
	}

	/**
	 * Parse the handout master from `ppt/handoutMasters/handoutMaster1.xml`.
	 */
	protected async parseHandoutMaster(): Promise<PptxHandoutMaster | undefined> {
		try {
			const files = this.zip.file(/^ppt\/handoutMasters\/handoutMaster\d+\.xml$/);
			if (!files || files.length === 0) {
				return undefined;
			}

			const path = files[0].name;
			const xml = await files[0].async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const master = data?.['p:handoutMaster'] as XmlObject | undefined;
			if (!master) {
				return undefined;
			}

			const bg = xmlPath(master, 'p:cSld', 'p:bg');
			const bgColor = this.parseBackgroundColor(bg);

			const spTree = xmlPath(master, 'p:cSld', 'p:spTree');
			const placeholders = this.extractPlaceholderList(spTree);

			const result: PptxHandoutMaster = { path, backgroundColor: bgColor, placeholders };
			result.clrMap = parseMasterColorMap(master['p:clrMap'] as XmlObject | undefined);
			const hf = parseHeaderFooterFlags(master['p:hf'] as XmlObject | undefined);
			if (hf) {
				result.headerFooter = hf;
			}
			return result;
		} catch (e) {
			console.warn('Failed to parse handout master:', e);
			return undefined;
		}
	}

	/**
	 * Parse the notes master from `ppt/notesMasters/notesMaster1.xml`.
	 */
	protected async parseNotesMaster(): Promise<PptxNotesMaster | undefined> {
		try {
			const files = this.zip.file(/^ppt\/notesMasters\/notesMaster\d+\.xml$/);
			if (!files || files.length === 0) {
				return undefined;
			}

			const path = files[0].name;
			const xml = await files[0].async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const master = data?.['p:notesMaster'] as XmlObject | undefined;
			if (!master) {
				return undefined;
			}

			const bg = xmlPath(master, 'p:cSld', 'p:bg');
			const bgColor = this.parseBackgroundColor(bg);

			const spTree = xmlPath(master, 'p:cSld', 'p:spTree');
			const placeholders = this.extractPlaceholderList(spTree);

			const result: PptxNotesMaster = { path, backgroundColor: bgColor, placeholders };
			result.clrMap = parseMasterColorMap(master['p:clrMap'] as XmlObject | undefined);
			const hf = parseHeaderFooterFlags(master['p:hf'] as XmlObject | undefined);
			if (hf) {
				result.headerFooter = hf;
			}
			return result;
		} catch (e) {
			console.warn('Failed to parse notes master:', e);
			return undefined;
		}
	}

	/**
	 * Parse attributes and metadata from a single slide layout XML file.
	 */
	private async parseSlideLayoutAttributes(
		layoutPath: string,
	): Promise<PptxSlideLayout | undefined> {
		try {
			const layoutFile = this.zip.file(layoutPath);
			if (!layoutFile) {
				return undefined;
			}
			const xml = await layoutFile.async('string');
			const data = this.parser.parse(xml) as XmlObject;
			const sldLayout = data?.['p:sldLayout'] as XmlObject | undefined;
			if (!sldLayout) {
				return undefined;
			}

			// Cache the parsed layout XML so the save-side layout writer can
			// mutate it in place without reloading the part from the ZIP. The
			// save pipeline already flushes layoutXmlMap entries verbatim, so
			// caching here also makes raw-XML passthrough available for
			// layouts that have not been mutated.
			if (!this.layoutXmlMap.has(layoutPath)) {
				this.layoutXmlMap.set(layoutPath, data);
			}

			const layout: PptxSlideLayout = { path: layoutPath };

			// Name from p:cSld/@name
			const cSldName = (xmlAttr(xmlChild(sldLayout, 'p:cSld'), 'name') ?? '').trim();
			if (cSldName) {
				layout.name = cSldName;
			}

			// Layout-level attributes
			const matchingName = String(sldLayout['@_matchingName'] || '').trim();
			if (matchingName) {
				layout.matchingName = matchingName;
			}

			const preserve = sldLayout['@_preserve'];
			if (preserve !== undefined) {
				const pVal = String(preserve).trim().toLowerCase();
				layout.preserve = pVal === '1' || pVal === 'true';
			}

			const showMasterPhAnim = sldLayout['@_showMasterPhAnim'];
			if (showMasterPhAnim !== undefined) {
				const sVal = String(showMasterPhAnim).trim().toLowerCase();
				layout.showMasterPhAnim = sVal !== '0' && sVal !== 'false';
			}

			const userDrawn = sldLayout['@_userDrawn'];
			if (userDrawn !== undefined) {
				const uVal = String(userDrawn).trim().toLowerCase();
				layout.userDrawn = uVal === '1' || uVal === 'true';
			}

			const hf = parseHeaderFooterFlags(sldLayout['p:hf'] as XmlObject | undefined);
			if (hf) {
				layout.headerFooter = hf;
			}

			// Colour map override (inline parse — parseClrMapOverrideNode is further in chain)
			const clrMapOvr = sldLayout['p:clrMapOvr'] as XmlObject | undefined;
			if (clrMapOvr && clrMapOvr['a:masterClrMapping'] === undefined) {
				const overrideNode = clrMapOvr['a:overrideClrMapping'] as XmlObject | undefined;
				if (overrideNode) {
					const aliasKeys = [
						'bg1',
						'tx1',
						'bg2',
						'tx2',
						'accent1',
						'accent2',
						'accent3',
						'accent4',
						'accent5',
						'accent6',
						'hlink',
						'folHlink',
					];
					const overrideMap: Record<string, string> = {};
					for (const key of aliasKeys) {
						const mapped = String(overrideNode[`@_${key}`] || '')
							.trim()
							.toLowerCase();
						if (mapped) {
							overrideMap[key] = mapped;
						}
					}
					if (Object.keys(overrideMap).length > 0) {
						layout.clrMapOverride = overrideMap;
					}
				}
			}

			// Background
			const bg = xmlPath(sldLayout, 'p:cSld', 'p:bg');
			const bgColor = this.parseBackgroundColor(bg);
			if (bgColor) {
				layout.backgroundColor = bgColor;
			}

			// Placeholders
			const spTree = xmlPath(sldLayout, 'p:cSld', 'p:spTree');
			const placeholders = this.extractPlaceholderList(spTree);
			if (placeholders.length > 0) {
				layout.placeholders = placeholders;
			}

			return layout;
		} catch (e) {
			console.warn('Failed to parse slide layout attributes:', e);
			return undefined;
		}
	}

	/**
	 * Parse custom slide shows from `p:presentation/p:custShowLst`.
	 */
	protected parseCustomShows(): PptxCustomShow[] | undefined {
		try {
			return parseCustomShows(this.presentationData, this.xmlLookupService);
		} catch (e) {
			console.warn('Failed to parse custom slide shows:', e);
			return undefined;
		}
	}
}
