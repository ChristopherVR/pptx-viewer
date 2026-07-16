import type { XmlObject } from './common';

export interface PptxChartPivotFormat {
	index: number;
	shapePropertiesXml?: XmlObject | null;
	markerXml?: XmlObject | null;
	dataLabelXml?: XmlObject | null;
	extensionListXml?: XmlObject | null;
	rawXml?: XmlObject;
}

/** Editable classic ChartML `c:pivotFmts` collection. */
export interface PptxChartPivotFormats {
	formats: PptxChartPivotFormat[];
	rawXml?: XmlObject;
}
