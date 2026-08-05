from pathlib import Path
import json
import runpy

manifest = json.loads(Path('manifest.json').read_text())
if manifest.get('version') != '0.5.2':
    runpy.run_path('.github/scripts/apply_review_fixes.py', run_name='__main__')
    source_path = Path('src/main.ts')
    source = source_path.read_text()
    source = source.replace(
        '  Setting,\n  requestUrl,\n  RequestUrlResponse,\n',
        '  Setting,\n  SettingDefinitionItem,\n  requestUrl,\n  RequestUrlResponse,\n',
    )
    source = source.replace(
        '  getSettingDefinitions() {\n',
        '  getSettingDefinitions(): SettingDefinitionItem[] {\n',
    )
    source_path.write_text(source)
