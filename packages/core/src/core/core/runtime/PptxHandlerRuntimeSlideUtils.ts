import { XmlObject, TextSegment, PptxElement } from '../../types';
import { stripParentDirSegments } from '../../utils/strip-parent-dir-segments';
import { PptxHandlerRuntime as PptxHandlerRuntimeBase } from './PptxHandlerRuntimeBackgroundParsing';

export class PptxHandlerRuntime extends PptxHandlerRuntimeBase {
	/**
	 * Retrieve the background gradient from a layout, falling back to master.
	 */
	protected async getLayoutBackgroundGradient(slidePath: string): Promise<string | undefined> {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return undefined;
		}

		for (const [, target] of slideRels.entries()) {
			if (target.includes('slideLayout')) {
				const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
				const layoutPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(slideDir, target)
						: `ppt/${stripParentDirSegments(target)}`;

				try {
					const layoutXmlObj = await this.resolveCachedLayoutXml(layoutPath);
					if (layoutXmlObj) {
						const layoutGrad = this.extractBackgroundGradient(layoutXmlObj, 'p:sldLayout');
						if (layoutGrad) {
							return layoutGrad;
						}

						// Fallback to master
						return this.getMasterBackgroundGradient(layoutPath);
					}
				} catch {
					// Ignore
				}
				break;
			}
		}
		return undefined;
	}

	/**
	 * Resolve the slide master's background gradient given a layout path.
	 */
	protected async getMasterBackgroundGradient(layoutPath: string): Promise<string | undefined> {
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return undefined;
		}

		for (const [, target] of layoutRels.entries()) {
			if (target.includes('slideMaster')) {
				const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
				const masterPath = target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(layoutDir, target)
						: `ppt/${stripParentDirSegments(target)}`;

				try {
					const masterXmlObj = await this.resolveCachedMasterXml(masterPath);
					if (masterXmlObj) {
						return this.extractBackgroundGradient(masterXmlObj, 'p:sldMaster');
					}
				} catch {
					// Ignore
				}
				break;
			}
		}
		return undefined;
	}

	/**
	 * Find the layout file path referenced by a slide via its relationships.
	 */
	protected findLayoutPathForSlide(slidePath: string): string | undefined {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return undefined;
		}
		for (const [, target] of slideRels.entries()) {
			if (target.includes('slideLayout')) {
				const slideDir = slidePath.substring(0, slidePath.lastIndexOf('/') + 1);
				return target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(slideDir, target)
						: `ppt/${stripParentDirSegments(target)}`;
			}
		}
		return undefined;
	}

	/**
	 * Find the master file path referenced by a layout via its relationships.
	 */
	protected findMasterPathForLayoutBase(layoutPath: string): string | undefined {
		const layoutRels = this.slideRelsMap.get(layoutPath);
		if (!layoutRels) {
			return undefined;
		}
		for (const [, target] of layoutRels.entries()) {
			if (target.includes('slideMaster')) {
				const layoutDir = layoutPath.substring(0, layoutPath.lastIndexOf('/') + 1);
				return target.startsWith('/')
					? target.substring(1)
					: target.startsWith('..')
						? this.resolvePath(layoutDir, target)
						: `ppt/${stripParentDirSegments(target)}`;
			}
		}
		return undefined;
	}

	/**
	 * Switch the active master state (clrMap + theme color/font/format
	 * scheme) so that scheme-colour resolution for the slide currently
	 * being parsed walks through the correct master.
	 *
	 * Multi-master decks must resolve scheme colours against each slide's
	 * own master rather than always against `masterFiles[0]`.
	 *
	 * Phase 2 Stream B / C-H4.
	 */
	protected async setActiveMasterForSlide(slidePath: string): Promise<void> {
		const layoutPath = this.findLayoutPathForSlide(slidePath);
		if (!layoutPath) {
			this.currentMasterClrMap = null;
			this.themeColorMap = { ...this.globalThemeColorMapSnapshot };
			this.themeFontMap = { ...this.globalThemeFontMapSnapshot };
			this.themeFormatScheme = this.globalThemeFormatSchemeSnapshot;
			return;
		}
		// Ensure the layout's `.rels` are loaded so we can resolve the master.
		if (!this.slideRelsMap.has(layoutPath)) {
			const layoutRelsPath = `${layoutPath.replace('slideLayouts/', 'slideLayouts/_rels/')}.rels`;
			try {
				await this.loadSlideRelationships(layoutPath, layoutRelsPath);
			} catch {
				/* fall through — fallback below */
			}
		}
		const masterPath = this.findMasterPathForLayoutBase(layoutPath);
		if (!masterPath) {
			this.currentMasterClrMap = null;
			this.themeColorMap = { ...this.globalThemeColorMapSnapshot };
			this.themeFontMap = { ...this.globalThemeFontMapSnapshot };
			this.themeFormatScheme = this.globalThemeFormatSchemeSnapshot;
			return;
		}

		// Master clrMap (alias routing layer).
		this.currentMasterClrMap = this.masterClrMaps.get(masterPath) ?? null;

		// Per-master theme switch. When the deck has multiple masters with
		// distinct themes we need to restore from the post-load snapshot
		// before applying so the previous slide's master state does not
		// leak through.
		const masterColorMap = this.masterThemeColorMaps.get(masterPath);
		this.themeColorMap = masterColorMap
			? { ...masterColorMap }
			: { ...this.globalThemeColorMapSnapshot };

		const masterFontMap = this.masterThemeFontMaps.get(masterPath);
		this.themeFontMap = masterFontMap
			? { ...masterFontMap }
			: { ...this.globalThemeFontMapSnapshot };

		const masterFormatScheme = this.masterThemeFormatSchemes.get(masterPath);
		this.themeFormatScheme = masterFormatScheme ?? this.globalThemeFormatSchemeSnapshot;
	}

	/**
	 * Extract the `p:bg/@showAnimation` flag from a slide's XML.
	 * Returns `true` when the background should animate, `false` when
	 * explicitly disabled, or `undefined` when the attribute is absent
	 * (defaults to true per OOXML spec).
	 */
	protected extractBackgroundShowAnimation(slideXml: XmlObject): boolean | undefined {
		const sld = slideXml['p:sld'] as XmlObject | undefined;
		const bg = (sld?.['p:cSld'] as XmlObject | undefined)?.['p:bg'] as XmlObject | undefined;
		if (!bg) {
			return undefined;
		}
		const rawVal = bg['@_showAnimation'];
		if (rawVal === undefined) {
			return undefined;
		}
		const normalized = String(rawVal).trim().toLowerCase();
		return normalized !== '0' && normalized !== 'false';
	}

	/**
	 * Extract the `p:sld/@showMasterSp` flag.
	 * Returns `false` when master shapes should be hidden, `true` when
	 * explicitly shown, or `undefined` when the attribute is absent
	 * (defaults to true per OOXML spec).
	 */
	protected extractShowMasterShapes(slideXml: XmlObject): boolean | undefined {
		const sld = slideXml['p:sld'] as XmlObject | undefined;
		if (!sld) {
			return undefined;
		}
		const rawVal = sld['@_showMasterSp'];
		if (rawVal === undefined) {
			return undefined;
		}
		const normalized = String(rawVal).trim().toLowerCase();
		return normalized !== '0' && normalized !== 'false';
	}

	protected isSlideHidden(slideXmlObj: XmlObject, slideIdEntry: XmlObject | undefined): boolean {
		const slideShowValue = String(
			(slideXmlObj?.['p:sld'] as XmlObject | undefined)?.['@_show'] ?? '',
		).toLowerCase();
		if (slideShowValue === '0' || slideShowValue === 'false') {
			return true;
		}

		const slideIdShowValue = String(slideIdEntry?.['@_show'] ?? '').toLowerCase();
		return slideIdShowValue === '0' || slideIdShowValue === 'false';
	}

	protected extractTextFromTxBody(txBody: XmlObject | undefined): string {
		if (!txBody) {
			return '';
		}
		const paragraphs = this.ensureArray(txBody['a:p']);
		if (paragraphs.length === 0) {
			return '';
		}
		const chunks: string[] = [];

		paragraphs.forEach((paragraph: XmlObject, paragraphIndex: number) => {
			const runTexts: string[] = [];
			const runs = this.ensureArray(paragraph?.['a:r']);
			runs.forEach((run) => {
				const value = run?.['a:t'];
				if (typeof value === 'string') {
					runTexts.push(value);
				} else if (value !== undefined) {
					runTexts.push(String(value));
				}
			});

			const fields = this.ensureArray(paragraph?.['a:fld']);
			fields.forEach((field) => {
				const value = field?.['a:t'];
				if (typeof value === 'string') {
					runTexts.push(value);
				} else if (value !== undefined) {
					runTexts.push(String(value));
				}
			});

			if (paragraph?.['a:t'] !== undefined) {
				const value = paragraph['a:t'];
				runTexts.push(typeof value === 'string' ? value : String(value));
			}

			const lineBreaks = this.ensureArray(paragraph?.['a:br']);
			if (lineBreaks.length > 0) {
				for (let idx = 0; idx < lineBreaks.length; idx++) {
					runTexts.push('\n');
				}
			}

			chunks.push(runTexts.join(''));
			if (paragraphIndex < paragraphs.length - 1) {
				chunks.push('\n');
			}
		});

		return chunks.join('').trim();
	}

	protected async extractSlideNotes(slidePath: string): Promise<{
		notes?: string;
		notesSegments?: TextSegment[];
		notesShapes?: PptxElement[];
		notesClrMapOverride?: Record<string, string>;
		notesCSldName?: string;
	}> {
		const slideRels = this.slideRelsMap.get(slidePath);
		if (!slideRels) {
			return {};
		}

		let notesPath: string | undefined;
		for (const [, target] of slideRels.entries()) {
			if (!target.includes('notesSlide')) {
				continue;
			}
			notesPath = this.resolveImagePath(slidePath, target);
			break;
		}
		if (!notesPath) {
			return {};
		}

		const notesXml = await this.zip.file(notesPath)?.async('string');
		if (!notesXml) {
			return {};
		}
		const notesObj = this.parser.parse(notesXml) as XmlObject;
		const notesNode = notesObj?.['p:notes'] as XmlObject | undefined;
		const cSld = notesNode?.['p:cSld'] as XmlObject | undefined;
		const spTree = cSld?.['p:spTree'] as XmlObject | undefined;
		if (!spTree) {
			return {};
		}

		const shapes = this.ensureArray(spTree['p:sp']) as XmlObject[];
		const notesChunks: string[] = [];
		const allSegments: TextSegment[] = [];
		const parsedShapes: PptxElement[] = [];
		shapes.forEach((shape, shapeIndex) => {
			const txBody = shape?.['p:txBody'] as XmlObject | undefined;
			const text = this.extractTextFromTxBody(txBody);
			if (text.length > 0) {
				notesChunks.push(text);
				const segs = this.extractTextSegmentsFromTxBodyForRewrite(txBody, undefined);
				if (allSegments.length > 0 && segs.length > 0) {
					// Insert paragraph break between shapes
					allSegments.push({ text: '\n', isParagraphBreak: true, style: {} });
				}
				allSegments.push(...segs);
			}
			// Parse the full shape so the notes-page shape tree can be
			// inspected and edited (not just the body placeholder text).
			// `parseShape` is sync and does not mutate the parser state. We
			// scope it to the notes part path so any placeholder lookups use
			// the notes-master/-layout if present, falling back gracefully.
			try {
				const parsed = this.parseShape(shape, `notes-shape-${shapeIndex}`, notesPath);
				if (parsed) {
					parsedShapes.push(parsed);
				}
			} catch {
				// Non-fatal — raw notes XML still round-trips via the
				// existing slideNotesPartUpdater fallback.
			}
		});

		// Per-notes-slide colour-map override (`<p:clrMapOvr>`). Captured as
		// a plain `bg1: dk1` mapping when an `<a:overrideClrMapping>` is
		// present; absent/`<a:masterClrMapping/>` yields no override.
		let notesClrMapOverride: Record<string, string> | undefined;
		const clrMapOvr = notesNode?.['p:clrMapOvr'] as XmlObject | undefined;
		const overrideMapping = clrMapOvr?.['a:overrideClrMapping'] as XmlObject | undefined;
		if (overrideMapping) {
			const map: Record<string, string> = {};
			for (const key of [
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
			]) {
				const v = overrideMapping[`@_${key}`];
				if (v !== undefined && v !== null) {
					map[key] = String(v);
				}
			}
			if (Object.keys(map).length > 0) {
				notesClrMapOverride = map;
			}
		}

		const notesCSldNameRaw = cSld?.['@_name'];
		const notesCSldName =
			notesCSldNameRaw !== undefined && notesCSldNameRaw !== null
				? String(notesCSldNameRaw)
				: undefined;

		const merged = notesChunks.join('\n').trim();
		return {
			notes: merged.length > 0 ? merged : undefined,
			notesSegments: allSegments.length > 0 ? allSegments : undefined,
			notesShapes: parsedShapes.length > 0 ? parsedShapes : undefined,
			notesClrMapOverride,
			notesCSldName,
		};
	}
}
