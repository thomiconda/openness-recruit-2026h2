"""공개 저장소용 배포본을 만든다. 지원자 데이터·이미지는 비밀번호로 암호화되어 docs/ 에 저장된다.

사용:
    python scripts/build_secure.py            # 비밀번호를 입력창으로 묻는다 (화면에 표시되지 않음)
    SITE_PASSWORD=... python scripts/build_secure.py   # 환경변수로 전달

방식
- 비밀번호 -> PBKDF2-SHA256(60만 회) -> AES-256-GCM 키. 비밀번호 자체는 어디에도 저장하지 않는다.
- docs/payload.js : 지원자 데이터 + 일정 + 안내 + 얼굴/썸네일(작은 이미지) 암호문
- docs/b/aNN.js   : 지원자별 큰 이미지(프로필 페이지·대표 작업) 암호문 (상세 페이지를 열 때 불러옴)
- docs/index.html, css/, js/, assets/logo.png, assets/lock.jpg : 개인정보가 없는 공개 파일
※ file:// 에서도 열리도록 암호문은 .js 파일(base64)로 감싸 둔다.
※ 4자리 숫자 같은 짧은 비밀번호는 암호문을 내려받아 대입 공격을 하면 풀릴 수 있다. 길고 복잡할수록 안전하다.
"""
import base64, getpass, json, os, shutil, struct, sys
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.join(BASE, "docs")
ITER = 600_000


def rd(p):
    return open(os.path.join(BASE, p), encoding="utf-8-sig").read()


def b64(b):
    return base64.b64encode(b).decode()


pw = os.environ.get("SITE_PASSWORD") or getpass.getpass("비밀번호: ")
if not pw:
    sys.exit("비밀번호가 비어 있습니다.")
salt = os.urandom(16)
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITER).derive(pw.encode("utf-8"))
aes = AESGCM(key)


def seal(plain: bytes) -> bytes:
    iv = os.urandom(12)
    return iv + aes.encrypt(iv, plain, None)


# ---- 출력 폴더 정리 (docs/ 안의 배포 파일만 다시 만든다) ----
for name in ("b", "css", "js", "assets"):
    shutil.rmtree(os.path.join(OUT, name), ignore_errors=True)
for name in ("index.html", "payload.js"):
    p = os.path.join(OUT, name)
    if os.path.exists(p):
        os.remove(p)
os.makedirs(os.path.join(OUT, "b"), exist_ok=True)

# ---- 지원자 데이터 ----
t = rd("data/applicants.js")
apps = json.loads(t[t.index("["):t.rindex("]") + 1])


def data_uri(path):
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    return f"data:image/{ext};base64," + b64(open(os.path.join(BASE, path), "rb").read())


total_bundle = 0
for a in apps:
    # 큰 이미지는 지원자별 번들로 분리
    files = a["images"]
    blobs = [open(os.path.join(BASE, p), "rb").read() for p in files]
    header = json.dumps({"files": [{"type": "image/webp", "size": len(b)} for b in blobs]}).encode()
    plain = struct.pack(">I", len(header)) + header + b"".join(blobs)
    enc = seal(plain)
    with open(os.path.join(OUT, "b", f"a{a['no']:02d}.js"), "w") as f:
        f.write(f"(window.__B=window.__B||{{}})[{a['no']}]=\"{b64(enc)}\";")
    total_bundle += len(enc)
    a["imageCount"] = len(files)
    a["images"] = []
    # 작은 이미지(얼굴·목록 썸네일)는 본문에 포함
    a["thumb"] = data_uri(a["thumb"]) if a.get("thumb") else None
    a["face"] = data_uri(a["face"]) if a.get("face") else None

payload = {
    "applicants": apps,
    "scripts": {"schedule": rd("data/schedule.js"), "guide": rd("data/guide.js")},
}
body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
head = b"OPN1" + struct.pack(">I", ITER) + salt          # 매직 + 반복 횟수 + salt
blob = head + seal(body)
with open(os.path.join(OUT, "payload.js"), "w") as f:
    f.write(f"window.__PAYLOAD=\"{b64(blob)}\";")

# ---- 공개 파일 ----
shutil.copytree(os.path.join(BASE, "css"), os.path.join(OUT, "css"), dirs_exist_ok=True)
shutil.copytree(os.path.join(BASE, "js"), os.path.join(OUT, "js"), dirs_exist_ok=True)
os.makedirs(os.path.join(OUT, "assets"), exist_ok=True)
shutil.copy(os.path.join(BASE, "assets", "logo.png"), os.path.join(OUT, "assets", "logo.png"))
lock = os.path.join(BASE, "assets", "lock.jpg")            # 비밀번호 화면 배경 사진 (개인정보 없음)
if os.path.exists(lock):
    shutil.copy(lock, os.path.join(OUT, "assets", "lock.jpg"))
for p in (os.path.join(OUT, "css", "style.css"), os.path.join(OUT, "js", "app.js"), os.path.join(OUT, "js", "gate.js")):
    if os.path.exists(p):                                  # BOM 제거
        b = open(p, "rb").read()
        if b.startswith(b"\xef\xbb\xbf"):
            open(p, "wb").write(b[3:])

html = rd("index.html")
for tag in ('<script src="data/applicants.js"></script>', '<script src="data/schedule.js"></script>',
            '<script src="data/guide.js"></script>', '<script src="js/app.js"></script>'):
    html = html.replace(tag, "")
html = html.replace("<body>", '<body class="locked">')
gate = rd("js/gate.html")
html = html.replace("<header", gate + "\n<header", 1)
html = html.replace("</body>", '<script src="payload.js"></script>\n<script src="js/gate.js"></script>\n</body>')
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)

print(f"완료: docs/  (본문 {len(blob)//1024}KB, 이미지 번들 {total_bundle//1024//1024}MB)")
