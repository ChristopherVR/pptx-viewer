/**
 * Document-level `pointerdown` handling for popups that close on an outside press.
 *
 * Adding a listener per popup straight to the document pins every popup (and, through the
 * closure, the whole ribbon it lives in) for the lifetime of the document, because nothing removes
 * it when the viewer is destroyed. Here one shared listener per document holds only weak references
 * to the handlers; each handler is kept alive by the owner element it belongs to, so it disappears
 * together with that element and no explicit teardown is needed.
 */
type PointerHandler = (event: PointerEvent) => void;

const registries = new WeakMap<Document, Set<WeakRef<PointerHandler>>>();
const keepAlive = new WeakMap<Element, PointerHandler[]>();

export function onDocumentPointerDown(
	doc: Document,
	owner: Element,
	handler: PointerHandler,
): void {
	// The owner holds its handlers strongly (an ephemeron: the handler's own reference back to the
	// owner does not keep the owner alive), the document registry only weakly.
	const own = keepAlive.get(owner) ?? [];
	own.push(handler);
	keepAlive.set(owner, own);

	let registry = registries.get(doc);
	if (!registry) {
		const created = new Set<WeakRef<PointerHandler>>();
		registry = created;
		registries.set(doc, created);
		doc.addEventListener('pointerdown', (event) => {
			for (const ref of created) {
				const live = ref.deref();
				if (live) {
					live(event as PointerEvent);
				} else {
					created.delete(ref);
				}
			}
		});
	}
	registry.add(new WeakRef(handler));
}
