"""지원자 얼굴 사진을 이력서·포트폴리오 PDF에서 잘라 assets/img/aNN/face.webp 로 저장한다.
사진 위치는 페이지 대비 비율(좌, 위, 오른쪽, 아래)로 직접 지정했다. (사진이 없는 지원자는 목록에 없음)
사용: python scripts/crop_faces.py
"""
import pymupdf, os, glob
from PIL import Image

# 지원자 원본 폴더. 기본값은 프로젝트 폴더 바로 옆의 "01_입사 지원자". 다르면 환경변수 APPLICANT_ROOT 로 지정한다.
ROOT = os.environ.get("APPLICANT_ROOT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "01_입사 지원자")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
# 순번: (폴더 접두어, 파일명 키워드, 페이지(0부터), (좌, 위, 우, 아래))
FACES = {
    1: ("경력 01", "경력지원서", 0, (0.050, 0.113, 0.210, 0.258)),
    3: ("경력 02", "포트폴리오", 1, (0.780, 0.298, 0.893, 0.460)),
    4: ("경력 03", "Portfolio", 1, (0.081, 0.168, 0.192, 0.383)),
    5: ("신입 02", "이력서", 0, (0.050, 0.078, 0.200, 0.198)),
    6: ("신입 03", "이력서", 0, (0.144, 0.186, 0.300, 0.321)),
    8: ("신입 05", "이력서", 0, (0.752, 0.038, 0.906, 0.167)),
    10: ("신입 07", "자기소개서", 0, (0.766, 0.172, 0.892, 0.285)),
    11: ("경력 04", "이력서", 0, (0.794, 0.085, 0.954, 0.229)),
    12: ("경력 05", "이력서", 0, (0.030, 0.059, 0.240, 0.209)),
    13: ("신입 08", "vol.2", 1, (0.082, 0.134, 0.245, 0.365)),
    15: ("신입 09", "포르폴리오", 0, (0.043, 0.070, 0.156, 0.217)),
}

# 미세 조정: 순번: (가로 이동, 세로 이동, 크기 배율) — 이동량은 1차 자른 크기 대비 비율
ADJ = {
    1: (0.00, -0.14, 0.76), 3: (0.05, -0.10, 0.90), 4: (0.00, -0.08, 0.82), 5: (-0.05, -0.17, 0.64),
    6: (0.00, -0.20, 0.72), 8: (0.00, -0.08, 1.00), 10: (-0.03, -0.11, 0.72), 11: (0.02, -0.20, 0.56),
    12: (-0.04, -0.14, 0.33), 13: (0.03, -0.18, 0.60), 15: (0.01, 0.12, 0.86),
}

for no, (pre, kw, pi, (l, t, r, b)) in FACES.items():
    folder = [f for f in os.listdir(ROOT) if f.startswith(pre)][0]
    f = [x for x in glob.glob(os.path.join(ROOT, folder, "*")) if x.lower().endswith(".pdf") and kw.lower() in x.lower()][0]
    pg = pymupdf.open(f)[pi]
    W, H = pg.rect.width, pg.rect.height
    cx, cy = (l + r) / 2 * W, (t + b) / 2 * H
    side = max((r - l) * W, (b - t) * H) * 1.08
    dx, dy, k = ADJ.get(no, (0, 0, 1))
    cx, cy, side = cx + dx * side, cy + dy * side, side * k
    clip = pymupdf.Rect(cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2) & pg.rect
    z = 480 / max(clip.width, clip.height)
    pm = pg.get_pixmap(matrix=pymupdf.Matrix(z, z), clip=clip, alpha=False)
    im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    s = min(im.size); im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2))
    d = os.path.join(OUT, f"a{no:02d}"); os.makedirs(d, exist_ok=True)
    im.resize((360, 360)).save(os.path.join(d, "face.webp"), "WEBP", quality=88)
    print(no, folder[:10], os.path.basename(f)[:20])
