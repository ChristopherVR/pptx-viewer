/** The type of hyperlink target. */
export type HyperlinkTargetType = "url" | "email" | "slide" | "file" | "action";

/** Supported action verbs for action hyperlinks. */
export type HyperlinkActionVerb =
  | "nextSlide"
  | "prevSlide"
  | "firstSlide"
  | "lastSlide"
  | "endShow";

/** Data model for the hyperlink editor dialog. */
export interface HyperlinkEditData {
  targetType: HyperlinkTargetType;
  url: string;
  tooltip: string;
  emailAddress: string;
  emailSubject: string;
  slideNumber: number;
  filePath: string;
  actionVerb: HyperlinkActionVerb;
}

export interface HyperlinkEditDialogProps {
  open: boolean;
  initialUrl?: string;
  initialTooltip?: string;
  initialAction?: string;
  slideCount: number;
  onConfirm: (data: HyperlinkEditData) => void;
  onCancel: () => void;
}

export const ACTION_VERB_MAP: Record<string, HyperlinkActionVerb> = {
  "ppaction://hlinkshowjump?jump=nextslide": "nextSlide",
  "ppaction://hlinkshowjump?jump=previousslide": "prevSlide",
  "ppaction://hlinkshowjump?jump=firstslide": "firstSlide",
  "ppaction://hlinkshowjump?jump=lastslide": "lastSlide",
  "ppaction://hlinkshowjump?jump=endshow": "endShow",
};

export const ACTION_VERB_TO_PPACTION: Record<HyperlinkActionVerb, string> = {
  nextSlide: "ppaction://hlinkshowjump?jump=nextslide",
  prevSlide: "ppaction://hlinkshowjump?jump=previousslide",
  firstSlide: "ppaction://hlinkshowjump?jump=firstslide",
  lastSlide: "ppaction://hlinkshowjump?jump=lastslide",
  endShow: "ppaction://hlinkshowjump?jump=endshow",
};
