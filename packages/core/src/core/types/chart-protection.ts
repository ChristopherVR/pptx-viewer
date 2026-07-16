import type { XmlObject } from './common';

/** Editable classic ChartML `c:protection` settings. */
export interface PptxChartProtection {
	/** Prevent editing the chart object. */
	chartObject?: boolean | null;
	/** Prevent editing the chart data. */
	data?: boolean | null;
	/** Prevent editing chart formatting. */
	formatting?: boolean | null;
	/** Prevent selecting chart elements. */
	selection?: boolean | null;
	/** Prevent chart user-interface operations. */
	userInterface?: boolean | null;
	/** Internal source subtree used to preserve foreign markup during edits. */
	rawXml?: XmlObject;
}
