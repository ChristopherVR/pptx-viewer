import { EDITOR_ARRANGE_CSS } from './arrange-css';
import { EDITOR_CLUSTER_CSS } from './cluster-css';
import { EDITOR_CONTROLS_CSS } from './controls-css';
import { EDITOR_FONT_PICKER_CSS } from './font-picker-css';
import { EDITOR_HOME_LAYOUT_CSS } from './home-layout-css';
import { EDITOR_INSPECTOR_CSS } from './inspector-css';
import { EDITOR_LAYOUT_CSS } from './layout-css';
import { EDITOR_RIBBON_CSS } from './ribbon-css';
import { EDITOR_THUMBNAIL_CSS } from './thumbnail-css';

export * from './metrics';

/** Bundled with each binding, so consuming apps need no separate CSS import. */
export const EDITOR_CHROME_CSS =
	EDITOR_LAYOUT_CSS +
	EDITOR_THUMBNAIL_CSS +
	EDITOR_RIBBON_CSS +
	EDITOR_INSPECTOR_CSS +
	EDITOR_CONTROLS_CSS +
	EDITOR_FONT_PICKER_CSS +
	EDITOR_HOME_LAYOUT_CSS +
	EDITOR_ARRANGE_CSS +
	EDITOR_CLUSTER_CSS;
