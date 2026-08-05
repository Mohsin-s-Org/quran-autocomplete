from pathlib import Path
import json
import re

root = Path('.')
source_path = root / 'src/main.ts'
source = source_path.read_text()

source = source.replace('  EditorPosition,\n', '')
source = source.replace('  Setting,\n  requestUrl,\n', '  Setting,\n  requestUrl,\n  RequestUrlResponse,\n')
source = source.replace(
    'export interface QuranQuoteSettings {\n  arabicEdition: string;',
    'export interface QuranQuoteSettings {\n  settingsVersion: number;\n  arabicEdition: string;',
)
source = source.replace(
    'const DEFAULT_SETTINGS: QuranQuoteSettings = {\n  arabicEdition:',
    'const DEFAULT_SETTINGS: QuranQuoteSettings = {\n  settingsVersion: 2,\n  arabicEdition:',
)
source = source.replace('  keepTriggerReference: true,\n', '  keepTriggerReference: false,\n', 1)

marker = 'export function parseAyahReference(input: string): AyahReference {'
helpers = '''function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTranslationEdition(value: unknown): value is TranslationEdition {
  return typeof value === "string" && value in TRANSLATIONS;
}

function isContentMode(value: unknown): value is QuranContentMode {
  return value === "english-only" || value === "arabic-english";
}

function isOutputStyle(value: unknown): value is QuranOutputStyle {
  return value === "blockquote" || value === "inline";
}

function isInlineEmphasis(value: unknown): value is InlineEmphasis {
  return value === "none" || value === "italic" || value === "bold";
}

function isApiAyah(value: unknown): value is ApiAyah {
  return isRecord(value) && typeof value.text === "string" && typeof value.numberInSurah === "number";
}

function isApiSurah(value: unknown): value is ApiSurah {
  return (
    isRecord(value) &&
    typeof value.number === "number" &&
    typeof value.englishName === "string" &&
    Array.isArray(value.ayahs) &&
    value.ayahs.every(isApiAyah)
  );
}

function isApiEnvelope(value: unknown): value is ApiEnvelope {
  return (
    isRecord(value) &&
    typeof value.code === "number" &&
    typeof value.status === "string" &&
    (value.data === undefined || isApiSurah(value.data))
  );
}

'''
if helpers not in source:
    source = source.replace(marker, helpers + marker)

old_atomic = '  return `${updatedLines.join("\\n")}\\n\\n${output}`;\n}'
new_atomic = '  const paragraph = updatedLines.join("\\n").trimEnd();\n  return paragraph.length > 0 ? `${paragraph}\\n\\n${output}` : output;\n}'
if old_atomic not in source:
    raise SystemExit('atomic replacement block not found')
source = source.replace(old_atomic, new_atomic)

source = source.replace('id: "insert-quran-quote",', 'id: "insert-passage",')
source = source.replace('    containerEl.createEl("h2", { text: "Qur’an Autocomplete settings" });\n\n', '')

old_fetch = '''    let response: any;
    try {
      response = await requestUrl({
        url,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
    } catch {
      throw new Error("Could not reach the Qur’an text service. Check your internet connection and try again.");
    }

    const payload = response.json as ApiEnvelope;
    if (response.status < 200 || response.status >= 300 || payload.code !== 200 || !payload.data) {
      throw new Error("The Qur’an text service did not return that passage.");
    }

    return payload.data;'''
new_fetch = '''    let response: RequestUrlResponse;
    try {
      response = await requestUrl({
        url,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });
    } catch {
      throw new Error("Could not reach the Qur’an text service. Check your internet connection and try again.");
    }

    let payload: unknown;
    try {
      payload = JSON.parse(response.text) as unknown;
    } catch {
      throw new Error("The Qur’an text service returned an invalid response.");
    }
    if (
      response.status < 200 ||
      response.status >= 300 ||
      !isApiEnvelope(payload) ||
      payload.code !== 200 ||
      !payload.data
    ) {
      throw new Error("The Qur’an text service did not return that passage.");
    }

    return payload.data;'''
if old_fetch not in source:
    raise SystemExit('fetch block not found')
source = source.replace(old_fetch, new_fetch)

old_load = '''  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<QuranQuoteSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
  }'''
new_load = '''  async loadSettings(): Promise<void> {
    const loaded: unknown = await this.loadData();
    const saved = isRecord(loaded) ? loaded : {};
    const needsRemovalDefaultMigration =
      typeof saved.settingsVersion !== "number" || saved.settingsVersion < 2;

    this.settings = {
      settingsVersion: 2,
      arabicEdition:
        typeof saved.arabicEdition === "string"
          ? saved.arabicEdition
          : DEFAULT_SETTINGS.arabicEdition,
      translationEdition: isTranslationEdition(saved.translationEdition)
        ? saved.translationEdition
        : DEFAULT_SETTINGS.translationEdition,
      contentMode: isContentMode(saved.contentMode)
        ? saved.contentMode
        : DEFAULT_SETTINGS.contentMode,
      outputStyle: isOutputStyle(saved.outputStyle)
        ? saved.outputStyle
        : DEFAULT_SETTINGS.outputStyle,
      inlineEmphasis: isInlineEmphasis(saved.inlineEmphasis)
        ? saved.inlineEmphasis
        : DEFAULT_SETTINGS.inlineEmphasis,
      keepTriggerReference: needsRemovalDefaultMigration
        ? false
        : typeof saved.keepTriggerReference === "boolean"
          ? saved.keepTriggerReference
          : DEFAULT_SETTINGS.keepTriggerReference,
      includeVerseNumbers:
        typeof saved.includeVerseNumbers === "boolean"
          ? saved.includeVerseNumbers
          : DEFAULT_SETTINGS.includeVerseNumbers,
      includeTranslationCredit:
        typeof saved.includeTranslationCredit === "boolean"
          ? saved.includeTranslationCredit
          : DEFAULT_SETTINGS.includeTranslationCredit,
      includeSurahName:
        typeof saved.includeSurahName === "boolean"
          ? saved.includeSurahName
          : DEFAULT_SETTINGS.includeSurahName,
      autoInsertEnabled:
        typeof saved.autoInsertEnabled === "boolean"
          ? saved.autoInsertEnabled
          : DEFAULT_SETTINGS.autoInsertEnabled,
      detectParenthesizedReference:
        typeof saved.detectParenthesizedReference === "boolean"
          ? saved.detectParenthesizedReference
          : DEFAULT_SETTINGS.detectParenthesizedReference,
    };

    if (needsRemovalDefaultMigration) {
      await this.saveSettings();
    }
  }'''
if old_load not in source:
    raise SystemExit('load settings block not found')
source = source.replace(old_load, new_load)

settings_class_marker = 'class QuranQuoteSettingTab extends PluginSettingTab {'
if settings_class_marker not in source:
    raise SystemExit('settings class not found')

definitions_marker = '  display(): void {\n'
definitions = '''  getSettingDefinitions() {
    return [
      {
        name: "Automatic insertion",
        desc: "Detect a completed Quran reference inside parentheses while you type.",
        control: { type: "toggle" as const, key: "autoInsertEnabled" },
      },
      {
        name: "Parenthesized reference trigger",
        desc: "Type (13:14) or (20:12-13) anywhere in a sentence or paragraph.",
        control: { type: "toggle" as const, key: "detectParenthesizedReference" },
      },
      {
        name: "Content",
        desc: "Choose English only or Arabic followed by English.",
        control: {
          type: "dropdown" as const,
          key: "contentMode",
          defaultValue: "arabic-english",
          options: {
            "english-only": "English + Quran reference",
            "arabic-english": "Arabic + English + Quran reference",
          },
        },
      },
      {
        name: "Layout",
        desc: "Insert a quote block beneath the paragraph or replace the trigger inline.",
        control: {
          type: "dropdown" as const,
          key: "outputStyle",
          defaultValue: "blockquote",
          options: {
            blockquote: "Quote block beneath paragraph",
            inline: "Inline at the trigger position",
          },
        },
      },
      {
        name: "Keep typed reference",
        desc: "Keep the original (13:14) in the paragraph. Disabled by default.",
        control: { type: "toggle" as const, key: "keepTriggerReference" },
      },
      {
        name: "Inline emphasis",
        desc: "Make inline passages plain, italic, or bold.",
        control: {
          type: "dropdown" as const,
          key: "inlineEmphasis",
          defaultValue: "italic",
          options: { none: "Plain", italic: "Italic", bold: "Bold" },
        },
      },
      {
        name: "English translation",
        desc: "Choose the English translation used in generated passages.",
        control: {
          type: "dropdown" as const,
          key: "translationEdition",
          defaultValue: "en.sahih",
          options: TRANSLATIONS,
        },
      },
      {
        name: "Show verse numbers",
        desc: "Append Arabic verse markers and number English verses in a range.",
        control: { type: "toggle" as const, key: "includeVerseNumbers" },
      },
      {
        name: "Show translation credit",
        desc: "Add the selected translator to the formatted Quran reference.",
        control: { type: "toggle" as const, key: "includeTranslationCredit" },
      },
      {
        name: "Show surah name",
        desc: "Add the English surah name to the formatted Quran reference.",
        control: { type: "toggle" as const, key: "includeSurahName" },
      },
    ];
  }

'''
settings_index = source.index(settings_class_marker)
post_settings = source[settings_index:]
if definitions not in source:
    relative = post_settings.index(definitions_marker)
    absolute = settings_index + relative
    source = source[:absolute] + definitions + source[absolute:]

source_path.write_text(source)

tests_path = root / 'tests/reference.test.cjs'
tests = tests_path.read_text()
exact_test = '''
assert.equal(
  buildBlockquoteParagraphReplacement(
    ["(24:30–31)"], 0, 0, "(24:30–31)".length, "> passage", false,
  ),
  "> passage",
  "a trigger-only paragraph must be removed completely",
);
'''
if exact_test not in tests:
    tests = tests.replace('const registry = new AutomaticTriggerRegistry();', exact_test + '\nconst registry = new AutomaticTriggerRegistry();')
tests_path.write_text(tests)

manifest_path = root / 'manifest.json'
manifest = json.loads(manifest_path.read_text())
manifest['version'] = '0.5.2'
manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')

package_path = root / 'package.json'
package = json.loads(package_path.read_text())
package['version'] = '0.5.2'
package_path.write_text(json.dumps(package, indent=2) + '\n')

versions_path = root / 'versions.json'
versions = json.loads(versions_path.read_text())
versions['0.5.2'] = manifest['minAppVersion']
versions_path.write_text(json.dumps(versions, indent=2) + '\n')

tsconfig_path = root / 'tsconfig.json'
tsconfig = json.loads(tsconfig_path.read_text())
tsconfig['compilerOptions'].pop('types', None)
tsconfig['include'] = ['src/**/*.ts']
tsconfig_path.write_text(json.dumps(tsconfig, indent=2) + '\n')

stub = root / 'types/obsidian.d.ts'
if stub.exists():
    stub.unlink()

readme_path = root / 'README.md'
readme = readme_path.read_text()
readme = re.sub(
    r'### Easiest manual installation.*?### Install individual release files\n\n',
    '### Manual installation\n\nDownload `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release and place them directly in:\n\n```text\n<Vault>/.obsidian/plugins/quran-quote/\n```\n\nRestart Obsidian, then enable **Quran Autocomplete** under **Settings → Community plugins**. Official Obsidian releases contain only the three supported plugin assets.\n\n',
    readme,
    flags=re.S,
)
note = '\n## Trigger removal and undo\n\nFor quote-block layout, **Keep typed reference** is disabled by default. A trigger-only line such as `(24:30–31)` is removed completely, so the generated quote begins at the quote block. The paragraph replacement is atomic, meaning one Undo removes the generated passage and restores the original trigger without reinserting it.\n'
if '## Trigger removal and undo' not in readme:
    readme = readme.replace('## Auto-closing parentheses are supported', note + '\n## Auto-closing parentheses are supported')
readme_path.write_text(readme)

release_path = root / '.github/workflows/release.yml'
release = release_path.read_text()
release = release.replace(
    'permissions:\n  contents: write\n',
    'permissions:\n  contents: write\n  id-token: write\n  attestations: write\n',
)
release = re.sub(
    r'      - name: Build ready-to-install ZIP.*?      - name: Create or update GitHub release',
    '      - name: Attest release assets\n        uses: actions/attest-build-provenance@v3\n        with:\n          subject-path: |\n            main.js\n            manifest.json\n            styles.css\n      - name: Create or update GitHub release',
    release,
    flags=re.S,
)
release = re.sub(
    r'          For the easiest manual installation,.*?Obsidian\'s Community Plugins installer uses the individual `main.js`, `manifest.json`, and `styles.css` assets\.\n',
    '          Download `main.js`, `manifest.json`, and `styles.css` for manual installation. Obsidian uses these same three files for Community Plugins installation.\n',
    release,
    flags=re.S,
)
release = release.replace('            "$ARCHIVE" \\\n', '')
release_path.write_text(release)
