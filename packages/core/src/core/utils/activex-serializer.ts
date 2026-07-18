import type { XmlObject, PptxActiveXControl } from '../types';

/**
 * Build a single `<p:control>` node (CT_Control, ISO/IEC 29500-1 §19.3.1.2)
 * from the typed model. Typed attributes (`r:id`, `name`, `spid`) are written
 * from the model so edits round-trip; any unmodeled children (the placeholder
 * `<p:pic>`, `<p:extLst>`) and extra attributes carried on `rawXml` are
 * preserved verbatim for a lossless save.
 */
export function buildActiveXControlNode(control: PptxActiveXControl): XmlObject {
	const node: XmlObject = control.rawXml ? { ...control.rawXml } : {};
	node['@_r:id'] = control.relId;
	if (control.name !== undefined && control.name !== '') {
		node['@_name'] = control.name;
	} else {
		delete node['@_name'];
	}
	if (control.shapeId !== undefined && control.shapeId !== '') {
		node['@_spid'] = control.shapeId;
	} else {
		delete node['@_spid'];
	}
	return node;
}

/**
 * Serialize typed ActiveX controls back into a slide's
 * `p:cSld > p:controls > p:control` (CT_ControlList, §19.3.1.3). Mutates
 * `slideXml` in place.
 *
 * `<p:controls>` must follow `<p:spTree>`/`<p:custDataLst>` and precede
 * `<p:extLst>` inside CT_CommonSlideData (§19.3.1.16). When the container is
 * freshly introduced we re-append any existing `<p:extLst>` after it to keep
 * that schema order; a round-tripped container already sits in the right slot,
 * so an in-place value update leaves ordering untouched.
 */
export function applyActiveXControlsToSlide(
	slideXml: XmlObject,
	controls: readonly PptxActiveXControl[] | undefined,
): void {
	const sld = slideXml['p:sld'] as XmlObject | undefined;
	const cSld = sld?.['p:cSld'] as XmlObject | undefined;
	if (!cSld) {
		return;
	}

	if (!controls || controls.length === 0) {
		delete cSld['p:controls'];
		return;
	}

	const nodes = controls.map(buildActiveXControlNode);
	const container = (cSld['p:controls'] as XmlObject | undefined) ?? {};
	const isNewContainer = cSld['p:controls'] === undefined;
	container['p:control'] = nodes.length === 1 ? nodes[0] : nodes;

	if (isNewContainer && cSld['p:extLst'] !== undefined) {
		const extLst = cSld['p:extLst'];
		delete cSld['p:extLst'];
		cSld['p:controls'] = container;
		cSld['p:extLst'] = extLst;
	} else {
		cSld['p:controls'] = container;
	}
}
