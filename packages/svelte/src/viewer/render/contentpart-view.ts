/**
 * Thin shim over the shared `p:contentPart` ink view model.
 *
 * The logic used to live here, which meant Vue and Angular had no contentPart
 * renderer at all: they fell through to the "unsupported element" placeholder,
 * so a real inked slide showed a grey box in two of the five bindings. It now
 * lives in `pptx-viewer-shared` (`render/content-part-strokes`) and every
 * binding maps the same descriptors onto its own template.
 */
export {
	buildContentPartStrokes,
	contentPartViewBox,
	type ContentPartStrokeView,
} from 'pptx-viewer-shared';
