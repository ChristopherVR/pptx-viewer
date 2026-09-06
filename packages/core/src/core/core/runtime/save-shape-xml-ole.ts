import { XmlObject } from '../../types';
import type { OlePptxElement } from '../../types';
import { oleUpdateAutomaticAttr } from '../builders/ole-update-automatic';

/**
 * Relationship type for embedded / linked OLE binary parts.
 * (`http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject`).
 */
export const OLE_OBJECT_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject';

/**
 * Relationship type for image parts (used for OLE preview blip).
 */
export const OLE_IMAGE_RELATIONSHIP_TYPE =
	'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';

/**
 * URI for OLE objects in `<a:graphicData>`.
 */
const OLE_GRAPHIC_DATA_URI = 'http://schemas.openxmlformats.org/presentationml/2006/ole';

/**
 * Build a `p:graphicFrame` XML skeleton for an OLE object element.
 *
 * Used both for SDK-created OLE elements (no `rawXml`) and to refresh
 * a few key attributes on a loaded element when the typed fields have
 * been mutated. The output is the canonical
 * `p:graphicFrame > a:graphic > a:graphicData uri="…/ole" > p:oleObj`
 * shape per ECMA-376 §19.3.1.34 / §13.3.4.
 *
 * The caller (`processSlideElement`) is responsible for ensuring the
 * embed / preview-image relationships referenced from `r:id` / `r:embed`
 * exist in the slide's rels file. This method does not register them
 * itself because the typed model does not currently carry the binary
 * payload: the binary part must already be in the package (loaded from
 * the original file). A fully-fabricated SDK OLE element therefore
 * still requires the consumer to attach the binary out-of-band; this
 * method simply emits a schema-valid envelope referencing the
 * specified relationship ID.
 */
export function buildOleGraphicFrameXml(
	el: OlePptxElement,
	emuPerPx: number,
	embedRelationshipId: string,
): XmlObject {
	// See `buildTableGraphicFrameXml`: the family default has to reach the
	// model or the lock writer removes it again a few lines later.
	el.locks = { noChangeAspect: true, ...el.locks };
	const offX = String(Math.round(el.x * emuPerPx));
	const offY = String(Math.round(el.y * emuPerPx));
	const extCx = String(Math.round(Math.max(el.width, 1) * emuPerPx));
	const extCy = String(Math.round(Math.max(el.height, 1) * emuPerPx));

	const oleObj: XmlObject = {
		'@_showAsIcon': el.oleShowAsIcon ? '1' : '0',
		'@_imgW': el.oleImgW !== undefined ? String(el.oleImgW) : extCx,
		'@_imgH': el.oleImgH !== undefined ? String(el.oleImgH) : extCy,
	};
	if (el.oleProgId) {
		oleObj['@_progId'] = el.oleProgId;
	}
	if (el.oleName) {
		oleObj['@_name'] = el.oleName;
	}
	if (el.oleClsId) {
		oleObj['@_classid'] = el.oleClsId;
	}
	if (embedRelationshipId) {
		oleObj['@_r:id'] = embedRelationshipId;
	}
	// Choose embed vs link form per CT_OleObject (ECMA-376 §13.3.4).
	// `<p:embed>` and `<p:link>` are a child-element choice: exactly one
	// must be present.
	if (el.isLinked) {
		oleObj['p:link'] = {
			'@_r:id': embedRelationshipId,
			// P1-G3: schema default is `false` - honour a caller's explicit
			// choice rather than always fabricating an auto-updating link.
			'@_updateAutomatic': oleUpdateAutomaticAttr(el),
			...(el.oleFollowColorScheme !== undefined
				? { '@_followColorScheme': el.oleFollowColorScheme }
				: {}),
		};
	} else {
		oleObj['p:embed'] = {};
	}

	// Picture preview is required by PowerPoint; if no preview blip exists we
	// emit an empty `p:pic` which PowerPoint accepts and replaces with a
	// placeholder icon at first render.
	oleObj['p:pic'] = {
		'p:nvPicPr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.oleName || 'OleObject' },
			'p:cNvPicPr': {},
			'p:nvPr': {},
		},
		'p:blipFill': {
			'a:blip': {},
			'a:stretch': { 'a:fillRect': {} },
		},
		'p:spPr': {
			'a:xfrm': {
				'a:off': { '@_x': offX, '@_y': offY },
				'a:ext': { '@_cx': extCx, '@_cy': extCy },
			},
			'a:prstGeom': { '@_prst': 'rect', 'a:avLst': {} },
		},
	};

	return {
		'p:nvGraphicFramePr': {
			'p:cNvPr': { '@_id': '0', '@_name': el.oleName || el.fileName || 'OleObject' },
			'p:cNvGraphicFramePr': {
				'a:graphicFrameLocks': { '@_noChangeAspect': '1' },
			},
			'p:nvPr': {},
		},
		'p:xfrm': {
			'a:off': { '@_x': offX, '@_y': offY },
			'a:ext': { '@_cx': extCx, '@_cy': extCy },
		},
		'a:graphic': {
			'a:graphicData': {
				'@_uri': OLE_GRAPHIC_DATA_URI,
				'p:oleObj': oleObj,
			},
		},
	};
}

/**
 * Refresh editable typed-field attributes on a loaded OLE graphicFrame's
 * raw XML. Only attributes that round-trip through the typed model
 * (`progId`, `name`, `classid`) are touched so unknown extension data
 * passes through verbatim.
 */
export function applyOleTypedFieldUpdatesXml(shape: XmlObject, el: OlePptxElement): void {
	const oleObj = (
		(shape['a:graphic'] as XmlObject | undefined)?.['a:graphicData'] as XmlObject | undefined
	)?.['p:oleObj'] as XmlObject | undefined;
	if (!oleObj) {
		return;
	}
	if (el.oleProgId) {
		oleObj['@_progId'] = el.oleProgId;
	}
	if (el.oleName !== undefined) {
		if (el.oleName.length > 0) {
			oleObj['@_name'] = el.oleName;
		} else {
			delete oleObj['@_name'];
		}
	}
	if (el.oleClsId) {
		oleObj['@_classid'] = el.oleClsId;
	}
	if (el.oleShowAsIcon !== undefined) {
		oleObj['@_showAsIcon'] = el.oleShowAsIcon ? '1' : '0';
	}
	if (el.oleImgW !== undefined) {
		oleObj['@_imgW'] = String(el.oleImgW);
	}
	if (el.oleImgH !== undefined) {
		oleObj['@_imgH'] = String(el.oleImgH);
	}
	// Reconcile the embed/link child choice with the typed `isLinked`
	// flag. CT_OleObject is a strict choice: keep exactly one of the
	// two child elements.
	if (el.isLinked === true) {
		if (!oleObj['p:link']) {
			const existingRid = String(
				(oleObj['p:embed'] as XmlObject | undefined)?.['@_r:id'] || oleObj['@_r:id'] || '',
			).trim();
			// P1-G3: same spec-default reasoning as `buildOleGraphicFrameXml`
			// - converting embed -> link via the API must not silently force
			// an auto-updating link.
			const updateAutomatic = oleUpdateAutomaticAttr(el);
			oleObj['p:link'] = existingRid
				? { '@_r:id': existingRid, '@_updateAutomatic': updateAutomatic }
				: { '@_updateAutomatic': updateAutomatic };
		}
		delete oleObj['p:embed'];
	} else if (el.isLinked === false) {
		if (!oleObj['p:embed']) {
			oleObj['p:embed'] = {};
		}
		delete oleObj['p:link'];
	}
	// `p:link/@followColorScheme` only applies to the linked form; keep it
	// in sync with the typed field whenever a `p:link` node exists.
	const linkNode = oleObj['p:link'] as XmlObject | undefined;
	if (linkNode) {
		if (el.oleFollowColorScheme !== undefined) {
			linkNode['@_followColorScheme'] = el.oleFollowColorScheme;
		} else {
			delete linkNode['@_followColorScheme'];
		}
		// P1-G3: `p:link/@updateAutomatic`. Only touched when the typed field
		// is defined - which parse always populates from an authored source
		// attribute, so a pure passthrough naturally re-emits the original
		// value; `undefined` (never authored, or a bare API-fabricated
		// element) leaves whatever the existing node already carries alone.
		if (el.oleUpdateAutomatic !== undefined) {
			linkNode['@_updateAutomatic'] = el.oleUpdateAutomatic ? '1' : '0';
		}
	}
}

/** Look up the existing OLE binary relationship ID for this slide, if any. */
export function resolveOleEmbedRelationshipIdFromRels(
	slideRelationships: XmlObject[],
	oleTarget: string | undefined,
): string | undefined {
	if (!oleTarget) {
		return undefined;
	}
	const normalisedTarget = oleTarget.replace(/^ppt\//u, '../').replace(/^\/+/u, '');
	const lowerTarget = normalisedTarget.toLowerCase();
	for (const rel of slideRelationships) {
		const relType = String(rel?.['@_Type'] || '');
		if (relType !== OLE_OBJECT_RELATIONSHIP_TYPE) {
			continue;
		}
		const target = String(rel?.['@_Target'] || '')
			.toLowerCase()
			.trim();
		if (target === lowerTarget || target.endsWith(lowerTarget) || lowerTarget.endsWith(target)) {
			const relId = String(rel?.['@_Id'] || '').trim();
			if (relId.length > 0) {
				return relId;
			}
		}
	}
	// Fallback: first OLE relationship on the slide.
	const fallback = slideRelationships.find(
		(rel) => String(rel?.['@_Type'] || '') === OLE_OBJECT_RELATIONSHIP_TYPE,
	);
	const fallbackId = String(fallback?.['@_Id'] || '').trim();
	return fallbackId.length > 0 ? fallbackId : undefined;
}
