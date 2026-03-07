import { XmlObject, type PptxPresentationProperties } from "../../types";

/**
 * Parse show properties (p:showPr) from presentation properties XML.
 * Returns partial presentation properties with show-related settings.
 */
export function parseShowProperties(
  showPr: XmlObject,
): Partial<PptxPresentationProperties> {
  const props: Partial<PptxPresentationProperties> = {};

  // Show type
  if (showPr["p:present"]) props.showType = "presented";
  else if (showPr["p:browse"]) props.showType = "browsed";
  else if (showPr["p:kiosk"]) props.showType = "kiosk";

  props.loopContinuously =
    showPr["@_loop"] === "1" || showPr["@_loop"] === true;
  props.showWithNarration = showPr["@_showNarration"] !== "0";
  props.showWithAnimation = showPr["@_showAnimation"] !== "0";

  // Advance mode
  if (showPr["@_useTimings"] === "0") {
    props.advanceMode = "manual";
  } else {
    props.advanceMode = "useTimings";
  }

  // Pen colour
  const penClr = showPr["p:penClr"] as XmlObject | undefined;
  if (penClr) {
    const srgbClr = penClr["a:srgbClr"] as XmlObject | undefined;
    if (srgbClr) {
      const val = String(srgbClr["@_val"] || "").trim();
      if (val.length > 0) props.penColor = `#${val}`;
    }
  }

  // Show slides range / custom show
  const sldRg = showPr["p:sldRg"] as XmlObject | undefined;
  const custShow = showPr["p:custShow"] as XmlObject | undefined;
  if (sldRg) {
    props.showSlidesMode = "range";
    const st = Number.parseInt(String(sldRg["@_st"] ?? "1"), 10);
    const end = Number.parseInt(String(sldRg["@_end"] ?? "1"), 10);
    if (Number.isFinite(st)) props.showSlidesFrom = st;
    if (Number.isFinite(end)) props.showSlidesTo = end;
  } else if (custShow) {
    props.showSlidesMode = "customShow";
    const csId = String(custShow["@_id"] ?? "").trim();
    if (csId.length > 0) props.showSlidesCustomShowId = csId;
  } else {
    props.showSlidesMode = "all";
  }

  return props;
}
