/**
 * PowerPoint's "Online Video" insert links a `media` element (`isLinked`,
 * G17) to a web page rather than an audio/video file: `mediaPath` ends up
 * the verbatim URL the author pasted (a YouTube/Vimeo watch page, a share
 * link, or the provider's own `/embed/` URL). A `<video src>` cannot play
 * any of these: the response is an HTML document, not a media stream, so
 * playback fails silently and the slide shows a blank/broken player.
 *
 * `resolveOnlineVideoEmbed` recognises the common web-video hosts and
 * normalises whatever URL form the deck carries into the provider's
 * iframe-embeddable URL, so a binding can render an `<iframe>` instead of a
 * `<video>` for exactly this case and nothing else (a normal linked MP4
 * still plays through `<video>`).
 *
 * @module render/online-video
 */
import type { PptxElement } from 'pptx-viewer-core';

/** What an online-video URL resolves to: the iframe-embeddable form. */
export interface OnlineVideoEmbed {
	embedUrl: string;
}

/**
 * The `<iframe allow="...">` Permissions Policy value every binding's
 * online-video embed uses, so a provider capability (fullscreen, PiP) reaches
 * all five at once instead of drifting per hand-ported copy.
 */
export const ONLINE_VIDEO_IFRAME_ALLOW =
	'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';

/**
 * The `<iframe sandbox="...">` value every binding's online-video embed uses.
 * YouTube/Vimeo's own player needs `allow-scripts` (it is a full web app) and
 * `allow-same-origin` (their own origin, never the host page's, so this does
 * not weaken the host); `allow-popups` covers the player's "Share"/"Watch on
 * YouTube" links, and `allow-presentation` its cast button. Deliberately
 * narrower than "no sandbox at all": still blocks top-level navigation and
 * form submission from the embedded page.
 */
export const ONLINE_VIDEO_IFRAME_SANDBOX =
	'allow-scripts allow-same-origin allow-popups allow-presentation';

/** Extract a YouTube video id from a `youtube.com`/`youtu.be` URL, in any of its common forms. */
function youtubeVideoId(url: URL): string | undefined {
	const host = url.hostname.replace(/^www\./, '').toLowerCase();
	if (host === 'youtu.be') {
		const id = url.pathname.split('/').filter(Boolean)[0];
		return id || undefined;
	}
	if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'youtube-nocookie.com') {
		return undefined;
	}
	if (url.pathname.startsWith('/embed/')) {
		return url.pathname.slice('/embed/'.length).split('/')[0] || undefined;
	}
	const watchId = url.searchParams.get('v');
	if (watchId) {
		return watchId;
	}
	const shortsMatch = /^\/shorts\/([^/]+)/.exec(url.pathname);
	if (shortsMatch) {
		return shortsMatch[1];
	}
	return undefined;
}

/** Extract a Vimeo video id from a `vimeo.com`/`player.vimeo.com` URL. */
function vimeoVideoId(url: URL): string | undefined {
	const host = url.hostname.replace(/^www\./, '').toLowerCase();
	if (host === 'player.vimeo.com') {
		const match = /^\/video\/(\d+)/.exec(url.pathname);
		return match?.[1];
	}
	if (host !== 'vimeo.com') {
		return undefined;
	}
	const match = /^\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)/.exec(url.pathname);
	return match?.[1];
}

/**
 * Resolve a linked media URL to an iframe-embeddable web-video URL, or
 * `undefined` when it is not a recognised web-video host (a plain linked
 * media file, which plays through `<video>`/`<audio>` as usual).
 *
 * Only meaningful for LINKED media: an embedded (`r:embed`) video is always
 * a real media file inside the package, never a web page.
 */
export function resolveOnlineVideoEmbed(
	mediaPath: string | undefined,
	isLinked: boolean | undefined,
): OnlineVideoEmbed | undefined {
	if (!isLinked || !mediaPath) {
		return undefined;
	}
	let url: URL;
	try {
		url = new URL(mediaPath);
	} catch {
		return undefined;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return undefined;
	}

	const youtubeId = youtubeVideoId(url);
	if (youtubeId) {
		return { embedUrl: `https://www.youtube.com/embed/${youtubeId}` };
	}
	const vimeoId = vimeoVideoId(url);
	if (vimeoId) {
		return { embedUrl: `https://player.vimeo.com/video/${vimeoId}` };
	}
	return undefined;
}

/**
 * Convenience wrapper over {@link resolveOnlineVideoEmbed} for a full
 * `PptxElement`: `undefined` for anything but a linked `media`/`video`
 * element whose URL resolves to a recognised web-video host.
 */
export function getOnlineVideoEmbed(element: PptxElement): OnlineVideoEmbed | undefined {
	if (element.type !== 'media' || element.mediaType !== 'video') {
		return undefined;
	}
	return resolveOnlineVideoEmbed(element.mediaPath, element.isLinked);
}
