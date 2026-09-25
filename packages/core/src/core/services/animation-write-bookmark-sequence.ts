/**
 * Write side of a media-bookmark trigger ("Trigger > On Bookmark").
 *
 * PowerPoint's own SaveAs (COM-authored with
 * `Sequence.AddTriggerEffect(shape, effect, msoAnimTriggerOnMediaBookmark,
 * media, "BM1")`) writes each bookmark trigger as its own interactive
 * sequence, gated at both ends on the bookmark:
 *
 * ```xml
 * <p:seq concurrent="1" nextAc="seek">
 *   <p:cTn id="8" restart="whenNotActive" fill="hold" evtFilter="cancelBubble"
 *          nodeType="interactiveSeq">
 *     <p:stCondLst><p:cond evt="onMediaBookmark" delay="0">
 *       <p:tgtEl><p14:bmkTgt spid="2" bmkName="BM1"/></p:tgtEl>
 *     </p:cond></p:stCondLst>
 *     <p:endSync evt="end" delay="0"><p:rtn val="all"/></p:endSync>
 *     <p:childTnLst>...the click group...</p:childTnLst>
 *   </p:cTn>
 *   <p:nextCondLst><p:cond evt="onMediaBookmark" delay="0">
 *     <p:tgtEl><p14:bmkTgt spid="2" bmkName="BM1"/></p:tgtEl>
 *   </p:cond></p:nextCondLst>
 * </p:seq>
 * ```
 *
 * The `p14:bmkTgt` forces the whole `p:timing` into an `mc:AlternateContent`
 * envelope on save (`slide-timing-reconcile`).
 *
 * @module services/animation-write-bookmark-sequence
 */
import type { PptxElementAnimation, XmlObject } from '../types';

/** The media element and bookmark a bookmark-triggered effect waits for. */
export interface BookmarkTriggerKey {
	/** Native `p:cNvPr/@id` of the media element. */
	shapeId: string;
	/** The bookmark's name (`p14:bmk/@name`). */
	bookmarkName: string;
}

/** The bookmark trigger an editor animation asks for, when complete. */
export function bookmarkTriggerOf(anim: PptxElementAnimation): BookmarkTriggerKey | undefined {
	if (anim.trigger !== 'onMediaBookmark' || !anim.triggerShapeId || !anim.triggerBookmark) {
		return undefined;
	}
	return { shapeId: anim.triggerShapeId, bookmarkName: anim.triggerBookmark };
}

function bookmarkCondition(key: BookmarkTriggerKey): XmlObject {
	return {
		'@_evt': 'onMediaBookmark',
		'@_delay': '0',
		'p:tgtEl': { 'p14:bmkTgt': { '@_spid': key.shapeId, '@_bmkName': key.bookmarkName } },
	};
}

/** Wrap effect nodes in the bookmark-gated `p:seq` PowerPoint writes. */
export function wrapInBookmarkSequence(
	effectNodes: XmlObject[],
	key: BookmarkTriggerKey,
	allocateId: () => number,
): XmlObject {
	const seqId = allocateId();
	const groupId = allocateId();
	return {
		'@_concurrent': '1',
		'@_nextAc': 'seek',
		'p:cTn': {
			'@_id': String(seqId),
			'@_restart': 'whenNotActive',
			'@_fill': 'hold',
			'@_evtFilter': 'cancelBubble',
			'@_nodeType': 'interactiveSeq',
			'p:stCondLst': { 'p:cond': bookmarkCondition(key) },
			'p:endSync': { '@_evt': 'end', '@_delay': '0', 'p:rtn': { '@_val': 'all' } },
			'p:childTnLst': {
				'p:par': {
					'p:cTn': {
						'@_id': String(groupId),
						'@_fill': 'hold',
						'p:stCondLst': { 'p:cond': { '@_delay': '0' } },
						'p:childTnLst': {
							'p:par': effectNodes.length === 1 ? effectNodes[0] : effectNodes,
						},
					},
				},
			},
		},
		'p:nextCondLst': { 'p:cond': bookmarkCondition(key) },
	};
}

/** One bookmark `p:seq` per distinct media element + bookmark pair. */
export function buildBookmarkSequences(
	animations: PptxElementAnimation[],
	buildEffects: (anim: PptxElementAnimation) => XmlObject[],
	allocateId: () => number,
): XmlObject[] {
	const byKey = new Map<string, { key: BookmarkTriggerKey; anims: PptxElementAnimation[] }>();
	for (const anim of animations) {
		const key = bookmarkTriggerOf(anim);
		if (!key) {
			continue;
		}
		const id = `${key.shapeId}\u0000${key.bookmarkName}`;
		const entry = byKey.get(id) ?? { key, anims: [] };
		entry.anims.push(anim);
		byKey.set(id, entry);
	}
	const seqNodes: XmlObject[] = [];
	for (const { key, anims } of byKey.values()) {
		const effectNodes = anims.flatMap((anim) => buildEffects(anim));
		if (effectNodes.length > 0) {
			seqNodes.push(wrapInBookmarkSequence(effectNodes, key, allocateId));
		}
	}
	return seqNodes;
}
