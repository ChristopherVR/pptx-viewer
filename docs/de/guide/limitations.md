---
title: Einschrankungen
description: Was im Core-Engine und den Viewer-Bindungen nicht unterstuzt wird - vor der Einfuhrung lesen.
---

# Einschrankungen

::: warning Vor der Einfuhrung lesen
`pptx-viewer` deckt einen grossen Teil der OpenXML-Spezifikation ab, aber einiges ist approximiert, schreibgeschutzt oder durch die Browser-Plattform begrenzt. Diese Seite dokumentiert bekannte Einschrankungen; sie ist keine vollstandige Kompatibilitatsgarantie fur jede Office-Funktion oder Erweiterung von Drittanbietern. Prufen Sie `data.warnings` nach dem Laden einer Datei und lesen Sie [OpenXML-Konformitat](/architecture/openxml-conformance) fur das formale Abdeckungsmanifest.
:::

## Core-Engine (`pptx-viewer-core`)

| Funktion        | Status                                        | Hinweise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ppt`-Export   | Teilweise                                     | Tinte, SmartArt, Diagramme und 3D-Modelle werden in PowerPoint jetzt als bearbeitbare Objekte wieder geoffnet, ueber ein eingebettetes OOXML-Round-Trip-Paket (per COM in PowerPoint verifiziert); nur PowerPoint 97-2003 selbst sieht den Fallback. Weiterhin verlustbehaftet: Bilder ausser PNG/JPEG werden zu einem Platzhalter, die eigenen Master-Textformat-Uberschreibungen einer Praesentation werden nicht geschrieben, Video und Audio ausser WAV werden zu einem Bild degradiert, und der Import verschlusselter `.ppt`-Dateien unterstuetzt nur RC4 CryptoAPI. Siehe [OpenXML-Konformitaet](/architecture/openxml-conformance#ppt-export-ceiling).          |
| SmartArt-Layout | Naeherung ohne zwischengespeicherte Zeichnung | Praesentationen, die ohne die zwischengespeicherte `dsp:drawing` gespeichert wurden, werden vom Interpreter angeordnet. Von 229 per COM erstellten Galerie-Fixtures erzeugen 227 PowerPoints Formenmenge, aber nur 39 treffen dessen Geometrie auf 1 % genau: die Kern-Layouts mit einem einzelnen Algorithmus (einfacher Prozess/Liste, Zyklus, radial, Hierarchie, Organigramm, Pyramide) stimmen gut ueberein, waehrend Bild-, Zeitachsen-, "Meet the Team"-, Textkarten- und zusammengesetzte Listen-/Prozess-Layouts deutlich abweichen koennen. Siehe [OpenXML-Konformitaet](/architecture/openxml-conformance#smartart-layout-ground-truth) fuer die Messbelege. |

### Animationserstellung

Ein im Animationsbereich erstellter Effekt wird in den bestehenden `p:timing`-Baum der Folie eingefuegt; die vorhandenen Effekte der Praesentation bleiben byte-identisch. Bekannte Luecken:

- **Gespeicherte Eingangs-/Ausgangseffekte spielen in PowerPoint als Uberblendung ab.** Der Writer speichert die richtige Voreinstellung, gibt aber nur ein Uberblend-Verhalten aus, sodass ein hier gespeichertes "Einfliegen" beim Oeffnen in PowerPoint als Uberblendung abgespielt wird (dieser Viewer spielt es korrekt ab). Mehrere Betonungseffekte (Pulsieren, Welle, Springen, Farbwelle, Blinken, Schimmern) werden als No-Op geschrieben.
- **Manche Filterfamilien und Voreinstellungen werden bei der Wiedergabe angenaehert:** `strips` spielt als Kantenwischblende ab, `wedge` als wachsendes Sechseck, `slide`/`cover`/`uncover`/`push`/`pull` teilen sich ein Einflieg-Verhalten, und 45 PowerPoint-Voreinstellungs-IDs spielen einen Ersatzeffekt ab (zum Beispiel spielen "Einfaches Drehen" und "Verschwinden mit Herausfliegen" als Uberblendung ab). Jalousie, Schachbrett, Rad und Zufallsbalken ignorieren ihren Untertyp.
- **Noch nicht unterstuetzt:** `p14:bounceEnd`, Ausloeser auf einer Medien-Lesezeichenmarke (sie laden als Klick-Ausloeser), buchstabenweises Kraeuseln innerhalb eines absatzweisen Aufbaus, sowie die Erstellung der p15-Uebergaenge (sie spielen ab, wenn sie in einer Datei vorhanden sind, aber ihre Richtungsoptionen werden ignoriert).

### Luecken zur Laufzeit erkennen

Sie muessen nicht raten, ob eine Datei an eine Einschrankung stoesst. Die Ladepipeline meldet viele nicht unterstuetzte oder angenaeherte Konstrukte (nicht alle: Animations-Ersatzeffekte zum Beispiel loesen keine Warnung aus) in `data.warnings`, typisiert als `PptxCompatibilityWarning`:

```ts
interface PptxCompatibilityWarning {
	code: string; // stable machine-readable code
	message: string;
	severity: 'info' | 'warning';
	scope: 'presentation' | 'slide' | 'element' | 'save';
	slideId?: string; // present for slide/element-scoped warnings
	elementId?: string;
	xmlPath?: string; // where in the package the construct lives
}
```

Pruefen Sie `data.warnings` nach `load()` (und nach `save()`), wenn Ihre Anwendung Nutzern Genauigkeitshinweise anzeigen oder Funktionen pro Datei sperren soll.

Siehe [Laufzeitumgebungen](/guide/runtime-environments) dafuer, wo welcher Teil von `pptx-viewer` laeuft (Browser / Node.js / Web Worker), und fuer plattformspezifisches Verhalten, das aus der Browser-Sandbox folgt statt aus einer fehlenden Funktion.

## Framework-Viewer (React, Vue 3, Angular, Svelte 5, Vanilla JS)

::: warning CSS-basiertes Rendering tauscht einige visuelle Effekte gegen Fidelitat an anderer Stelle
Folien werden als HTML/CSS statt als Canvas gerendert, was scharfen Text bei jedem Zoom, native Barrierefreiheit und DOM-Interaktivitat ergibt. Der Kompromiss: einige PowerPoint-Effekte haben kein exaktes CSS-Aquivalent und werden approximiert.
:::

### Visuelle Effekt-Annaherungen

| Effekt                                                                                        | Status                                                  | Hinweise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3D-Formen und -Szenen (`a:sp3d` / `a:scene3d`)                                                | Metall-Restfehler                                       | Metall-Materialien wuschen fruher unter Beleuchtungs-Rigs mit hoher Elevation aus; das Specular-Licht hat jetzt eine eigene, gekappte Elevation, neu angepasst gegen 134 PowerPoint-Renderings (mittlerer absoluter Fehler 75,0 bis 36,4 auf einer 0-255-Skala), sodass ein kleinerer Restfehler bleibt. Die Abschraegungs-Korrektur fuer relaxedInset/slope/hardEdge vom 16.09.2026 wurde noch nicht erneut gegen ein frisches PowerPoint-Rendering verifiziert. Siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die Herkunft. |
| WordArt-Textverformungen (`inflate` / `deflate` / `can` / `slant` / `fade` / `cascade` / ...) | Can-Innenflaeche und Schriften ohne Datei unverifiziert | Die `can`-Presets platzieren Glyphen jetzt nach PowerPoints gemessenem linearem Abstandsgesetz (per COM ermittelt, unabhaengig vom Kurvenanpassungswert). Noch offen: erneute Messung des verbleibenden Innenflaechen-Umrissfehlers der `can`-Presets gegen PowerPoint, sowie die Validierung des nachgezeichneten Umrisspfads gegen PowerPoint fuer Schriften, deren Datei nicht verfuegbar ist. Siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die Herkunft.                                                                 |

Reflexionen, weiche Kanten und Pfadverlaeufe sind ebenfalls Annaeherungen, halten sich aber gut gegen echtes PowerPoint; siehe [Visuelle Effekttreue](/guide/visual-effects) fuer die Technik und die per COM gemessenen Belege hinter jeder einzelnen.

### Bekannte Render- und Bearbeitungsluecken (Audit 09/2026)

Ein Audit vom September 2026 gegen echtes PowerPoint fand diese offenen Luecken; Korrekturen sind in Arbeit:

- **Das Speichern einer bearbeiteten Folie kann Details verlieren.** Eine Folie wird neu geschrieben, sobald sich etwas an ihr aendert, und das Neuschreiben kann Formeln verwerfen, weiche Zeilenumbrueche in Absaetze umwandeln, geerbte Formatierung (Anker, Innenabstaende, Autofit, Aufzaehlungszeichen, Master-Schriftarten) auf unveraenderten Formen festnageln, Theme-Hintergruende abflachen und Zeitstempel moderner Kommentare um die lokale Zeitzone verschieben. Unveraenderte Folien werden sauber hin- und zurueckkonvertiert.
- **Text:** Datumsfelder, die auf dem Standard-Master-Datumsplatzhalter basieren, zeigen `datetimeFigureOut`; Theme-Schriften pro Schriftsystem (Japanisch, Thai, Devanagari, Arabisch) werden nicht angewendet; Verlaufsfuellungen von Textlaeufen setzen bei jedem Wort neu an; Bild-Aufzaehlungszeichen zeigen ein einfaches Aufzaehlungszeichen; vertikale Textmodi, Textspalten, Blocksatz, gemischte Laufgroessen und manche Texteffekte (Reflexion, Innenschatten, weiche Kante) weichen von PowerPoint ab.
- **Diagramme:** Aktienkurs-, Oberflaechen-, Box-Whisker-, Pareto-, Histogramm-, Trichter-, Treemap-, Sunburst- und Wasserfall-Diagramme weichen sichtbar von PowerPoint ab; Streudiagramm-X-Achsen, Trendlinien-Gleichungen und Kreisdiagramm-aus-Kreisdiagramm sind angenaehert.
- **Tabellen und Bilder:** Integrierte Tabellenformate ignorieren die Transparenz der Fuellung (Themenformat 2 wird unsichtbar dargestellt), automatisch vergroesserte Zeilen werden vom Tabellenrahmen abgeschnitten, Tabellentext ignoriert den Sonstigen-Text-Stil des Masters, und Graustufen-Neueinfaerbung/Ausbleichen werden nicht angewendet.
- **3D-Modelle** ignorieren die in PowerPoint erstellte Kamera, Transformation und Beleuchtung.
- **Editor-Abdeckung** ist eine Teilmenge der von PowerPoint: Bearbeitungspunkte, Formen zusammenfuehren, Zuschneide-Griffe auf der Zeichenflaeche, Inhalte einfuegen (Spezial) und viele Standard-Tastenkuerzel (Absatzausrichtung, Schriftgroesse, Format kopieren/einfuegen) sowie mehrere Ribbon-Galerien sind noch nicht verfuegbar.

## EMF/WMF-Metadateien (`emf-converter`-Abhaengigkeit)

::: info Nicht der Code dieses Repositories
`emf-converter` ist ein eigenstandiges npm-Paket mit eigenem Repository; `pptx-viewer-core` konsumiert es nur. Die Tabelle unten beschreibt den heutigen Stand dieses Pakets; bei Abweichungen sind dessen eigene Release-Notes massgeblich.
:::

::: warning Canvas-API erforderlich
Die Metadatei-Konvertierung benotigt `OffscreenCanvas` oder `HTMLCanvasElement`. Reines Node.js ohne Canvas-Polyfill wird fur EMF/WMF-Bilder nicht unterstutzt (der Rest der Core-Engine lauft in Node problemlos).
:::

| Funktion           | Status                          | Hinweise                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verlaufsfuellungen | Exakte Farbstopps und Kachelung | GDI+ lineare und radiale Verlaeufe rendern exakte Farbstopps, Voreinstellungen, Mischfaktoren und Transformationen. Seit emf-converter 3.1.0 funktioniert `WrapMode`-Kachelung in jedem Winkel, und Pfadverlaeufe folgen ihrer Randform (innerhalb von 1-6 % von Windows GDI+, je nach Wrap-Modus). Textur-Pinsel (Bild) rendern weiterhin einfarbig schwarz. |
| Rasteroperationen  | ROP3 exakt                      | Seit 3.1.0 werden alle 256 ROP3-Codes exakt fuer `BitBlt`/`StretchBlt`/`StretchDIBits` ausgewertet. Bitweise ROP2-Stiftmodi (AND/OR/XOR) werden angenaehert.                                                                                                                                                                                                  |
| Text               | Browser-Schrift-Engine          | Glyphenmetriken koennen von Windows GDI abweichen. Seit 3.1.0 werden `ExtTextOut`-`dx`-Arrays, das Vorzeichen der `LOGFONT`-Hoehe und der Escapement-Wert beruecksichtigt; ohne `dx`-Array haengt der Abstand von der Schriftersetzung des Browsers ab. Gedrehte oder gescherte Weltmatrizen in reinen GDI-Metadateien (nicht GDI+) werden nicht angewendet.  |

## Weiterfuhrende Links

- [Einfuhrung](/de/guide/introduction) - was das Projekt insgesamt unterstuzt.
- [Architektur](/de/guide/architecture) - warum diese Kompromisse existieren.
- [OpenXML-Konformitat](/architecture/openxml-conformance) - die formale Definition von "unterstutzt", die das Abdeckungsmanifest verwendet.
- [Visuelle Effekttreue](/guide/visual-effects) - per echtem PowerPoint verifizierte CSS/SVG-Effektannaeherungen.
- [Laufzeitumgebungen](/guide/runtime-environments) - wo welcher Teil von `pptx-viewer` laeuft, und plattformspezifische Hinweise zur Browser-Sandbox.
