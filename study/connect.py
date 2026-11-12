"""Register this checkout as the Chrome extension's native host for the current user."""
import base64
import hashlib
import json
import os
from pathlib import Path
import sys
import winreg

from host import HOST_NAME

def register():
    project = Path(__file__).resolve().parent
    manifest = json.loads((project / "extension/manifest.json").read_text(encoding="utf-8"))
    digest = hashlib.sha256(base64.b64decode(manifest["key"])).hexdigest()[:32]
    extension_id = digest.translate(str.maketrans("0123456789abcdef", "abcdefghijklmnop"))
    directory = Path(os.environ["LOCALAPPDATA"]) / "NewsDigestWriting"
    directory.mkdir(exist_ok=True)
    runner = directory / "launch.cmd"
    # Percent signs are literal characters in these generated batch arguments.
    python = sys.executable.replace("%", "%%")
    bootstrap = directory / "launch.py"
    bootstrap.write_text("import runpy\nrunpy.run_path(" + ascii(str(project / "host.py")) +
                         ", run_name='__main__')\n", encoding="ascii")
    runner.write_text(f'@echo off\nchcp 65001 >nul 2>nul\n"{python}" -B -u "%~dp0launch.py"\n',
                      encoding="utf-8", newline="\r\n")
    config = directory / "host.json"
    config.write_text(json.dumps({"name":HOST_NAME, "description":"News Digest writing tutor",
        "path":str(runner), "type":"stdio", "allowed_origins":[f"chrome-extension://{extension_id}/"]
    }, ensure_ascii=True, indent=2), encoding="utf-8")
    registry = "Software\\Google\\Chrome\\NativeMessagingHosts\\" + HOST_NAME
    with winreg.CreateKeyEx(winreg.HKEY_CURRENT_USER, registry, 0, winreg.KEY_SET_VALUE) as key:
        winreg.SetValueEx(key, "", 0, winreg.REG_SZ, str(config))
    print("Chrome AI 연결 등록 완료")
    print("확장 프로그램 폴더:", project / "extension")

if __name__ == "__main__":
    register()
