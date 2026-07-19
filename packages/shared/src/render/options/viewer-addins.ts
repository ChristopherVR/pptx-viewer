/**
 * Options > Add-ins pane model: the viewer's optional capability modules,
 * presented the way PowerPoint lists COM add-ins (name / location / type,
 * grouped by active state). Bindings supply the runtime availability flags.
 */

export type ViewerAddinType = 'renderer' | 'converter' | 'collaboration' | 'localization';

export interface ViewerAddinDefinition {
	id: string;
	nameKey: string;
	descriptionKey: string;
	type: ViewerAddinType;
	/** Package or module the capability ships in. */
	location: string;
}

export interface ViewerAddinStatus {
	/** Addin id -> whether the capability is active in this host. */
	[addinId: string]: boolean | undefined;
}

export interface ViewerAddinRow extends ViewerAddinDefinition {
	active: boolean;
}

export const VIEWER_ADDIN_CATALOG: readonly ViewerAddinDefinition[] = [
	{
		id: 'smartArt3d',
		nameKey: 'pptx.options.addIns.smartArt3d',
		descriptionKey: 'pptx.options.addIns.smartArt3dDescription',
		type: 'renderer',
		location: 'pptx-viewer-shared/smartart-3d',
	},
	{
		id: 'model3d',
		nameKey: 'pptx.options.addIns.model3d',
		descriptionKey: 'pptx.options.addIns.model3dDescription',
		type: 'renderer',
		location: 'pptx-viewer-shared (three)',
	},
	{
		id: 'emfConverter',
		nameKey: 'pptx.options.addIns.emfConverter',
		descriptionKey: 'pptx.options.addIns.emfConverterDescription',
		type: 'converter',
		location: 'emf-converter',
	},
	{
		id: 'mtxDecompressor',
		nameKey: 'pptx.options.addIns.mtxDecompressor',
		descriptionKey: 'pptx.options.addIns.mtxDecompressorDescription',
		type: 'converter',
		location: 'mtx-decompressor',
	},
	{
		id: 'collaboration',
		nameKey: 'pptx.options.addIns.collaboration',
		descriptionKey: 'pptx.options.addIns.collaborationDescription',
		type: 'collaboration',
		location: 'pptx-viewer-shared (collaboration)',
	},
	{
		id: 'locales',
		nameKey: 'pptx.options.addIns.locales',
		descriptionKey: 'pptx.options.addIns.localesDescription',
		type: 'localization',
		location: 'pptx-viewer-locales',
	},
];

/** Rows for the Add-ins table, split into active/inactive by the host's status flags. */
export function resolveViewerAddinRows(status?: ViewerAddinStatus): ViewerAddinRow[] {
	return VIEWER_ADDIN_CATALOG.map((definition) => ({
		...definition,
		active: status?.[definition.id] ?? true,
	}));
}
