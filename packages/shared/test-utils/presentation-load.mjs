import { vi } from 'vitest';

const PNG =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
/** Small real OOXML archives, parsed normally by each binding under test. */
export async function presentationLoadFixtures(Handler, asset = 'image') {
	async function deck(title, image) {
		const { handler, createSlide } = await Handler.create({ title, initialSlideCount: 0 });
		try {
			const slide = createSlide('Blank').addText(title, {
				x: 50,
				y: 50,
				width: 400,
				height: 60,
			});
			if (image && asset === 'image') {
				slide.addImage(PNG, { x: 50, y: 150, width: 100, height: 100 });
			}
			if (asset === 'media') {
				slide.addMedia(
					'audio',
					'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
					{ x: 50, y: 150, width: 100, height: 100 },
				);
			}
			return await handler.save([slide.build()]);
		} finally {
			handler.dispose();
		}
	}
	return { first: await deck('Presentation A', true), second: await deck('Presentation B', false) };
}
/** Delay a real asset read after parsing, without replacing parsed slides. */
export function holdPresentationAsset(Handler, asset = 'image') {
	let release;
	const gate = new Promise((resolve) => {
		release = resolve;
	});
	let started;
	const entered = new Promise((resolve) => {
		started = resolve;
	});
	const owner = {};
	let dispose;
	function delay(read) {
		return async function (path) {
			if (!owner.handler) {
				owner.handler = this;
				dispose = vi.spyOn(this, 'dispose');
				started();
			}
			if (this === owner.handler) {
				await gate;
			}
			return read.call(this, path);
		};
	}
	if (asset === 'image') {
		const read = Handler.prototype.getImageData;
		vi.spyOn(Handler.prototype, 'getImageData').mockImplementation(delay(read));
	} else {
		const read = Handler.prototype.getMediaArrayBuffer;
		vi.spyOn(Handler.prototype, 'getMediaArrayBuffer').mockImplementation(delay(read));
	}
	return {
		entered,
		release,
		get handler() {
			return owner.handler;
		},
		get disposal() {
			return dispose;
		},
	};
}
export function editPresentation(slides) {
	return slides.map((slide) => ({ ...slide, notes: 'Unsaved edit in B' }));
}
/** Drain the async image/table stages after a held read has been released. */
export async function settlePresentationLoad() {
	for (let i = 0; i < 20; i++) {
		await new Promise((resolve) => {
			setTimeout(resolve, 0);
		});
	}
}
