import type {
	XmlObject,
	PptxViewProperties,
	PptxNormalViewProperties,
	PptxCommonSlideViewProperties,
	PptxViewScale,
	PptxRestoredRegion,
} from '../../types';

/**
 * Parse view properties from `ppt/viewProps.xml` root node.
 */
export function parseViewProperties(
	viewPrRoot: XmlObject,
): PptxViewProperties {
	const props: PptxViewProperties = {};

	const lastView = String(viewPrRoot['@_lastView'] || '').trim();
	if (lastView.length > 0) props.lastView = lastView;

	const showComments = viewPrRoot['@_showComments'];
	if (showComments !== undefined) {
		props.showComments = showComments !== '0' && showComments !== false;
	}

	const normalViewPr = viewPrRoot['p:normalViewPr'] as
		| XmlObject
		| undefined;
	if (normalViewPr) {
		props.normalViewPr = parseNormalViewPr(normalViewPr);
	}

	const slideViewPr = viewPrRoot['p:slideViewPr'] as
		| XmlObject
		| undefined;
	if (slideViewPr) {
		const cSldViewPr = slideViewPr['p:cSldViewPr'] as
			| XmlObject
			| undefined;
		if (cSldViewPr) {
			props.slideViewPr = parseCommonSlideViewPr(cSldViewPr);
		}
	}

	const outlineViewPr = viewPrRoot['p:outlineViewPr'] as
		| XmlObject
		| undefined;
	if (outlineViewPr) {
		const cSldViewPr = outlineViewPr['p:cSldViewPr'] as
			| XmlObject
			| undefined;
		if (cSldViewPr) {
			props.outlineViewPr = parseCommonSlideViewPr(cSldViewPr);
		}
	}

	const notesTextViewPr = viewPrRoot['p:notesTextViewPr'] as
		| XmlObject
		| undefined;
	if (notesTextViewPr) {
		const cSldViewPr = notesTextViewPr['p:cSldViewPr'] as
			| XmlObject
			| undefined;
		if (cSldViewPr) {
			props.notesTextViewPr = parseCommonSlideViewPr(cSldViewPr);
		}
	}

	const sorterViewPr = viewPrRoot['p:sorterViewPr'] as
		| XmlObject
		| undefined;
	if (sorterViewPr) {
		const cSldViewPr = sorterViewPr['p:cSldViewPr'] as
			| XmlObject
			| undefined;
		const scale = cSldViewPr
			? parseViewScale(cSldViewPr)
			: undefined;
		props.sorterViewPr = { scale };
	}

	const notesViewPr = viewPrRoot['p:notesViewPr'] as
		| XmlObject
		| undefined;
	if (notesViewPr) {
		const cSldViewPr = notesViewPr['p:cSldViewPr'] as
			| XmlObject
			| undefined;
		if (cSldViewPr) {
			props.notesViewPr = parseCommonSlideViewPr(cSldViewPr);
		}
	}

	// Store raw XML for lossless round-trip
	props.rawXml = viewPrRoot;

	return props;
}

function parseNormalViewPr(
	node: XmlObject,
): PptxNormalViewProperties {
	const result: PptxNormalViewProperties = {};

	const showOutlineIcons = node['@_showOutlineIcons'];
	if (showOutlineIcons !== undefined) {
		result.showOutlineIcons =
			showOutlineIcons !== '0' && showOutlineIcons !== false;
	}

	const snapVertSplitter = node['@_snapVertSplitter'];
	if (snapVertSplitter !== undefined) {
		result.snapVertSplitter =
			snapVertSplitter === '1' || snapVertSplitter === true;
	}

	const vertBarState = String(node['@_vertBarState'] || '').trim();
	if (vertBarState.length > 0) result.vertBarState = vertBarState;

	const horzBarState = String(node['@_horzBarState'] || '').trim();
	if (horzBarState.length > 0) result.horzBarState = horzBarState;

	const preferSingleView = node['@_preferSingleView'];
	if (preferSingleView !== undefined) {
		result.preferSingleView =
			preferSingleView === '1' || preferSingleView === true;
	}

	const restoredLeft = node['p:restoredLeft'] as XmlObject | undefined;
	if (restoredLeft) {
		result.restoredLeft = parseRestoredRegion(restoredLeft);
	}

	const restoredTop = node['p:restoredTop'] as XmlObject | undefined;
	if (restoredTop) {
		result.restoredTop = parseRestoredRegion(restoredTop);
	}

	return result;
}

function parseRestoredRegion(
	node: XmlObject,
): PptxRestoredRegion {
	const sz = parseInt(String(node['@_sz'] ?? '0'), 10);
	const autoAdjust = node['@_autoAdjust'];
	return {
		sz: Number.isFinite(sz) ? sz : 0,
		autoAdjust:
			autoAdjust !== undefined
				? autoAdjust !== '0' && autoAdjust !== false
				: undefined,
	};
}

function parseCommonSlideViewPr(
	node: XmlObject,
): PptxCommonSlideViewProperties {
	const result: PptxCommonSlideViewProperties = {};

	const snapToGrid = node['@_snapToGrid'];
	if (snapToGrid !== undefined) {
		result.snapToGrid = snapToGrid !== '0' && snapToGrid !== false;
	}

	const snapToObjects = node['@_snapToObjects'];
	if (snapToObjects !== undefined) {
		result.snapToObjects =
			snapToObjects !== '0' && snapToObjects !== false;
	}

	const showGuides = node['@_showGuides'];
	if (showGuides !== undefined) {
		result.showGuides = showGuides !== '0' && showGuides !== false;
	}

	const origin = node['p:origin'] as XmlObject | undefined;
	if (origin) {
		const x = parseInt(String(origin['@_x'] ?? '0'), 10);
		const y = parseInt(String(origin['@_y'] ?? '0'), 10);
		if (Number.isFinite(x) && Number.isFinite(y)) {
			result.origin = { x, y };
		}
	}

	result.scale = parseViewScale(node);

	return result;
}

function parseViewScale(
	node: XmlObject,
): PptxViewScale | undefined {
	const scale = node['p:scale'] as XmlObject | undefined;
	if (!scale) return undefined;

	const sx = scale['a:sx'] as XmlObject | undefined;
	if (!sx) return undefined;

	const n = parseInt(String(sx['@_n'] ?? '0'), 10);
	const d = parseInt(String(sx['@_d'] ?? '100'), 10);
	if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0)
		return undefined;

	return { n, d };
}

/**
 * Build view properties XML object for saving to `ppt/viewProps.xml`.
 */
export function buildViewPropertiesXml(
	props: PptxViewProperties,
): XmlObject {
	// If we have raw XML, use it as the base for lossless round-trip
	if (props.rawXml) {
		const root = { ...props.rawXml } as XmlObject;

		// Apply any modifications on top of the raw XML
		if (props.lastView !== undefined) {
			root['@_lastView'] = props.lastView;
		}
		if (props.showComments !== undefined) {
			root['@_showComments'] = props.showComments ? '1' : '0';
		}

		return { 'p:viewPr': root };
	}

	const root: XmlObject = {
		'@_xmlns:p':
			'http://schemas.openxmlformats.org/presentationml/2006/main',
		'@_xmlns:a':
			'http://schemas.openxmlformats.org/drawingml/2006/main',
		'@_xmlns:r':
			'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
	};

	if (props.lastView) root['@_lastView'] = props.lastView;
	if (props.showComments !== undefined) {
		root['@_showComments'] = props.showComments ? '1' : '0';
	}

	if (props.normalViewPr) {
		root['p:normalViewPr'] = buildNormalViewPrXml(
			props.normalViewPr,
		);
	}

	if (props.slideViewPr) {
		root['p:slideViewPr'] = {
			'p:cSldViewPr': buildCommonSlideViewPrXml(props.slideViewPr),
		};
	}

	if (props.outlineViewPr) {
		root['p:outlineViewPr'] = {
			'p:cSldViewPr': buildCommonSlideViewPrXml(
				props.outlineViewPr,
			),
		};
	}

	if (props.notesTextViewPr) {
		root['p:notesTextViewPr'] = {
			'p:cSldViewPr': buildCommonSlideViewPrXml(
				props.notesTextViewPr,
			),
		};
	}

	if (props.sorterViewPr?.scale) {
		root['p:sorterViewPr'] = {
			'p:cSldViewPr': buildScaleXml(props.sorterViewPr.scale),
		};
	}

	if (props.notesViewPr) {
		root['p:notesViewPr'] = {
			'p:cSldViewPr': buildCommonSlideViewPrXml(props.notesViewPr),
		};
	}

	return { 'p:viewPr': root };
}

function buildNormalViewPrXml(
	props: PptxNormalViewProperties,
): XmlObject {
	const node: XmlObject = {};

	if (props.showOutlineIcons !== undefined) {
		node['@_showOutlineIcons'] = props.showOutlineIcons ? '1' : '0';
	}
	if (props.snapVertSplitter !== undefined) {
		node['@_snapVertSplitter'] = props.snapVertSplitter ? '1' : '0';
	}
	if (props.vertBarState) node['@_vertBarState'] = props.vertBarState;
	if (props.horzBarState) node['@_horzBarState'] = props.horzBarState;
	if (props.preferSingleView !== undefined) {
		node['@_preferSingleView'] = props.preferSingleView ? '1' : '0';
	}

	if (props.restoredLeft) {
		node['p:restoredLeft'] = buildRestoredRegionXml(
			props.restoredLeft,
		);
	}
	if (props.restoredTop) {
		node['p:restoredTop'] = buildRestoredRegionXml(
			props.restoredTop,
		);
	}

	return node;
}

function buildRestoredRegionXml(
	region: PptxRestoredRegion,
): XmlObject {
	const node: XmlObject = { '@_sz': String(region.sz) };
	if (region.autoAdjust !== undefined) {
		node['@_autoAdjust'] = region.autoAdjust ? '1' : '0';
	}
	return node;
}

function buildCommonSlideViewPrXml(
	props: PptxCommonSlideViewProperties,
): XmlObject {
	const node: XmlObject = {};

	if (props.snapToGrid !== undefined) {
		node['@_snapToGrid'] = props.snapToGrid ? '1' : '0';
	}
	if (props.snapToObjects !== undefined) {
		node['@_snapToObjects'] = props.snapToObjects ? '1' : '0';
	}
	if (props.showGuides !== undefined) {
		node['@_showGuides'] = props.showGuides ? '1' : '0';
	}
	if (props.origin) {
		node['p:origin'] = {
			'@_x': String(props.origin.x),
			'@_y': String(props.origin.y),
		};
	}
	if (props.scale) {
		Object.assign(node, buildScaleXml(props.scale));
	}

	return node;
}

function buildScaleXml(scale: PptxViewScale): XmlObject {
	return {
		'p:scale': {
			'a:sx': { '@_n': String(scale.n), '@_d': String(scale.d) },
			'a:sy': { '@_n': String(scale.n), '@_d': String(scale.d) },
		},
	};
}
