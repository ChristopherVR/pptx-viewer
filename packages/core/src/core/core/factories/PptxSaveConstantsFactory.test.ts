import { describe, it, expect } from 'vitest';

import { PptxSaveConstantsFactory, createPptxSaveConstants } from './PptxSaveConstantsFactory';

describe('pptxSaveConstantsFactory', () => {
	const factory = new PptxSaveConstantsFactory();

	describe('create() with transitional conformance', () => {
		it('returns transitional namespace URIs by default', () => {
			const constants = factory.create();
			expect(constants.conformance).toBe('transitional');
			expect(constants.slideRelationshipType).toContain('schemas.openxmlformats.org');
			expect(constants.relationshipsNamespace).toContain('schemas.openxmlformats.org');
		});

		it('returns transitional slide relationship type', () => {
			const constants = factory.create('transitional');
			expect(constants.slideRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide',
			);
		});

		it('returns transitional slide layout relationship type', () => {
			const constants = factory.create('transitional');
			expect(constants.slideLayoutRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout',
			);
		});

		it('returns transitional relationships namespace', () => {
			const constants = factory.create('transitional');
			expect(constants.relationshipsNamespace).toBe(
				'http://schemas.openxmlformats.org/package/2006/relationships',
			);
		});

		it('returns transitional image relationship type', () => {
			const constants = factory.create('transitional');
			expect(constants.slideImageRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
			);
		});

		it('returns transitional media relationship types', () => {
			const constants = factory.create('transitional');
			expect(constants.slideMediaRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/media',
			);
			expect(constants.slideVideoRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/video',
			);
			expect(constants.slideAudioRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/audio',
			);
		});

		it('returns transitional comment relationship type', () => {
			const constants = factory.create('transitional');
			expect(constants.slideCommentRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
			);
		});

		it('returns transitional notes relationship type', () => {
			const constants = factory.create('transitional');
			expect(constants.slideNotesRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide',
			);
		});

		it('returns transitional slide synchronization constants', () => {
			const constants = factory.create('transitional');
			expect(constants.slideSyncRelationshipType).toBe(
				'http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideSyncData',
			);
			expect(constants.slideSyncContentType).toContain('slideSyncData+xml');
		});
	});

	describe('create() with strict conformance', () => {
		it('returns strict relationship-type URIs but a conformance-independent OPC namespace', () => {
			const constants = factory.create('strict');
			expect(constants.conformance).toBe('strict');
			// Relationship *type* URIs (officeDocument family) switch to Strict.
			expect(constants.slideRelationshipType).toContain('purl.oclc.org');
			// The OPC relationships namespace (xmlns of .rels parts) is shared
			// across conformance classes and stays in its canonical form.
			expect(constants.relationshipsNamespace).toContain('schemas.openxmlformats.org');
		});

		it('returns strict slide relationship type', () => {
			const constants = factory.create('strict');
			expect(constants.slideRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/slide',
			);
		});

		it('returns strict slide layout relationship type', () => {
			const constants = factory.create('strict');
			expect(constants.slideLayoutRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/slideLayout',
			);
		});

		it('keeps the OPC relationships namespace fixed under strict conformance', () => {
			const constants = factory.create('strict');
			expect(constants.relationshipsNamespace).toBe(
				'http://schemas.openxmlformats.org/package/2006/relationships',
			);
		});

		it('uses the same OPC relationships namespace for both conformance classes', () => {
			expect(factory.create('strict').relationshipsNamespace).toBe(
				factory.create('transitional').relationshipsNamespace,
			);
		});

		it('returns strict image relationship type', () => {
			const constants = factory.create('strict');
			expect(constants.slideImageRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/image',
			);
		});

		it('returns strict media relationship types', () => {
			const constants = factory.create('strict');
			expect(constants.slideMediaRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/media',
			);
			expect(constants.slideVideoRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/video',
			);
			expect(constants.slideAudioRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/audio',
			);
		});

		it('returns strict comment relationship type', () => {
			const constants = factory.create('strict');
			expect(constants.slideCommentRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/comments',
			);
		});

		it('returns strict notes relationship type', () => {
			const constants = factory.create('strict');
			expect(constants.slideNotesRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/notesSlide',
			);
		});

		it('returns strict slide synchronization relationship type', () => {
			expect(factory.create('strict').slideSyncRelationshipType).toBe(
				'http://purl.oclc.org/ooxml/officeDocument/relationships/slideSyncData',
			);
		});

		it('uses the same content types for both conformance classes', () => {
			const strict = factory.create('strict');
			const transitional = factory.create('transitional');
			expect(strict.slideContentType).toBe(transitional.slideContentType);
			expect(strict.commentContentType).toBe(transitional.commentContentType);
			expect(strict.commentAuthorContentType).toBe(transitional.commentAuthorContentType);
			expect(strict.commentAuthorsPartName).toBe(transitional.commentAuthorsPartName);
			expect(strict.slideSyncContentType).toBe(transitional.slideSyncContentType);
		});
	});

	describe('default parameter', () => {
		it('defaults to transitional when no argument is provided', () => {
			const constants = factory.create();
			expect(constants.conformance).toBe('transitional');
		});

		it('defaults to transitional when undefined is passed', () => {
			const constants = factory.create(undefined);
			expect(constants.conformance).toBe('transitional');
		});
	});
});

describe('createPptxSaveConstants helper', () => {
	it('returns transitional constants by default', () => {
		const constants = createPptxSaveConstants();
		expect(constants.conformance).toBe('transitional');
		expect(constants.slideRelationshipType).toContain('schemas.openxmlformats.org');
	});

	it('returns strict constants when asked', () => {
		const constants = createPptxSaveConstants('strict');
		expect(constants.conformance).toBe('strict');
		expect(constants.slideRelationshipType).toContain('purl.oclc.org');
	});

	it('returns transitional constants when explicitly asked', () => {
		const constants = createPptxSaveConstants('transitional');
		expect(constants.conformance).toBe('transitional');
		expect(constants.slideRelationshipType).toContain('schemas.openxmlformats.org');
	});
});
