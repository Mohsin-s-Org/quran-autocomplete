class Plugin {}
class PluginSettingTab {}
class Modal {}
class Notice {}
class Setting {}
class App {}
class Editor {}
class MarkdownView {}

async function requestUrl() {
  throw new Error("requestUrl is not available in unit tests");
}

module.exports = {
  Plugin,
  PluginSettingTab,
  Modal,
  Notice,
  Setting,
  App,
  Editor,
  MarkdownView,
  requestUrl,
};
