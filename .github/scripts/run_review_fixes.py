from pathlib import Path
import json
import runpy

manifest = json.loads(Path('manifest.json').read_text())
if manifest.get('version') != '0.5.2':
    runpy.run_path('.github/scripts/apply_review_fixes.py', run_name='__main__')
