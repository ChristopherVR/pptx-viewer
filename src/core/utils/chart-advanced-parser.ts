import type {
  PptxChartTrendline,
  PptxChartTrendlineType,
  PptxChartErrBars,
  PptxChartErrBarDir,
  PptxChartErrBarType,
  PptxChartErrValType,
  PptxChartDataTable,
  PptxChartLineStyle,
  XmlObject,
} from "../types";

interface XmlLookupLike {
  getChildByLocalName(
    parent: XmlObject | undefined,
    name: string,
  ): XmlObject | undefined;
  getChildrenArrayByLocalName(
    parent: XmlObject | undefined,
    name: string,
  ): XmlObject[];
}

interface ColorParserLike {
  parseColor(
    fillNode: XmlObject | undefined,
    placeholderColor?: string,
  ): string | undefined;
}

const TRENDLINE_TYPE_MAP: Record<string, PptxChartTrendlineType> = {
  linear: "linear",
  exp: "exponential",
  log: "logarithmic",
  poly: "polynomial",
  power: "power",
  movingAvg: "movingAvg",
};

const ERR_BAR_TYPE_MAP: Record<string, PptxChartErrBarType> = {
  both: "both",
  minus: "minus",
  plus: "plus",
};

const ERR_VAL_TYPE_MAP: Record<string, PptxChartErrValType> = {
  cust: "cust",
  fixedVal: "fixedVal",
  percentage: "percentage",
  stdDev: "stdDev",
  stdErr: "stdErr",
};

function safeInt(val: unknown): number | undefined {
  const n = parseInt(String(val), 10);
  return Number.isFinite(n) ? n : undefined;
}

function safeFloat(val: unknown): number | undefined {
  const n = parseFloat(String(val));
  return Number.isFinite(n) ? n : undefined;
}

export function parseSeriesTrendlines(
  seriesNode: XmlObject,
  xmlLookup: XmlLookupLike,
  colorParser: ColorParserLike,
): PptxChartTrendline[] {
  const trendlineNodes = xmlLookup.getChildrenArrayByLocalName(
    seriesNode,
    "trendline",
  );
  if (trendlineNodes.length === 0) return [];

  return trendlineNodes
    .map((node): PptxChartTrendline | undefined => {
      const typeNode = xmlLookup.getChildByLocalName(node, "trendlineType");
      const rawType = String(typeNode?.["@_val"] || "").trim();
      const trendlineType = TRENDLINE_TYPE_MAP[rawType];
      if (!trendlineType) return undefined;

      const result: PptxChartTrendline = { trendlineType };

      const orderVal = safeInt(
        xmlLookup.getChildByLocalName(node, "order")?.["@_val"],
      );
      if (orderVal !== undefined) result.order = orderVal;

      const periodVal = safeInt(
        xmlLookup.getChildByLocalName(node, "period")?.["@_val"],
      );
      if (periodVal !== undefined) result.period = periodVal;

      const fwdVal = safeFloat(
        xmlLookup.getChildByLocalName(node, "forward")?.["@_val"],
      );
      if (fwdVal !== undefined) result.forward = fwdVal;

      const bkwdVal = safeFloat(
        xmlLookup.getChildByLocalName(node, "backward")?.["@_val"],
      );
      if (bkwdVal !== undefined) result.backward = bkwdVal;

      const interceptVal = safeFloat(
        xmlLookup.getChildByLocalName(node, "intercept")?.["@_val"],
      );
      if (interceptVal !== undefined) result.intercept = interceptVal;

      const dispRSq = xmlLookup.getChildByLocalName(node, "dispRSqr");
      if (dispRSq?.["@_val"] === "1" || dispRSq?.["@_val"] === true) {
        result.displayRSq = true;
      }

      const dispEq = xmlLookup.getChildByLocalName(node, "dispEq");
      if (dispEq?.["@_val"] === "1" || dispEq?.["@_val"] === true) {
        result.displayEq = true;
      }

      const spPr = xmlLookup.getChildByLocalName(node, "spPr");
      const lineColor = colorParser.parseColor(
        xmlLookup.getChildByLocalName(spPr, "solidFill"),
      );
      if (lineColor) result.color = lineColor;

      return result;
    })
    .filter((t): t is PptxChartTrendline => t !== undefined);
}

export function parseSeriesErrBars(
  seriesNode: XmlObject,
  xmlLookup: XmlLookupLike,
  extractPointValues: (
    container: XmlObject | undefined,
    preferNumeric: boolean,
  ) => string[],
): PptxChartErrBars[] {
  const errBarsNodes = xmlLookup.getChildrenArrayByLocalName(
    seriesNode,
    "errBars",
  );
  if (errBarsNodes.length === 0) return [];

  return errBarsNodes
    .map((node): PptxChartErrBars | undefined => {
      const errDirNode = xmlLookup.getChildByLocalName(node, "errDir");
      const rawDir = String(errDirNode?.["@_val"] || "y").trim();
      const direction: PptxChartErrBarDir = rawDir === "x" ? "x" : "y";

      const errBarTypeNode = xmlLookup.getChildByLocalName(node, "errBarType");
      const rawBarType = String(errBarTypeNode?.["@_val"] || "both").trim();
      const barType = ERR_BAR_TYPE_MAP[rawBarType] ?? "both";

      const errValTypeNode = xmlLookup.getChildByLocalName(node, "errValType");
      const rawValType = String(errValTypeNode?.["@_val"] || "").trim();
      const valType = ERR_VAL_TYPE_MAP[rawValType];
      if (!valType) return undefined;

      const result: PptxChartErrBars = { direction, barType, valType };

      const valNode = xmlLookup.getChildByLocalName(node, "val");
      const numVal = safeFloat(valNode?.["@_val"]);
      if (numVal !== undefined) result.val = numVal;

      if (valType === "cust") {
        const plusNode = xmlLookup.getChildByLocalName(node, "plus");
        const plusValues = extractPointValues(plusNode, true)
          .map((v) => parseFloat(v))
          .filter((v) => Number.isFinite(v));
        if (plusValues.length > 0) result.customPlus = plusValues;

        const minusNode = xmlLookup.getChildByLocalName(node, "minus");
        const minusValues = extractPointValues(minusNode, true)
          .map((v) => parseFloat(v))
          .filter((v) => Number.isFinite(v));
        if (minusValues.length > 0) result.customMinus = minusValues;
      }

      return result;
    })
    .filter((e): e is PptxChartErrBars => e !== undefined);
}

export function parseDataTable(
  plotArea: XmlObject,
  xmlLookup: XmlLookupLike,
): PptxChartDataTable | undefined {
  const dTable = xmlLookup.getChildByLocalName(plotArea, "dTable");
  if (!dTable) return undefined;

  const result: PptxChartDataTable = {};
  let hasProps = false;

  const hBorder = xmlLookup.getChildByLocalName(dTable, "showHorzBorder");
  if (hBorder?.["@_val"] === "1" || hBorder?.["@_val"] === true) {
    result.showHorzBorder = true;
    hasProps = true;
  }

  const vBorder = xmlLookup.getChildByLocalName(dTable, "showVertBorder");
  if (vBorder?.["@_val"] === "1" || vBorder?.["@_val"] === true) {
    result.showVertBorder = true;
    hasProps = true;
  }

  const outline = xmlLookup.getChildByLocalName(dTable, "showOutline");
  if (outline?.["@_val"] === "1" || outline?.["@_val"] === true) {
    result.showOutline = true;
    hasProps = true;
  }

  const keys = xmlLookup.getChildByLocalName(dTable, "showKeys");
  if (keys?.["@_val"] === "1" || keys?.["@_val"] === true) {
    result.showKeys = true;
    hasProps = true;
  }

  return hasProps
    ? result
    : {
        showHorzBorder: true,
        showVertBorder: true,
        showOutline: true,
        showKeys: true,
      };
}

export function parseLineStyle(
  container: XmlObject | undefined,
  elementName: string,
  xmlLookup: XmlLookupLike,
  colorParser: ColorParserLike,
): PptxChartLineStyle | undefined {
  if (!container) return undefined;
  const lineNode = xmlLookup.getChildByLocalName(container, elementName);
  if (!lineNode) return undefined;

  const result: PptxChartLineStyle = {};
  const spPr = xmlLookup.getChildByLocalName(lineNode, "spPr");
  if (spPr) {
    const lnNode = xmlLookup.getChildByLocalName(spPr, "ln");
    if (lnNode) {
      const solidFill = xmlLookup.getChildByLocalName(lnNode, "solidFill");
      const lineColor = colorParser.parseColor(solidFill);
      if (lineColor) result.color = lineColor;

      const widthEmu = safeInt(lnNode["@_w"]);
      if (widthEmu !== undefined) {
        result.width = widthEmu / 12700;
      }

      const prstDash = xmlLookup.getChildByLocalName(lnNode, "prstDash");
      if (prstDash?.["@_val"]) {
        result.dashStyle = String(prstDash["@_val"]);
      }
    }
  }

  return result;
}
