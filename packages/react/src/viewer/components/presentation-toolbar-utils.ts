/**
 * presentation-toolbar-utils
 *
 * Thin re-export shim: the pure presentation-toolbar helpers now live in
 * `pptx-viewer-shared` (`render/presentation-toolbar`). Kept here so existing
 * React imports of `./presentation-toolbar-utils` continue to resolve.
 */

export {
	AUTO_HIDE_DELAY_MS,
	BOTTOM_TRIGGER_FRACTION,
	formatSlideCounter,
	isInBottomTriggerZone,
	shouldAutoHide,
} from 'pptx-viewer-shared';
