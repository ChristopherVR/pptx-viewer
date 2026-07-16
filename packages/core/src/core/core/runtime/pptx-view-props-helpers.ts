import type {
	XmlObject,
	PptxViewProperties,
	PptxNormalViewProperties,
	PptxRestoredRegion,
} from '../../types';
import {
	applyGridSpacing,
	buildCommonSlideView,
	findViewKey,
	parseCommonSlideView,
	parseCommonView,
	parseGridSpacing,
	viewChild,
} from './pptx-view-props-geometry';

/**
 * Parse view properties from `ppt/viewProps.xml` root node.
 */
export function parseViewProperties(viewPrRoot: XmlObject): PptxViewProperties {
	const props: PptxViewProperties = {};

	const lastView = String(viewPrRoot['@_lastView'] || '').trim();
	if (lastView.length > 0) {
		props.lastView = lastView;
	}

	const showComments = viewPrRoot['@_showComments'];
	if (showComments !== undefined) {
		props.showComments = showComments !== '0';
	}

	const normalViewPr = viewChild(viewPrRoot, 'normalViewPr');
	if (normalViewPr) {
		props.normalViewPr = parseNormalViewPr(normalViewPr);
	}

	const slideViewPr = viewChild(viewPrRoot, 'slideViewPr');
	if (slideViewPr) {
		const cSldViewPr = viewChild(slideViewPr, 'cSldViewPr');
		if (cSldViewPr) {
			props.slideViewPr = parseCommonSlideView(cSldViewPr);
		}
	}

	const outlineViewPr = viewChild(viewPrRoot, 'outlineViewPr');
	if (outlineViewPr) {
		const cSldViewPr = viewChild(outlineViewPr, 'cSldViewPr');
		if (cSldViewPr) {
			props.outlineViewPr = parseCommonSlideView(cSldViewPr);
		}
	}

	const notesTextViewPr = viewChild(viewPrRoot, 'notesTextViewPr');
	if (notesTextViewPr) {
		const cViewPr =
			viewChild(notesTextViewPr, 'cViewPr') ?? viewChild(notesTextViewPr, 'cSldViewPr');
		if (cViewPr) {
			props.notesTextViewPr = parseCommonView(cViewPr);
		}
	}

	const sorterViewPr = viewChild(viewPrRoot, 'sorterViewPr');
	if (sorterViewPr) {
		const common = viewChild(sorterViewPr, 'cViewPr') ?? viewChild(sorterViewPr, 'cSldViewPr');
		props.sorterViewPr = { scale: common ? parseCommonView(common).scale : undefined };
	}

	const notesViewPr = viewChild(viewPrRoot, 'notesViewPr');
	if (notesViewPr) {
		const cSldViewPr = viewChild(notesViewPr, 'cSldViewPr');
		if (cSldViewPr) {
			props.notesViewPr = parseCommonSlideView(cSldViewPr);
		}
	}
	props.gridSpacing = parseGridSpacing(viewPrRoot);

	// Store raw XML for lossless round-trip
	props.rawXml = viewPrRoot;

	return props;
}

function parseNormalViewPr(node: XmlObject): PptxNormalViewProperties {
	const result: PptxNormalViewProperties = {};

	const showOutlineIcons = node['@_showOutlineIcons'];
	if (showOutlineIcons !== undefined) {
		result.showOutlineIcons = showOutlineIcons !== '0';
	}

	const snapVertSplitter = node['@_snapVertSplitter'];
	if (snapVertSplitter !== undefined) {
		result.snapVertSplitter = snapVertSplitter === '1';
	}

	const vertBarState = String(node['@_vertBarState'] || '').trim();
	if (vertBarState.length > 0) {
		result.vertBarState = vertBarState;
	}

	const horzBarState = String(node['@_horzBarState'] || '').trim();
	if (horzBarState.length > 0) {
		result.horzBarState = horzBarState;
	}

	const preferSingleView = node['@_preferSingleView'];
	if (preferSingleView !== undefined) {
		result.preferSingleView = preferSingleView === '1';
	}

	const restoredLeft = viewChild(node, 'restoredLeft');
	if (restoredLeft) {
		result.restoredLeft = parseRestoredRegion(restoredLeft);
	}

	const restoredTop = viewChild(node, 'restoredTop');
	if (restoredTop) {
		result.restoredTop = parseRestoredRegion(restoredTop);
	}

	return result;
}

function parseRestoredRegion(node: XmlObject): PptxRestoredRegion {
	const sz = parseInt(String(node['@_sz'] ?? '0'), 10);
	const autoAdjust = node['@_autoAdjust'];
	return {
		sz: Number.isFinite(sz) ? sz : 0,
		autoAdjust: autoAdjust !== undefined ? autoAdjust !== '0' : undefined,
	};
}

/**
 * Build view properties XML object for saving to `ppt/viewProps.xml`.
 */
export function buildViewPropertiesXml(props: PptxViewProperties): XmlObject {
	const root: XmlObject = props.rawXml
		? ({ ...props.rawXml } as XmlObject)
		: {
				'@_xmlns:p': 'http://schemas.openxmlformats.org/presentationml/2006/main',
				'@_xmlns:a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
				'@_xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
			};

	if (props.lastView) {
		root['@_lastView'] = props.lastView;
	}
	if (props.showComments !== undefined) {
		root['@_showComments'] = props.showComments ? '1' : '0';
	}

	if (props.normalViewPr) {
		const key = findViewKey(root, 'normalViewPr') ?? 'p:normalViewPr';
		root[key] = buildNormalViewPrXml(props.normalViewPr, viewChild(root, 'normalViewPr'));
	}

	if (props.slideViewPr) {
		applyCommonSlideContainer(root, 'slideViewPr', props.slideViewPr);
	}

	if (props.outlineViewPr) {
		applyCommonSlideContainer(root, 'outlineViewPr', props.outlineViewPr);
	}

	if (props.notesTextViewPr) {
		applyCommonViewContainer(root, 'notesTextViewPr', props.notesTextViewPr);
	}

	if (props.sorterViewPr?.scale) {
		applyCommonViewContainer(root, 'sorterViewPr', props.sorterViewPr);
	}

	if (props.notesViewPr) {
		applyCommonSlideContainer(root, 'notesViewPr', props.notesViewPr);
	}
	applyGridSpacing(root, props.gridSpacing);

	return { 'p:viewPr': root };
}

function buildNormalViewPrXml(props: PptxNormalViewProperties, base?: XmlObject): XmlObject {
	const node: XmlObject = { ...base };

	if (props.showOutlineIcons !== undefined) {
		node['@_showOutlineIcons'] = props.showOutlineIcons ? '1' : '0';
	}
	if (props.snapVertSplitter !== undefined) {
		node['@_snapVertSplitter'] = props.snapVertSplitter ? '1' : '0';
	}
	if (props.vertBarState) {
		node['@_vertBarState'] = props.vertBarState;
	}
	if (props.horzBarState) {
		node['@_horzBarState'] = props.horzBarState;
	}
	if (props.preferSingleView !== undefined) {
		node['@_preferSingleView'] = props.preferSingleView ? '1' : '0';
	}

	if (props.restoredLeft) {
		node['p:restoredLeft'] = buildRestoredRegionXml(props.restoredLeft);
	}
	if (props.restoredTop) {
		node['p:restoredTop'] = buildRestoredRegionXml(props.restoredTop);
	}

	return node;
}

function buildRestoredRegionXml(region: PptxRestoredRegion): XmlObject {
	const node: XmlObject = { '@_sz': String(region.sz) };
	if (region.autoAdjust !== undefined) {
		node['@_autoAdjust'] = region.autoAdjust ? '1' : '0';
	}
	return node;
}

function applyCommonSlideContainer(
	root: XmlObject,
	name: string,
	props: import('../../types').PptxCommonSlideViewProperties,
): void {
	const key = findViewKey(root, name) ?? `p:${name}`;
	const container = { ...((root[key] as XmlObject | undefined) ?? {}) };
	const commonKey = findViewKey(container, 'cSldViewPr') ?? 'p:cSldViewPr';
	container[commonKey] = buildCommonSlideView(props, viewChild(container, 'cSldViewPr'));
	root[key] = container;
}

function applyCommonViewContainer(
	root: XmlObject,
	name: string,
	props: import('../../types').PptxCommonSlideViewProperties,
): void {
	const key = findViewKey(root, name) ?? `p:${name}`;
	const container = { ...((root[key] as XmlObject | undefined) ?? {}) };
	const commonKey = findViewKey(container, 'cViewPr') ?? 'p:cViewPr';
	const wrapper = buildCommonSlideView(props, {
		'p:cViewPr': viewChild(container, 'cViewPr') ?? {},
	});
	container[commonKey] = viewChild(wrapper, 'cViewPr');
	root[key] = container;
}
