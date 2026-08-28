import type { Translator } from '../../i18n/translator';
import type { PowerPointViewerProps } from '../types';
import type { CreateViewerStateOptions } from './create-viewer-state-types';

/**
 * The values only the component that renders the markup can supply: its
 * `bind:this` targets, the measured viewport, the master-view scale a child
 * reports back, and the already locale-bound translator.
 */
export interface ViewerDomAccessors {
	t: Translator;
	getStageHolderEl(): HTMLDivElement | undefined;
	getRootEl(): HTMLDivElement | undefined;
	getViewportWidth(): number;
	getViewportHeight(): number;
	getMasterScale(): number;
}

/**
 * Map `PowerPointViewer`'s host props onto {@link CreateViewerStateOptions}.
 *
 * EVERY field is a getter or a closure over `getProps()`, never a snapshot:
 * `$props()` values are only reactive when read inside a function, so building
 * this object with plain `onload,` shorthand would freeze the viewer to the
 * host's first render and silently ignore every later callback or config
 * change. Splitting the mapping out here keeps that rule in one place (and the
 * root SFC within the repo's file-size budget).
 *
 * The prop defaults applied below are the same ones the component's own
 * `$props()` destructuring used to declare.
 */
export function toViewerStateOptions(
	getProps: () => PowerPointViewerProps,
	dom: ViewerDomAccessors,
): CreateViewerStateOptions {
	return {
		...dom,
		getSource: () => getProps().source,
		// Deliberately NOT defaulted: the host prop is a ceiling, and `undefined`
		// ("the host said nothing") permits autosave, which is not the same answer
		// as an explicit `false`. See `resolveAutosaveActivation` in shared.
		getAutosave: () => getProps().autosave,
		getFilePath: () => getProps().filePath,
		getInitialSlide: () => getProps().initialSlide ?? 0,
		getSmartArt3D: () => getProps().smartArt3D ?? false,
		getSurfaceChart3D: () => getProps().surfaceChart3D ?? false,
		getBarChart3D: () => getProps().barChart3D ?? false,
		getLineChart3D: () => getProps().lineChart3D ?? false,
		getAreaChart3D: () => getProps().areaChart3D ?? false,
		getPieChart3D: () => getProps().pieChart3D ?? false,
		getEditable: () => getProps().editable ?? false,
		getFileName: () => getProps().fileName,
		getAiEnabled: () => Boolean(getProps().ai),
		get collaboration() {
			return getProps().collaboration;
		},
		get shareDefaults() {
			return getProps().shareDefaults;
		},
		get autosaveIntervalMs() {
			return getProps().autosaveIntervalMs;
		},
		get onload() {
			return getProps().onload;
		},
		get onerror() {
			return getProps().onerror;
		},
		get onslidechange() {
			return getProps().onslidechange;
		},
		get onnotesupdate() {
			return getProps().onnotesupdate;
		},
		get onchange() {
			return getProps().onchange;
		},
		get ondirtychange() {
			return getProps().ondirtychange;
		},
		get oncontentchange() {
			return getProps().oncontentchange;
		},
		get onmodechange() {
			return getProps().onmodechange;
		},
		get onzoomchange() {
			return getProps().onzoomchange;
		},
		get onselectionchange() {
			return getProps().onselectionchange;
		},
		get onslidecountchange() {
			return getProps().onslidecountchange;
		},
		get onautosave() {
			return getProps().onautosave;
		},
		get onautosavetoggle() {
			return getProps().onautosavetoggle;
		},
		get onstartcollaboration() {
			return getProps().onstartcollaboration;
		},
		get onstopcollaboration() {
			return getProps().onstopcollaboration;
		},
		get onopenfile() {
			return getProps().onopenfile;
		},
	};
}
