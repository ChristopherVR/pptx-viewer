---
title: Einschrankungen
description: Was im Core-Engine und den Viewer-Bindungen nicht unterstuzt wird - vor der Einfuhrung lesen.
---

# Einschrankungen

::: warning Vor der Einfuhrung lesen
`pptx-viewer` deckt einen grossen Teil der OpenXML-Spezifikation ab, aber einiges ist approximiert, schreibgeschutzt oder durch die Browser-Plattform begrenzt. Diese Seite listet nur auf, was Sie **nicht** oder nur teilweise tun konnen. Alles andere ladt, bearbeitet, rendert und speichert einwandfrei; siehe [OpenXML-Konformitat](/architecture/openxml-conformance) fur das formale Abdeckungsmanifest.
:::

## Core-Engine (`pptx-viewer-core`)

- **`.ppt`-Hyperlinks, OLE-Einbettungen und nicht unterstuetzte Elemente** - Tinte und SmartArt werden weiterhin als gerastertes Bild exportiert: PowerPoint haelt beide ueber eine undokumentierte Formeigenschaft (`OfficeArtTertiaryFOPT`-ID `0x3A9`) tatsaechlich bearbeitbar, was ein Versuch, die Struktur von Grund auf nachzubauen, nicht reproduzieren konnte. Diagramme werden ebenfalls als Bild exportiert, was PowerPoints eigener Obergrenze entspricht: es bettet ein altes MS-Graph-Objekt ohne oeffentliche Spezifikation ein, daher ist das native Schreiben nicht geplant; 3D-Modelle degradieren genauso wie PowerPoints eigener Export, das ist also keine Luecke. Hyperlinks, Klickaktionen, OLE-Einbettungen und WAV-Audio werden verlustfrei uebernommen; siehe [OpenXML-Konformitaet](/architecture/openxml-conformance#ppt-export-ceiling) fuer die Messbelege.
- **SmartArt-Layout** - Ist die vorberechnete Zeichnung von PowerPoint vorhanden, wird genau dieses Layout verwendet. Andernfalls baut ein DiagramML-Interpreter es nach und trifft PowerPoints Formenmenge bei 226 von 227 gemessenen Galerie-Fixtures sowie dessen Geometrie auf 1 % bei den Familien Kreis, Radial, Hierarchie und Pyramide. Noch offen: exakte Schriftgroessen bei mehrteiligen Elementvorlagen, tiefe Organigramme jenseits der dritten Generation, die Spur der Schlangen-Verbinder und ein Leerabsatz im Preset Bubble Picture List; siehe [OpenXML-Konformitaet](/architecture/openxml-conformance#smartart-layout-ground-truth) fuer die Messbelege.

### Animationserstellung

Ein im Animationsbereich erstellter Effekt wird in den bestehenden `p:timing`-Baum der Folie eingefugt; die vorhandenen Effekte bleiben byte-identisch. Alle 27 SMIL-Filterfamilien (`p:animEffect/@filter`) rendern einen echten Effekt, der PowerPoints eigener Wiedergabe entspricht, einschliesslich `pixelate`, das standardmassig genau das Verhalten zeigt, das PowerPoint selbst zeigt (sofortiger Sprung zum Endzustand); siehe [Visuelle Effekttreue](/guide/visual-effects) fur die Belege. `image`, die 27. Familie, ist ebenfalls keine Lucke: siehe [OpenXML-Konformitat](/architecture/openxml-conformance).

### Lucken zur Laufzeit erkennen

Die Ladepipeline meldet jede nicht unterstutzte oder approximierte Konstruktion in `data.warnings`, typisiert als `PptxCompatibilityWarning` (mit `code`, `severity`, `scope`, optional `slideId`/`elementId`/`xmlPath`). Prufen Sie `data.warnings` nach `load()` (und nach `save()`), wenn Ihre Anwendung Nutzern Genauigkeitshinweise anzeigen oder Funktionen pro Datei sperren soll.

## Laufzeitumgebungen

- **Browser** - Voller Funktionsumfang: Parsen, Rendern, Bearbeiten, Export, Zusammenarbeit.
- **Node.js (und Serverless)** - Nur Core: `pptx-viewer-core` ist DOM-frei (Laden, Bearbeiten, Speichern, Markdown/SVG-Konvertierung, Verschlusselung). Die UI-Bindungen, der Raster-Export (`html2canvas`) und die EMF/WMF-Konvertierung sind Browser-Funktionen.
- **Web Worker** - Gleicher Umfang wie Node.js: die Engine hat keine DOM-Abhangigkeit.

## Framework-Viewer (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning CSS-basiertes Rendering tauscht einige visuelle Effekte gegen Fidelitat an anderer Stelle
Folien werden als HTML/CSS statt als Canvas gerendert, was scharfen Text bei jedem Zoom, native Barrierefreiheit und DOM-Interaktivitat ergibt. Der Kompromiss: einige PowerPoint-Effekte haben kein exaktes CSS-Aquivalent und werden approximiert.
:::

### Visuelle Effekt-Annaherungen

- **3D-Formen und -Szenen (`a:sp3d`/`a:scene3d`)** - Kamerapresets, explizite `a:camera`-Ueberschreibungen (einzeln und kombiniert), Extrusionsflaechen, Beleuchtungs-Rigs, Abschraegungsprofile und Materialien sind alle per COM gemessen und als exakte CSS/SVG-Technik umgesetzt (`matrix3d`-Homographien, `translateZ`-Seitenflaechen, ein SVG-Beleuchtungsfilter). Zwei Luecken bleiben: drei Abschraegungsprofile (`relaxedInset`, `slope`, `hardEdge`) zeigen einen Hell-dann-Dunkel-Doppeluebergang im Querschnitt, den das einzelne monotone Hoehenmodell nicht vollstaendig nachbilden kann, sowie ein Kopplungsfehler zwischen Specular- und Diffus-Elevation, der nach der COM-Kalibrierung der Rig-Elevation auftrat: `metal` uebersaettigt, und `matte`s mittlerer Helligkeitsfehler steigt bei hoher Elevation auf rund 47,4. Siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die vollstaendigen Messbelege.
- **WordArt-Textverformungen** - Die Umriss-Verformung pro Buchstabe (eine exakte, punktweise Verformung des echten Vektorumrisses, wenn die Schriftdatei verfuegbar ist) und die vertikale Huellkurve sind gemessen und fertig. Zwei Naeherungen bleiben: PowerPoint verteilt Huellkurven-Buchstaben randbuendig ueber den Kasten, und obwohl dieser Renderer das inzwischen durch Dehnen der Zeile nachbildet, behalten die `can`-Presets jeden Buchstaben bei seiner natuerlichen (ungedehnten) Laufweite, was einen Restfehler von ~5,3-18,5 % hinterlaesst, den kein alternatives horizontales Modell schliessen konnte; und ohne verfuegbare Schriftdatei tritt eine affine Anpassung pro Buchstabe an die Stelle der exakten Umriss-Verformung, mit einer Genauigkeit von etwa 1-2 % bei gewoehnlichen Bildunterschriften. Siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die vollstaendigen Messbelege.

## EMF/WMF-Metadateien (`emf-converter`-Abhaengigkeit)

::: info Nicht der Code dieses Repositories
`emf-converter` ist ein eigenstandiges npm-Paket mit eigenem Repository; `pptx-viewer-core` konsumiert es nur. Die Tabelle unten beschreibt den heutigen Stand dieses Pakets; bei Abweichungen sind dessen eigene Release-Notes massgeblich.
:::

::: warning Canvas-API erforderlich
Die Metadatei-Konvertierung benotigt `OffscreenCanvas` oder `HTMLCanvasElement`. Reines Node.js ohne Canvas-Polyfill wird fur EMF/WMF-Bilder nicht unterstutzt (der Rest der Core-Engine lauft in Node problemlos).
:::

- **Verlaufsfullungen** - GDI+ lineare und radiale Verlaufe werden bereits exakt gerendert, einschliesslich Farbstopps, Voreinstellungen, Mischfaktoren und Transformationen. Die anstehende Version erganzt WrapMode-Kachelung fur achsparallele lineare Verlaufe; gewinkelte gekachelte Verlaufe und gekachelte Pfadverlaufe werden weiterhin geklemmt statt gekachelt.
- **Rasteroperationen** - GDI-ROP2-Stift- und Pinselmodi werden bereits exakt gerendert. Die anstehende Version erganzt exakte Pixel-fur-Pixel-ROP3-Operationen fur `BitBlt`/`StretchBlt`/`StretchDIBits`: `SRCCOPY`, `SRCPAINT`, `SRCAND`, `SRCINVERT`, `SRCERASE`, `NOTSRCCOPY`, `NOTSRCERASE`, `MERGEPAINT`, `PATCOPY`, `DSTINVERT`, `BLACKNESS`, `WHITENESS`. `MERGECOPY`, `PATPAINT` und `PATINVERT` werden weiterhin auf eine Kopie reduziert.
- **Text** - Nutzt die Schrift-Engine des Browsers; Glyphenmetriken konnen von Windows GDI abweichen. Die anstehende Version beachtet `ExtTextOut`-`dx`-Arrays exakt, erhalt das Vorzeichen der `LOGFONT`-Hohe, rotiert Text nach Escapement/Orientation und behebt einen Versatzfehler im Schriftnamen; ohne `dx`-Array hangt der Glyphenabstand weiterhin von der Schriftersetzung des Browsers ab.

## Weiterfuhrende Links

- [Einfuhrung](/de/guide/introduction) - was das Projekt insgesamt unterstuzt.
- [Architektur](/de/guide/architecture) - warum diese Kompromisse existieren.
- [OpenXML-Konformitat](/architecture/openxml-conformance) - die formale Definition von "unterstutzt", die das Abdeckungsmanifest verwendet.
