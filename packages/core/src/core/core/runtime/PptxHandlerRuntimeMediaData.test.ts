import { describe, it, expect } from 'vitest';

// ---------------------------------------------------------------------------
// Extracted logic from PptxHandlerRuntimeMediaData
// ---------------------------------------------------------------------------

const _EMU_PER_PX = 9525;

interface _XmlObject {
	[key: string]: unknown;
}

/**
 * Extracted from getImageData — determines whether a path should be
 * returned directly (URL or data URI).
 */
function isDirectReturnPath(imagePath: string): boolean {
	return (
		imagePath.startsWith('http://') ||
		imagePath.startsWith('https://') ||
		imagePath.startsWith('data:')
	);
}

/**
 * Extracted from getImageData — gets the file extension from a path.
 */
function getPathExtension(pathValue: string): string | undefined {
	const lastDot = pathValue.lastIndexOf('.');
	if (lastDot < 0) {
		return undefined;
	}
	return pathValue.substring(lastDot + 1).toLowerCase();
}

/**
 * Extracted from getImageData — determines the MIME type from the image path.
 */
function getImageMimeType(imagePath: string): string {
	const ext = getPathExtension(imagePath);
	switch (ext) {
		case 'png':
			return 'image/png';
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'gif':
			return 'image/gif';
		case 'bmp':
			return 'image/bmp';
		case 'tif':
		case 'tiff':
			return 'image/tiff';
		case 'svg':
			return 'image/svg+xml';
		case 'webp':
			return 'image/webp';
		case 'ico':
			return 'image/x-icon';
		default:
			return 'image/png';
	}
}

/**
 * Extracted from enrichMediaElementsWithTiming — applies timing data
 * to a media element.
 */
interface MediaTimingData {
	trimStartMs?: number;
	trimEndMs?: number;
	fullScreen?: boolean;
	loop?: boolean;
	volume?: number;
	fadeInDuration?: number;
	fadeOutDuration?: number;
	autoPlay?: boolean;
	playAcrossSlides?: boolean;
	hideWhenNotPlaying?: boolean;
	bookmarks?: Array<{ name: string; time: number }>;
	playbackSpeed?: number;
	posterFramePath?: string;
}

interface MockMediaElement {
	type: 'media';
	trimStartMs?: number;
	trimEndMs?: number;
	fullScreen?: boolean;
	loop?: boolean;
	volume?: number;
	fadeInDuration?: number;
	fadeOutDuration?: number;
	autoPlay?: boolean;
	playAcrossSlides?: boolean;
	hideWhenNotPlaying?: boolean;
	bookmarks?: Array<{ name: string; time: number }>;
	playbackSpeed?: number;
	posterFramePath?: string;
}

function applyTimingToElement(el: MockMediaElement, timing: MediaTimingData): void {
	if (timing.trimStartMs !== undefined) {
		el.trimStartMs = timing.trimStartMs;
	}
	if (timing.trimEndMs !== undefined) {
		el.trimEndMs = timing.trimEndMs;
	}
	if (timing.fullScreen !== undefined) {
		el.fullScreen = timing.fullScreen;
	}
	if (timing.loop !== undefined) {
		el.loop = timing.loop;
	}
	if (timing.volume !== undefined) {
		el.volume = timing.volume;
	}
	if (timing.fadeInDuration !== undefined) {
		el.fadeInDuration = timing.fadeInDuration;
	}
	if (timing.fadeOutDuration !== undefined) {
		el.fadeOutDuration = timing.fadeOutDuration;
	}
	if (timing.autoPlay !== undefined) {
		el.autoPlay = timing.autoPlay;
	}
	if (timing.playAcrossSlides !== undefined) {
		el.playAcrossSlides = timing.playAcrossSlides;
	}
	if (timing.hideWhenNotPlaying !== undefined) {
		el.hideWhenNotPlaying = timing.hideWhenNotPlaying;
	}
	if (timing.bookmarks !== undefined && timing.bookmarks.length > 0) {
		el.bookmarks = timing.bookmarks;
	}
	if (timing.playbackSpeed !== undefined) {
		el.playbackSpeed = timing.playbackSpeed;
	}
	if (timing.posterFramePath) {
		el.posterFramePath = timing.posterFramePath;
	}
}

// ---------------------------------------------------------------------------
// Tests: isDirectReturnPath
// ---------------------------------------------------------------------------
describe('isDirectReturnPath', () => {
	it('should return true for http:// URLs', () => {
		expect(isDirectReturnPath('http://example.com/image.png')).toBeTruthy();
	});

	it('should return true for https:// URLs', () => {
		expect(isDirectReturnPath('https://example.com/image.png')).toBeTruthy();
	});

	it('should return true for data: URIs', () => {
		expect(isDirectReturnPath('data:image/png;base64,abc123')).toBeTruthy();
	});

	it('should return false for archive paths', () => {
		expect(isDirectReturnPath('ppt/media/image1.png')).toBeFalsy();
	});

	it('should return false for empty string', () => {
		expect(isDirectReturnPath('')).toBeFalsy();
	});

	it('should return false for relative paths', () => {
		expect(isDirectReturnPath('../media/image1.png')).toBeFalsy();
	});

	it('should be case-sensitive (HTTP:// is not detected)', () => {
		expect(isDirectReturnPath('HTTP://example.com/img.png')).toBeFalsy();
	});
});

// ---------------------------------------------------------------------------
// Tests: getPathExtension
// ---------------------------------------------------------------------------
describe('getPathExtension', () => {
	it('should return the file extension', () => {
		expect(getPathExtension('image.png')).toBe('png');
	});

	it('should return lowercase extension', () => {
		expect(getPathExtension('photo.JPG')).toBe('jpg');
	});

	it('should return the last extension for multi-dot filenames', () => {
		expect(getPathExtension('archive.tar.gz')).toBe('gz');
	});

	it('should return undefined for paths without extension', () => {
		expect(getPathExtension('noextension')).toBeUndefined();
	});

	it('should handle paths with directories', () => {
		expect(getPathExtension('ppt/media/image1.emf')).toBe('emf');
	});

	it('should handle extensions after a dot-prefixed directory', () => {
		expect(getPathExtension('.hidden/file.txt')).toBe('txt');
	});
});

// ---------------------------------------------------------------------------
// Tests: getImageMimeType
// ---------------------------------------------------------------------------
describe('getImageMimeType', () => {
	it('should return image/png for .png', () => {
		expect(getImageMimeType('image.png')).toBe('image/png');
	});

	it('should return image/jpeg for .jpg', () => {
		expect(getImageMimeType('image.jpg')).toBe('image/jpeg');
	});

	it('should return image/jpeg for .jpeg', () => {
		expect(getImageMimeType('image.jpeg')).toBe('image/jpeg');
	});

	it('should return image/gif for .gif', () => {
		expect(getImageMimeType('image.gif')).toBe('image/gif');
	});

	it('should return image/bmp for .bmp', () => {
		expect(getImageMimeType('image.bmp')).toBe('image/bmp');
	});

	it('should return image/tiff for .tif', () => {
		expect(getImageMimeType('image.tif')).toBe('image/tiff');
	});

	it('should return image/tiff for .tiff', () => {
		expect(getImageMimeType('image.tiff')).toBe('image/tiff');
	});

	it('should return image/svg+xml for .svg', () => {
		expect(getImageMimeType('image.svg')).toBe('image/svg+xml');
	});

	it('should return image/webp for .webp', () => {
		expect(getImageMimeType('image.webp')).toBe('image/webp');
	});

	it('should return image/x-icon for .ico', () => {
		expect(getImageMimeType('favicon.ico')).toBe('image/x-icon');
	});

	it('should default to image/png for unknown extensions', () => {
		expect(getImageMimeType('file.xyz')).toBe('image/png');
	});

	it('should default to image/png for files without extension', () => {
		expect(getImageMimeType('noext')).toBe('image/png');
	});
});

// ---------------------------------------------------------------------------
// Tests: applyTimingToElement
// ---------------------------------------------------------------------------
describe('applyTimingToElement', () => {
	it('should apply trim start and end', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { trimStartMs: 1000, trimEndMs: 5000 });
		expect(el.trimStartMs).toBe(1000);
		expect(el.trimEndMs).toBe(5000);
	});

	it('should apply fullScreen flag', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { fullScreen: true });
		expect(el.fullScreen).toBeTruthy();
	});

	it('should apply loop flag', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { loop: true });
		expect(el.loop).toBeTruthy();
	});

	it('should apply volume', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { volume: 75 });
		expect(el.volume).toBe(75);
	});

	it('should apply fade in and out durations', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { fadeInDuration: 500, fadeOutDuration: 1000 });
		expect(el.fadeInDuration).toBe(500);
		expect(el.fadeOutDuration).toBe(1000);
	});

	it('should apply autoPlay', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { autoPlay: true });
		expect(el.autoPlay).toBeTruthy();
	});

	it('should apply playAcrossSlides', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { playAcrossSlides: true });
		expect(el.playAcrossSlides).toBeTruthy();
	});

	it('should apply hideWhenNotPlaying', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { hideWhenNotPlaying: true });
		expect(el.hideWhenNotPlaying).toBeTruthy();
	});

	it('should apply bookmarks when non-empty', () => {
		const el: MockMediaElement = { type: 'media' };
		const bookmarks = [{ name: 'Start', time: 0 }];
		applyTimingToElement(el, { bookmarks });
		expect(el.bookmarks).toStrictEqual(bookmarks);
	});

	it('should not apply empty bookmarks array', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { bookmarks: [] });
		expect(el.bookmarks).toBeUndefined();
	});

	it('should apply playbackSpeed', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { playbackSpeed: 1.5 });
		expect(el.playbackSpeed).toBe(1.5);
	});

	it('should apply posterFramePath', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, { posterFramePath: 'ppt/media/poster.png' });
		expect(el.posterFramePath).toBe('ppt/media/poster.png');
	});

	it('should not overwrite properties when timing values are undefined', () => {
		const el: MockMediaElement = {
			type: 'media',
			trimStartMs: 100,
			volume: 50,
		};
		applyTimingToElement(el, {});
		expect(el.trimStartMs).toBe(100);
		expect(el.volume).toBe(50);
	});

	it('should apply all timing properties at once', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, {
			trimStartMs: 0,
			trimEndMs: 10000,
			fullScreen: false,
			loop: true,
			volume: 80,
			fadeInDuration: 200,
			fadeOutDuration: 300,
			autoPlay: true,
			playAcrossSlides: false,
			hideWhenNotPlaying: true,
			bookmarks: [{ name: 'B1', time: 500 }],
			playbackSpeed: 2,
			posterFramePath: 'ppt/media/poster.jpg',
		});

		expect(el.trimStartMs).toBe(0);
		expect(el.trimEndMs).toBe(10000);
		expect(el.fullScreen).toBeFalsy();
		expect(el.loop).toBeTruthy();
		expect(el.volume).toBe(80);
		expect(el.fadeInDuration).toBe(200);
		expect(el.fadeOutDuration).toBe(300);
		expect(el.autoPlay).toBeTruthy();
		expect(el.playAcrossSlides).toBeFalsy();
		expect(el.hideWhenNotPlaying).toBeTruthy();
		expect(el.bookmarks).toStrictEqual([{ name: 'B1', time: 500 }]);
		expect(el.playbackSpeed).toBe(2);
		expect(el.posterFramePath).toBe('ppt/media/poster.jpg');
	});

	it('should handle zero values for numeric fields', () => {
		const el: MockMediaElement = { type: 'media' };
		applyTimingToElement(el, {
			trimStartMs: 0,
			trimEndMs: 0,
			volume: 0,
			fadeInDuration: 0,
			fadeOutDuration: 0,
			playbackSpeed: 0,
		});
		expect(el.trimStartMs).toBe(0);
		expect(el.trimEndMs).toBe(0);
		expect(el.volume).toBe(0);
		expect(el.fadeInDuration).toBe(0);
		expect(el.fadeOutDuration).toBe(0);
		expect(el.playbackSpeed).toBe(0);
	});
});
