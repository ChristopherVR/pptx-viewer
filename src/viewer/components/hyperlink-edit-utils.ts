import type {
  HyperlinkTargetType,
  HyperlinkEditData,
} from "./hyperlink-edit-types";
import {
  ACTION_VERB_MAP,
  ACTION_VERB_TO_PPACTION,
} from "./hyperlink-edit-types";

export function detectTargetType(
  url: string | undefined,
  action: string | undefined,
): HyperlinkTargetType {
  if (action && action.startsWith("ppaction://")) {
    if (action.includes("hlinksldjump")) return "slide";
    if (ACTION_VERB_MAP[action.toLowerCase()]) return "action";
    return "action";
  }
  if (!url) return "url";
  if (url.startsWith("mailto:")) return "email";
  if (/^[a-zA-Z]:\\|^\.\.?[/\\]|^file:/i.test(url)) return "file";
  return "url";
}

export function parseEmailUrl(url: string): {
  address: string;
  subject: string;
} {
  if (!url.startsWith("mailto:")) return { address: url, subject: "" };
  const withoutScheme = url.slice(7);
  const qIdx = withoutScheme.indexOf("?");
  if (qIdx < 0) return { address: withoutScheme, subject: "" };
  const address = withoutScheme.slice(0, qIdx);
  const params = new URLSearchParams(withoutScheme.slice(qIdx + 1));
  return { address, subject: params.get("subject") || "" };
}

export function parseSlideFromUrl(
  url: string | undefined,
  action: string | undefined,
): number {
  if (action === "ppaction://hlinksldjump" && url) {
    const match = url.match(/slide(\d+)\.xml$/i);
    if (match) return parseInt(match[1], 10);
  }
  if (url) {
    const hashMatch = url.match(/#\s*Slide\s+(\d+)/i);
    if (hashMatch) return parseInt(hashMatch[1], 10);
  }
  return 1;
}

/** Resolve hyperlink edit data to a URL string and optional action for the TextStyle. */
export function resolveHyperlinkEditResult(data: HyperlinkEditData): {
  url: string;
  action?: string;
  tooltip?: string;
} {
  const tooltip = data.tooltip.trim() || undefined;
  switch (data.targetType) {
    case "email": {
      const mailto = data.emailSubject
        ? `mailto:${data.emailAddress}?subject=${encodeURIComponent(data.emailSubject)}`
        : `mailto:${data.emailAddress}`;
      return { url: mailto, tooltip };
    }
    case "slide":
      return {
        url: `slide${data.slideNumber}.xml`,
        action: "ppaction://hlinksldjump",
        tooltip,
      };
    case "file":
      return { url: data.filePath, tooltip };
    case "action":
      return {
        url: "",
        action: ACTION_VERB_TO_PPACTION[data.actionVerb],
        tooltip,
      };
    case "url":
    default:
      return { url: data.url, tooltip };
  }
}
