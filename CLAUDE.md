# Kochen — Rezeptsammlung

## Projektstruktur

```
Kochen/
├── rezepte/          # Einzelne Rezepte als JSON
├── index.html        # Generierte Single-Page-App
├── build.js          # Node-Script: JSONs → HTML
└── CLAUDE.md         # Diese Datei
```

## Rezept-JSON Schema

Jedes Rezept ist eine Datei in `rezepte/` mit folgendem Aufbau:
- `id`: Kebab-case Identifier (= Dateiname ohne .json)
- `titel`: Anzeigename
- `kategorie`: Eine von: Apéro, Vorspeise, Hauptgang, Beilage, Dessert, Brot & Gebäck, Sauce & Dip, Grundrezept
- `tags`: Array von Strings (z.B. "grill", "vegetarisch", "schnell")
- `favorit`: Boolean
- `portionen`: Anzahl Standardportionen
- `aufwand`: "einfach" | "mittel" | "aufwändig"
- `zeit`: Object mit `vorbereitung` und `gesamt` in Minuten
- `zutaten`: Array von Gruppen, jede mit `gruppe` (Name) und `items` (Array von `{menge, einheit, name, abteilung}`)
- `schritte`: Array von Strings
- `tipps`: Array von Strings (optional)
- `notizen`: Freitext (optional)

## Einheiten

Ausschliesslich metrisch: g, kg, ml, dl, l, TL, EL, Stück, Prise, Bund, Zweig

## Abteilungen (für Einkaufsliste)

Milchprodukte, Fleisch & Fisch, Gemüse & Früchte, Brot & Backwaren, Grundnahrungsmittel, Gewürze & Öle, Tiefkühl, Getränke, Sonstiges

## Workflow

1. Neues Rezept: JSON in `rezepte/` erstellen
2. `node build.js` ausführen → generiert `index.html`
3. `index.html` ans Handy schicken (WhatsApp, Mail, etc.)

## Konventionen

- Sprache: Deutsch (Schweizer Konventionen, kein ß)
- Temperaturen in °C
- Alle Mengen metrisch
- Dateinamen: kebab-case
