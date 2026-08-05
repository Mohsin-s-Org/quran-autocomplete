# Quran Autocomplete for Obsidian

Quran Autocomplete detects a Quran ayah reference written inside parentheses and inserts the requested passage into the current Obsidian note.

Type a single ayah:

```text
The call of truth belongs to Allah (13:14).
```

Or a range:

```text
Allah addressed Musa directly (20:12-13), marking the beginning of his mission.
```

When the closing `)` is completed, the plugin retrieves the ayah text and inserts it using your chosen content and layout settings.

## Quick demo

### Before

Type a reference anywhere in a sentence or paragraph:

```markdown
The call of truth belongs to Allah (13:14).
```

### After: English quote block

With **Keep typed reference** disabled, which is the default:

```markdown
The call of truth belongs to Allah.

> To Him [alone] is the supplication of truth...
>
> (Qur’an 13:14 · Sahih International)
```

### After: Arabic and English quote block

```markdown
The call of truth belongs to Allah.

> <div class="quran-quote-arabic" dir="rtl" lang="ar">لَهُۥ دَعْوَةُ ٱلْحَقِّ...</div>
>
> To Him [alone] is the supplication of truth...
>
> (Qur’an 13:14 · Sahih International)
```

Enable **Keep typed reference** to leave `(13:14)` in the original paragraph.

### After: inline

With inline layout enabled, the parenthesized trigger is replaced directly. Inline text can be plain, italic, or bold; italic is the default:

```markdown
The call of truth belongs to Allah <em class="quran-quote-inline-emphasis">To Him [alone] is the supplication of truth... (Qur’an 13:14 · Sahih International)</em>.
```

The examples are shortened for display. The plugin inserts the complete text returned for the selected translation and ayah range.

## Trigger removal and Undo

For quote-block layout, **Keep typed reference** is disabled by default. A trigger-only paragraph such as:

```markdown
(24:30–31)
```

is removed completely, so the generated output begins with the quote block rather than leaving the reference above it.

The paragraph replacement is atomic. One Undo removes the entire generated passage and restores the original text. Restoring a reference through Undo does not immediately trigger another insertion.

## Auto-closing parentheses are supported

Obsidian normally creates both parentheses when you type `(`:

```text
()
```

The cursor remains between them. Type the reference and then type `)` as normal:

```text
(13:14)
```

CodeMirror may move the cursor over the existing closing parenthesis instead of inserting another character. The plugin handles that action as well as ordinary text insertion. Both paths use the same deduplication registry, so the same reference cannot be fetched or inserted twice.

## Output options

### Content

- English and Quran reference
- Arabic, English, and Quran reference

### Layout

- Quote block beneath the paragraph
- Inline replacement at the trigger position

### Inline emphasis

- Plain
- Italic
- Bold

For quote-block layout, **Keep typed reference** controls whether the original reference remains in the paragraph.

## Installation

### Manual installation

1. Open the latest GitHub release.
2. Download these three assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`
3. Create this folder inside the vault when it does not already exist:

   ```text
   <Vault>/.obsidian/plugins/quran-quote/
   ```

4. Place all three downloaded files directly inside that folder.
5. Restart or reload Obsidian.
6. Open **Settings → Community plugins** and enable **Quran Autocomplete**.

Official releases contain only the three assets supported by Obsidian. Do not use GitHub's automatically generated source-code archives as the plugin installation package.

### Community Plugins directory

After the plugin is accepted into Obsidian's Community Plugins directory, it can be installed and updated directly from **Settings → Community plugins → Browse**.

## Settings

Open **Settings → Community plugins → Quran Autocomplete**.

Available settings include:

- Automatic insertion
- Parenthesized-reference detection
- English-only or Arabic-and-English content
- Quote-block or inline layout
- Keep or remove the typed reference
- Plain, italic, or bold inline emphasis
- Sahih International, Pickthall, Yusuf Ali, or Muhammad Asad translation
- Arabic and English verse numbers
- Translation credit
- English surah name

## Manual command

Automatic detection is optional. You can also:

1. Select `13:14` or `20:12-13` in a note.
2. Open the Command Palette.
3. Run **Quran Autocomplete: Insert Qur’an passage**.

Running the command without a selection opens a reference-entry dialog. The ribbon book icon provides the same behaviour.

## Development

```bash
git clone https://github.com/mohsinosman/quran-autocomplete.git
cd quran-autocomplete
npm ci
npm run check
```

Development commands:

```bash
npm run build   # Compile TypeScript and update main.js
npm test        # Run parser, formatting, auto-pair, removal, and deduplication tests
npm run check   # Build and run the complete test suite
npm run dev     # Watch TypeScript during development
```

## How automatic detection works

1. The plugin checks text ending at the cursor after the cursor moves past `)`.
2. The text inside the nearest matching parentheses must be a valid reference such as `13:14` or `20:12-13`.
3. A keydown listener handles Obsidian's auto-closing-parenthesis behaviour.
4. The normal editor-change listener handles ordinary insertion.
5. A per-editor registry blocks duplicate events while the API request is pending.
6. Before inserting anything, the plugin confirms that the original trigger remains unchanged.
7. Undo and redo events temporarily suppress automatic detection so restored text is not immediately processed again.

## Data and privacy

The plugin sends only the requested surah number, ayah range, Arabic edition, and translation edition to the Al Quran Cloud API. It does not send note content, filenames, or vault files.

An internet connection is currently required when inserting a passage.

Quran translations are interpretations of the Arabic text and are not replacements for it.

## Attribution

Quran text and translations are retrieved from the Al Quran Cloud API. This project is not affiliated with Obsidian or Al Quran Cloud.

## Licence

MIT. See [LICENSE](LICENSE).
