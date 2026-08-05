import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  SettingDefinitionItem,
  requestUrl,
  RequestUrlResponse,
} from "obsidian";

const API_BASE_URL = "https://api.alquran.cloud/v1";

export interface AyahReference {
  surah: number;
  startAyah: number;
  endAyah: number;
}

type TranslationEdition = "en.sahih" | "en.pickthall" | "en.yusufali" | "en.asad";
export type QuranContentMode = "english-only" | "arabic-english";
export type QuranOutputStyle = "blockquote" | "inline";
export type InlineEmphasis = "none" | "italic" | "bold";

export interface QuranQuoteSettings {
  settingsVersion: number;
  arabicEdition: string;
  translationEdition: TranslationEdition;
  contentMode: QuranContentMode;
  outputStyle: QuranOutputStyle;
  inlineEmphasis: InlineEmphasis;
  keepTriggerReference: boolean;
  includeVerseNumbers: boolean;
  includeTranslationCredit: boolean;
  includeSurahName: boolean;
  autoInsertEnabled: boolean;
  detectParenthesizedReference: boolean;
}

interface ApiAyah {
  text: string;
  numberInSurah: number;
}

interface ApiSurah {
  number: number;
  englishName: string;
  englishNameTranslation?: string;
  ayahs: ApiAyah[];
}

interface ApiEnvelope {
  code: number;
  status: string;
  data?: ApiSurah;
}

export interface QuoteAyah {
  number: number;
  arabic: string;
  english: string;
}

const TRANSLATIONS: Record<TranslationEdition, string> = {
  "en.sahih": "Sahih International",
  "en.pickthall": "Marmaduke Pickthall",
  "en.yusufali": "Abdullah Yusuf Ali",
  "en.asad": "Muhammad Asad",
};

const DEFAULT_SETTINGS: QuranQuoteSettings = {
  settingsVersion: 2,
  arabicEdition: "quran-uthmani",
  translationEdition: "en.sahih",
  contentMode: "arabic-english",
  outputStyle: "blockquote",
  inlineEmphasis: "italic",
  keepTriggerReference: false,
  includeVerseNumbers: true,
  includeTranslationCredit: true,
  includeSurahName: false,
  autoInsertEnabled: true,
  detectParenthesizedReference: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
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

export function parseAyahReference(input: string): AyahReference {
  const normalized = input
    .trim()
    .replace(/^qur(?:a|ā)n\s+/i, "")
    .replace(/^qur['’]an\s+/i, "");

  const match = normalized.match(/^(\d{1,3})\s*:\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/);
  if (!match) {
    throw new Error("Use a reference such as 13:14 or 20:12-13.");
  }

  const surah = Number(match[1]);
  const startAyah = Number(match[2]);
  const endAyah = match[3] ? Number(match[3]) : startAyah;

  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new Error("The surah number must be between 1 and 114.");
  }
  if (!Number.isInteger(startAyah) || startAyah < 1 || !Number.isInteger(endAyah) || endAyah < 1) {
    throw new Error("Ayah numbers must be positive whole numbers.");
  }
  if (endAyah < startAyah) {
    throw new Error("The ending ayah cannot come before the starting ayah.");
  }
  if (endAyah - startAyah + 1 > 50) {
    throw new Error("Insert at most 50 ayahs at a time.");
  }

  return { surah, startAyah, endAyah };
}

export interface ParenthesizedReferenceMatch {
  referenceText: string;
  matchedText: string;
  startCh: number;
  endCh: number;
}

/**
 * Detect a completed parenthesized Qur'an reference immediately before the
 * cursor. It works when CodeMirror auto-created the closing parenthesis and
 * the user's final `)` key only moved the cursor over it.
 */
export function findParenthesizedReferenceAtCursor(
  line: string,
  cursorCh: number,
): ParenthesizedReferenceMatch | null {
  if (cursorCh < 1 || cursorCh > line.length || line[cursorCh - 1] !== ")") {
    return null;
  }

  const textBeforeCursor = line.slice(0, cursorCh);
  const match = textBeforeCursor.match(
    /\(\s*((?:(?:quran|qurān|qur['’]an)\s+)?\d{1,3}\s*:\s*\d{1,3}(?:\s*[-–—]\s*\d{1,3})?)\s*\)$/i,
  );

  if (!match || match.index === undefined) {
    return null;
  }

  try {
    parseAyahReference(match[1]);
  } catch {
    return null;
  }

  return {
    referenceText: match[1],
    matchedText: match[0],
    startCh: match.index,
    endCh: cursorCh,
  };
}

export interface TriggerRemovalRange {
  startCh: number;
  endCh: number;
}

/**
 * Remove a parenthesized trigger without leaving a space before punctuation
 * or doubled whitespace around the removed text.
 */
export function getTriggerRemovalRange(
  line: string,
  startCh: number,
  endCh: number,
): TriggerRemovalRange {
  let start = startCh;
  let end = endCh;
  const left = line.slice(0, startCh);
  const right = line.slice(endCh);
  const leftHasSpace = /\s$/.test(left);
  const rightHasSpace = /^\s/.test(right);
  const rightStartsPunctuation = /^[,.;:!?]/.test(right);

  if (leftHasSpace && (rightStartsPunctuation || right.length === 0 || rightHasSpace)) {
    start -= 1;
  } else if (!leftHasSpace && rightHasSpace) {
    end += 1;
  }

  return { startCh: Math.max(0, start), endCh: Math.min(line.length, end) };
}

/** Build one atomic paragraph replacement so trigger removal and quote insertion undo together. */
export function buildBlockquoteParagraphReplacement(
  paragraphLines: string[],
  triggerLineIndex: number,
  triggerStartCh: number,
  triggerEndCh: number,
  output: string,
  keepTriggerReference: boolean,
): string {
  const updatedLines = [...paragraphLines];
  if (!keepTriggerReference) {
    const sourceLine = updatedLines[triggerLineIndex];
    if (sourceLine === undefined) {
      throw new Error("The trigger line is outside the paragraph.");
    }
    const removal = getTriggerRemovalRange(sourceLine, triggerStartCh, triggerEndCh);
    updatedLines[triggerLineIndex] =
      sourceLine.slice(0, removal.startCh) + sourceLine.slice(removal.endCh);
  }
  const paragraph = updatedLines.join("\n").trimEnd();
  return paragraph.length > 0 ? `${paragraph}\n\n${output}` : output;
}

export function formatReference(reference: AyahReference): string {
  return reference.startAyah === reference.endAyah
    ? `${reference.surah}:${reference.startAyah}`
    : `${reference.surah}:${reference.startAyah}–${reference.endAyah}`;
}

function toArabicIndic(value: number): string {
  return String(value).replace(/\d/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/\r?\n/g, " ")
    .trim();
}

function buildCitation(
  reference: AyahReference,
  surahName: string,
  settings: QuranQuoteSettings,
): string {
  const surahSuffix = settings.includeSurahName && surahName ? ` · ${surahName}` : "";
  const translationSuffix = settings.includeTranslationCredit
    ? ` · ${TRANSLATIONS[settings.translationEdition]}`
    : "";
  return `Qur’an ${formatReference(reference)}${surahSuffix}${translationSuffix}`;
}

function formatEnglishAyahs(ayahs: QuoteAyah[], settings: QuranQuoteSettings): string[] {
  const showEnglishVerseNumber = settings.includeVerseNumbers && ayahs.length > 1;
  return ayahs.map((ayah) => {
    const number = showEnglishVerseNumber ? `**${ayah.number}.** ` : "";
    return `${number}${escapeMarkdown(ayah.english)}`;
  });
}

function formatArabicAyahs(ayahs: QuoteAyah[], settings: QuranQuoteSettings): string[] {
  return ayahs.map((ayah) => {
    const number = settings.includeVerseNumbers
      ? ` <span class="quran-quote-verse-number">﴿${toArabicIndic(ayah.number)}﴾</span>`
      : "";
    return `${escapeHtml(ayah.arabic)}${number}`;
  });
}

export function applyInlineEmphasis(value: string, emphasis: InlineEmphasis): string {
  if (emphasis === "none") {
    return value;
  }
  const tag = emphasis === "bold" ? "strong" : "em";
  return `<${tag} class="quran-quote-inline-emphasis">${value}</${tag}>`;
}

export function formatQuranOutput(
  reference: AyahReference,
  ayahs: QuoteAyah[],
  surahName: string,
  settings: QuranQuoteSettings,
): string {
  const citation = `(${buildCitation(reference, surahName, settings)})`;

  if (settings.outputStyle === "inline") {
    const showEnglishVerseNumber = settings.includeVerseNumbers && ayahs.length > 1;
    const englishInline = ayahs
      .map((ayah) => {
        const number = showEnglishVerseNumber ? `${ayah.number}. ` : "";
        return `${number}${escapeHtml(ayah.english.replace(/\r?\n/g, " ").trim())}`;
      })
      .join(" ");
    const citationInline = escapeHtml(citation);
    const inlineOutput =
      settings.contentMode === "english-only"
        ? `${englishInline} ${citationInline}`
        : `<span class="quran-quote-arabic-inline" dir="rtl" lang="ar">${formatArabicAyahs(ayahs, settings).join(" ")}</span> — ${englishInline} ${citationInline}`;
    return applyInlineEmphasis(inlineOutput, settings.inlineEmphasis);
  }

  const english = formatEnglishAyahs(ayahs, settings);
  const lines: string[] = [];
  if (settings.contentMode === "arabic-english") {
    const arabic = formatArabicAyahs(ayahs, settings);
    ayahs.forEach((_ayah, index) => {
      lines.push(
        `> <div class="quran-quote-arabic" dir="rtl" lang="ar">${arabic[index]}</div>`,
      );
      lines.push(">");
      lines.push(`> ${english[index]}`);
      if (index < ayahs.length - 1) {
        lines.push(">");
      }
    });
  } else {
    english.forEach((translation, index) => {
      lines.push(`> ${translation}`);
      if (index < english.length - 1) {
        lines.push(">");
      }
    });
  }

  lines.push(">");
  lines.push(`> ${citation}`);
  return lines.join("\n");
}

/** Backwards-compatible export retained for older tests and integrations. */
export const formatQuranQuote = formatQuranOutput;

interface TriggerFingerprint {
  line: number;
  startCh: number;
  endCh: number;
  matchedText: string;
}

interface UndoGuard {
  key: string;
  fingerprint: TriggerFingerprint;
}

/**
 * One registry is kept per Editor. It blocks duplicate key/editor events while
 * a request is pending and remembers completed source triggers until the user
 * actually edits or removes them.
 */
export class AutomaticTriggerRegistry {
  private readonly pending = new Set<string>();
  private readonly handled = new Map<string, TriggerFingerprint>();

  begin(key: string): boolean {
    if (this.pending.has(key) || this.handled.has(key)) {
      return false;
    }
    this.pending.add(key);
    return true;
  }

  complete(key: string, fingerprint: TriggerFingerprint): void {
    this.pending.delete(key);
    this.handled.set(key, fingerprint);
  }

  cancel(key: string): void {
    this.pending.delete(key);
  }

  prune(readRange: (fingerprint: TriggerFingerprint) => string): void {
    for (const [key, fingerprint] of this.handled.entries()) {
      if (readRange(fingerprint) !== fingerprint.matchedText) {
        this.handled.delete(key);
      }
    }
  }
}

class QuranReferenceModal extends Modal {
  private readonly onSubmitReference: (reference: string) => Promise<void>;

  constructor(app: App, onSubmitReference: (reference: string) => Promise<void>) {
    super(app);
    this.onSubmitReference = onSubmitReference;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.contentEl.createEl("h2", { text: "Insert Qur’an passage" });

    let reference = "";
    const setting = new Setting(this.contentEl)
      .setName("Ayah reference")
      .setDesc("Examples: 13:14 or 20:12-13")
      .addText((text) => {
        text.setPlaceholder("20:12-13");
        text.onChange((value: string) => {
          reference = value;
        });
        text.inputEl.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void submit();
          }
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    const submit = async (): Promise<void> => {
      const value = reference.trim();
      if (!value) {
        new Notice("Enter an ayah reference.");
        return;
      }
      this.close();
      await this.onSubmitReference(value);
    };

    setting.addButton((button) => {
      button.setButtonText("Insert");
      button.setCta();
      button.onClick(() => void submit());
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export default class QuranQuotePlugin extends Plugin {
  settings: QuranQuoteSettings = DEFAULT_SETTINGS;

  private readonly autoInsertTimers = new Map<Editor, number>();
  private readonly autoInsertInProgress = new WeakSet<Editor>();
  private readonly triggerRegistries = new WeakMap<Editor, AutomaticTriggerRegistry>();
  private readonly suppressAutoInsertUntil = new WeakMap<Editor, number>();
  private readonly undoGuards = new WeakMap<Editor, UndoGuard>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "insert-passage",
      name: "Insert Qur’an passage",
      editorCallback: (editor: Editor) => {
        const selectedReference = editor.getSelection().trim();
        if (selectedReference) {
          void this.insertFromCommand(editor, selectedReference);
          return;
        }

        new QuranReferenceModal(this.app, async (reference) => {
          await this.insertFromCommand(editor, reference);
        }).open();
      },
    });

    this.addRibbonIcon("book-open", "Insert Qur’an passage", () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view) {
        new Notice("Open a Markdown note before inserting an ayah.");
        return;
      }

      const selectedReference = view.editor.getSelection().trim();
      if (selectedReference) {
        void this.insertFromCommand(view.editor, selectedReference);
        return;
      }

      new QuranReferenceModal(this.app, async (reference) => {
        await this.insertFromCommand(view.editor, reference);
      }).open();
    });

    this.registerEvent(
      this.app.workspace.on("editor-change", (editor: Editor) => {
        this.queueAutoInsert(editor, 100);
      }),
    );

    // With auto-closing brackets, pressing `)` can move the cursor over an
    // existing closing parenthesis without changing the document. Listening
    // for the key ensures that case still triggers. The registry below makes
    // this safe even when editor-change fires as well.
    this.registerDomEvent(document, "keydown", (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest(".cm-editor")) {
        return;
      }
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "z";
      if (isUndo) {
        if (view) {
          this.suppressAutomaticInsertion(view.editor, 1500);
        }
        return;
      }
      if (
        event.key !== ")" ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !this.settings.autoInsertEnabled
      ) {
        return;
      }
      window.setTimeout(() => {
        if (view) {
          this.queueAutoInsert(view.editor, 0);
        }
      }, 0);
    });

    this.registerDomEvent(document, "beforeinput", (event: InputEvent) => {
      const target = event.target;
      if (
        !(target instanceof HTMLElement) ||
        !target.closest(".cm-editor") ||
        (event.inputType !== "historyUndo" && event.inputType !== "historyRedo")
      ) {
        return;
      }
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        this.suppressAutomaticInsertion(view.editor, 1500);
      }
    });

    this.addSettingTab(new QuranQuoteSettingTab(this.app, this));
  }

  onunload(): void {
    this.autoInsertTimers.forEach((timer) => window.clearTimeout(timer));
    this.autoInsertTimers.clear();
  }

  private registryFor(editor: Editor): AutomaticTriggerRegistry {
    let registry = this.triggerRegistries.get(editor);
    if (!registry) {
      registry = new AutomaticTriggerRegistry();
      this.triggerRegistries.set(editor, registry);
    }
    return registry;
  }

  private suppressAutomaticInsertion(editor: Editor, durationMs: number): void {
    const existingTimer = this.autoInsertTimers.get(editor);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
      this.autoInsertTimers.delete(editor);
    }
    this.suppressAutoInsertUntil.set(editor, Date.now() + durationMs);
  }

  private consumeUndoGuard(editor: Editor): boolean {
    const guard = this.undoGuards.get(editor);
    if (!guard) {
      return false;
    }
    const { fingerprint } = guard;
    if (fingerprint.line >= editor.lineCount()) {
      return false;
    }
    const restored = editor.getRange(
      { line: fingerprint.line, ch: fingerprint.startCh },
      { line: fingerprint.line, ch: fingerprint.endCh },
    );
    if (restored !== fingerprint.matchedText) {
      return false;
    }
    this.registryFor(editor).complete(guard.key, fingerprint);
    this.undoGuards.delete(editor);
    this.suppressAutomaticInsertion(editor, 1000);
    return true;
  }

  private queueAutoInsert(editor: Editor, delay: number): void {
    if (!this.settings.autoInsertEnabled || this.autoInsertInProgress.has(editor)) {
      return;
    }
    if (this.consumeUndoGuard(editor)) {
      return;
    }
    if ((this.suppressAutoInsertUntil.get(editor) ?? 0) > Date.now()) {
      return;
    }

    const registry = this.registryFor(editor);
    registry.prune((fingerprint) => {
      if (fingerprint.line >= editor.lineCount()) {
        return "";
      }
      return editor.getRange(
        { line: fingerprint.line, ch: fingerprint.startCh },
        { line: fingerprint.line, ch: fingerprint.endCh },
      );
    });

    const existingTimer = this.autoInsertTimers.get(editor);
    if (existingTimer !== undefined) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      this.autoInsertTimers.delete(editor);
      void this.maybeAutoInsert(editor);
    }, delay);

    this.autoInsertTimers.set(editor, timer);
  }

  private async maybeAutoInsert(editor: Editor): Promise<void> {
    if (
      !this.settings.autoInsertEnabled ||
      !this.settings.detectParenthesizedReference ||
      this.autoInsertInProgress.has(editor) ||
      (this.suppressAutoInsertUntil.get(editor) ?? 0) > Date.now()
    ) {
      return;
    }

    const cursor = editor.getCursor();
    const currentLine = editor.getLine(cursor.line);
    const match = findParenthesizedReferenceAtCursor(currentLine, cursor.ch);
    if (!match) {
      return;
    }

    const key = `${cursor.line}:${match.startCh}:${match.endCh}:${match.matchedText}`;
    const registry = this.registryFor(editor);
    if (!registry.begin(key)) {
      return;
    }

    const fingerprint: TriggerFingerprint = {
      line: cursor.line,
      startCh: match.startCh,
      endCh: match.endCh,
      matchedText: match.matchedText,
    };

    const inserted = await this.performAutomaticInsertion(editor, match, fingerprint);
    if (!inserted) {
      registry.cancel(key);
      return;
    }
    if (this.settings.outputStyle === "blockquote" && this.settings.keepTriggerReference) {
      registry.complete(key, fingerprint);
    } else {
      registry.cancel(key);
      this.undoGuards.set(editor, { key, fingerprint });
    }
  }

  private async performAutomaticInsertion(
    editor: Editor,
    match: ParenthesizedReferenceMatch,
    fingerprint: TriggerFingerprint,
  ): Promise<boolean> {
    this.autoInsertInProgress.add(editor);

    try {
      const reference = parseAyahReference(match.referenceText);
      const { ayahs, surahName } = await this.fetchAyahs(reference);
      const output = formatQuranOutput(reference, ayahs, surahName, this.settings);
      const from = { line: fingerprint.line, ch: fingerprint.startCh };
      const to = { line: fingerprint.line, ch: fingerprint.endCh };

      // The request is asynchronous. Do not touch the note if the source
      // trigger changed while the passage was loading.
      if (editor.getRange(from, to) !== fingerprint.matchedText) {
        return false;
      }

      this.suppressAutoInsertUntil.set(editor, Date.now() + 500);

      if (this.settings.outputStyle === "inline") {
        editor.replaceRange(output, from, to, "quran-quote-auto");
        return true;
      }

      const paragraphStartLine = this.findParagraphStartLine(editor, fingerprint.line);
      const paragraphEndLine = this.findParagraphEndLine(editor, fingerprint.line);
      const paragraphLines: string[] = [];
      for (let line = paragraphStartLine; line <= paragraphEndLine; line += 1) {
        paragraphLines.push(editor.getLine(line));
      }
      const replacement = buildBlockquoteParagraphReplacement(
        paragraphLines,
        fingerprint.line - paragraphStartLine,
        fingerprint.startCh,
        fingerprint.endCh,
        output,
        this.settings.keepTriggerReference,
      );
      editor.replaceRange(
        replacement,
        { line: paragraphStartLine, ch: 0 },
        { line: paragraphEndLine, ch: editor.getLine(paragraphEndLine).length },
        "quran-quote-auto",
      );
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Qur’an passage could not be inserted.";
      new Notice(message, 7000);
      return false;
    } finally {
      this.autoInsertInProgress.delete(editor);
    }
  }

  private findParagraphStartLine(editor: Editor, startLine: number): number {
    let paragraphStartLine = startLine;
    while (paragraphStartLine > 0) {
      const previousLine = editor.getLine(paragraphStartLine - 1);
      if (previousLine.trim() === "") {
        break;
      }
      paragraphStartLine -= 1;
    }
    return paragraphStartLine;
  }

  private findParagraphEndLine(editor: Editor, startLine: number): number {
    let endLine = startLine;

    while (endLine + 1 < editor.lineCount()) {
      const nextLine = editor.getLine(endLine + 1);
      if (nextLine.trim() === "") {
        break;
      }
      endLine += 1;
    }

    return endLine;
  }

  private async insertFromCommand(editor: Editor, input: string): Promise<void> {
    try {
      const reference = parseAyahReference(input);
      const { ayahs, surahName } = await this.fetchAyahs(reference);
      const output = formatQuranOutput(reference, ayahs, surahName, this.settings);
      editor.replaceSelection(output);
      new Notice(`Inserted Qur’an ${formatReference(reference)}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Qur’an passage could not be inserted.";
      new Notice(message, 7000);
    }
  }

  private async fetchAyahs(reference: AyahReference): Promise<{ ayahs: QuoteAyah[]; surahName: string }> {
    const [arabicSurah, translatedSurah] = await Promise.all([
      this.fetchEdition(reference, this.settings.arabicEdition),
      this.fetchEdition(reference, this.settings.translationEdition),
    ]);

    const expectedCount = reference.endAyah - reference.startAyah + 1;
    if (arabicSurah.ayahs.length !== expectedCount || translatedSurah.ayahs.length !== expectedCount) {
      throw new Error("That ayah range is not valid for the selected surah.");
    }

    const translations = new Map(
      translatedSurah.ayahs.map((ayah) => [ayah.numberInSurah, ayah.text] as const),
    );

    const ayahs = arabicSurah.ayahs.map((ayah) => {
      const english = translations.get(ayah.numberInSurah);
      if (!english) {
        throw new Error(`The English translation for ayah ${ayah.numberInSurah} was not returned.`);
      }

      return {
        number: ayah.numberInSurah,
        arabic: ayah.text,
        english,
      };
    });

    return { ayahs, surahName: arabicSurah.englishName };
  }

  private async fetchEdition(reference: AyahReference, edition: string): Promise<ApiSurah> {
    const offset = reference.startAyah - 1;
    const limit = reference.endAyah - reference.startAyah + 1;
    const url = `${API_BASE_URL}/surah/${reference.surah}/${encodeURIComponent(edition)}?offset=${offset}&limit=${limit}`;

    let response: RequestUrlResponse;
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

    return payload.data;
  }

  async loadSettings(): Promise<void> {
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
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}

class QuranQuoteSettingTab extends PluginSettingTab {
  private readonly plugin: QuranQuotePlugin;

  constructor(app: App, plugin: QuranQuotePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
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

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Automatic insertion")
      .setDesc("Detect a completed Qur’an reference inside parentheses while you type.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoInsertEnabled);
        toggle.onChange(async (value: boolean) => {
          this.plugin.settings.autoInsertEnabled = value;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (this.plugin.settings.autoInsertEnabled) {
      new Setting(containerEl)
        .setName("Parenthesized reference trigger")
        .setDesc("Type (13:14) or (20:12-13) anywhere in a sentence or paragraph. Auto-closing parentheses are supported.")
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.detectParenthesizedReference);
          toggle.onChange(async (value: boolean) => {
            this.plugin.settings.detectParenthesizedReference = value;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(containerEl)
      .setName("Content")
      .setDesc("Choose whether the generated passage contains English only or Arabic followed by English.")
      .addDropdown((dropdown) => {
        dropdown.addOption("english-only", "English + Qur’an reference");
        dropdown.addOption("arabic-english", "Arabic + English + Qur’an reference");
        dropdown.setValue(this.plugin.settings.contentMode);
        dropdown.onChange(async (value: string) => {
          this.plugin.settings.contentMode = value as QuranContentMode;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Layout")
      .setDesc("Insert the passage as a Markdown blockquote beneath the paragraph or replace the trigger inline.")
      .addDropdown((dropdown) => {
        dropdown.addOption("blockquote", "Quote block beneath paragraph");
        dropdown.addOption("inline", "Inline at the trigger position");
        dropdown.setValue(this.plugin.settings.outputStyle);
        dropdown.onChange(async (value: string) => {
          this.plugin.settings.outputStyle = value as QuranOutputStyle;
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (this.plugin.settings.outputStyle === "blockquote") {
      new Setting(containerEl)
        .setName("Keep typed reference")
        .setDesc("Keep the original (13:14) in the sentence. Turn this off to remove it after adding the quote block.")
        .addToggle((toggle) => {
          toggle.setValue(this.plugin.settings.keepTriggerReference);
          toggle.onChange(async (value: boolean) => {
            this.plugin.settings.keepTriggerReference = value;
            await this.plugin.saveSettings();
          });
        });
    } else {
      new Setting(containerEl)
        .setName("Inline trigger replacement")
        .setDesc("Inline layout replaces the typed parenthesized trigger with the generated passage and its formatted Qur’an reference.");
      new Setting(containerEl)
        .setName("Inline emphasis")
        .setDesc("Make inline passages stand out using plain text, italics, or bold text.")
        .addDropdown((dropdown) => {
          dropdown.addOption("none", "Plain");
          dropdown.addOption("italic", "Italic");
          dropdown.addOption("bold", "Bold");
          dropdown.setValue(this.plugin.settings.inlineEmphasis);
          dropdown.onChange(async (value: string) => {
            this.plugin.settings.inlineEmphasis = value as InlineEmphasis;
            await this.plugin.saveSettings();
          });
        });
    }

    new Setting(containerEl)
      .setName("English translation")
      .setDesc("Choose the English translation used in the generated passage.")
      .addDropdown((dropdown) => {
        Object.entries(TRANSLATIONS).forEach(([id, label]) => dropdown.addOption(id, label));
        dropdown.setValue(this.plugin.settings.translationEdition);
        dropdown.onChange(async (value: string) => {
          this.plugin.settings.translationEdition = value as TranslationEdition;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show verse numbers")
      .setDesc("Append Arabic verse markers and number English verses in a range.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeVerseNumbers);
        toggle.onChange(async (value: boolean) => {
          this.plugin.settings.includeVerseNumbers = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show translation credit")
      .setDesc("Add the selected translator to the formatted Qur’an reference.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeTranslationCredit);
        toggle.onChange(async (value: boolean) => {
          this.plugin.settings.includeTranslationCredit = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Show surah name")
      .setDesc("Add the English surah name to the formatted Qur’an reference.")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.includeSurahName);
        toggle.onChange(async (value: boolean) => {
          this.plugin.settings.includeSurahName = value;
          await this.plugin.saveSettings();
        });
      });
  }
}
