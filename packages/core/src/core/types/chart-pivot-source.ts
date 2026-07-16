import type { XmlObject } from './common';

/** Editable classic ChartML `c:pivotSource` metadata. */
export interface PptxChartPivotSource {
	/** Pivot table reference stored as `c:name` text. */
	name: string;
	/** Required unsigned format identifier stored in `c:fmtId/@val`. */
	formatId: number;
	/** Internal source subtree used to preserve extensions and foreign markup. */
	rawXml?: XmlObject;
}
