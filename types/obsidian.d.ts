declare module "obsidian" {
  export class App {
    workspace: any;
  }

  export interface EditorPosition {
    line: number;
    ch: number;
  }

  export class Editor {
    getSelection(): string;
    replaceSelection(value: string): void;
    getCursor(side?: "from" | "to" | "head" | "anchor"): EditorPosition;
    getLine(line: number): string;
    lineCount(): number;
    getRange(from: EditorPosition, to: EditorPosition): string;
    replaceRange(replacement: string, from: EditorPosition, to?: EditorPosition, origin?: string): void;
  }

  export class MarkdownView {
    editor: Editor;
  }

  export class Modal {
    app: App;
    contentEl: any;
    constructor(app: App);
    open(): void;
    close(): void;
    onOpen(): void;
    onClose(): void;
  }

  export class Notice {
    constructor(message: string, timeout?: number);
  }

  export class Plugin {
    app: App;
    addCommand(command: any): void;
    addRibbonIcon(icon: string, title: string, callback: () => void): HTMLElement;
    addSettingTab(tab: PluginSettingTab): void;
    registerEvent(eventRef: any): void;
    registerDomEvent(el: Document | HTMLElement, type: string, callback: (event: any) => any, options?: any): void;
    loadData(): Promise<any>;
    saveData(data: any): Promise<void>;
  }

  export class PluginSettingTab {
    app: App;
    containerEl: any;
    constructor(app: App, plugin: Plugin);
    display(): void;
  }

  export class Setting {
    settingEl: any;
    constructor(containerEl: any);
    setName(name: string): this;
    setDesc(description: string): this;
    addText(callback: (component: any) => void): this;
    addButton(callback: (component: any) => void): this;
    addDropdown(callback: (component: any) => void): this;
    addToggle(callback: (component: any) => void): this;
  }

  export function requestUrl(options: any): Promise<any>;
}
