"""포트폴리오 PDF에서 대표 페이지를 골라 WebP로 변환한다. (원본 PDF는 저장소에 포함하지 않음)
프로필 페이지는 전화번호 끝 4자리와 이메일을 가린 뒤 저장한다.
사용: python scripts/export_images.py
"""
import pymupdf, os, glob, re
from PIL import Image, ImageDraw
# 지원자 원본 폴더. 기본값은 프로젝트 폴더 바로 옆의 "01_입사 지원자". 다르면 환경변수 APPLICANT_ROOT 로 지정한다.
ROOT = os.environ.get("APPLICANT_ROOT") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "01_입사 지원자")
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
# 순번: (폴더 접두어, 프로필 페이지 또는 None, 작품 페이지들)
PICK = {
 # 대표 작업은 지원자당 5장 (첫 장이 목록 썸네일에 쓰인다)
 "01": ("경력 01", 2, [4, 6, 7, 11, 12]), "02": ("신입 01", None, [2, 6, 8, 10, 12]), "03": ("경력 02", 2, [6, 9, 12, 13, 14]),
 "04": ("경력 03", 2, [4, 12, 16, 19, 22]), "05": ("신입 02", 4, [9, 10, 14, 17, 21]), "06": ("신입 03", 2, [4, 8, 10, 16, 20]),
 "07": ("신입 04", 3, [7, 11, 14, 17, 23]), "08": ("신입 05", None, [4, 5, 6, 7, 9]), "09": ("신입 06", 2, [4, 6, 15, 19, 20]),
 "10": ("신입 07", 2, [5, 6, 7, 12, 14]), "11": ("경력 04", 2, [10, 13, 16, 20, 23]), "12": ("경력 05", None, [2, 3, 5, 7, 16]),
 "13": ("신입 08", 2, [4, 10, 16, 17, 22]), "14": ("경력 06", 3, [4, 8, 12, 15, 22]), "15": ("신입 09", 1, [2, 7, 10, 12, 15]),
}
# 이미지로만 된 프로필 페이지: 가릴 영역(좌, 위, 오른쪽, 아래; 페이지 대비 비율)
MANUAL = {
 "01": [(0.2685, 0.364, 0.322, 0.395), (0.195, 0.398, 0.345, 0.456)],  # 번호 글자가 깨져 추출되는 페이지
 "03": [(518/1500, 156/1038, 560/1500, 182/1038), (422/1500, 188/1038, 575/1500, 214/1038), (188/1500, 160/1038, 234/1500, 182/1038)],
 "13": [(290/1500, 547/1060, 336/1500, 570/1060), (195/1500, 574/1060, 350/1500, 595/1060), (231/1500, 497/1060, 271/1500, 518/1060)],
 "14": [(294/1500, 395/1060, 342/1500, 419/1060), (199/1500, 427/1060, 249/1500, 449/1060)],
}
GRAY = (200, 200, 200)
# 생년월일은 출생연도만 남기고 월·일을 가린다 (출생연도는 엑셀 값)
BYEAR = {"01": 1991, "03": 1997, "06": 2002, "07": 2002, "09": 2000, "10": 2001, "11": 1992, "13": 2000, "14": 1992, "15": 2002}

def auto_boxes(pg, byear=None):
    w = [x for x in pg.get_text("words") if re.search(r"[0-9A-Za-z@가-힣]", x[4])]
    boxes = []
    for i, x in enumerate(w):
        t = x[4]
        if byear:
            m = re.fullmatch(rf"{byear}[./-]\s?\d{{2}}[./-]\s?\d{{2}}[,]?", t)
            if m:                                           # 2002.05.30 한 덩어리
                boxes.append((x[0] + (x[2]-x[0]) * 5 / len(t), x[1], x[2], x[3])); continue
            if re.sub(r"\D", "", t) == str(byear) and len(re.sub(r"\D", "", t)) == 4 and i + 2 < len(w):
                a, b = w[i+1], w[i+2]                       # 2002. 07. 06 / 2000 . 08 . 15
                if re.fullmatch(r"\d{1,2}\.?", a[4]) and re.fullmatch(r"\d{1,2}\.?", b[4]) and abs(a[1]-x[1]) < 6:
                    boxes.append((a[0], min(a[1], b[1]), b[2], max(a[3], b[3]))); continue
        if "@" in t:  # 이메일, SNS 계정
            boxes.append((x[0], x[1], x[2], x[3])); continue
        c = re.sub(r"\D", "", t)
        if len(c) >= 10 and c.startswith("010"):           # 한 덩어리 번호
            frac = 4 / max(len(re.sub(r"[^0-9\-]", "", t)), 4)
            boxes.append((x[0] + (x[2]-x[0]) * (1-frac), x[1], x[2], x[3])); continue
        if re.fullmatch(r"\d{4}", c) and i >= 1 and re.fullmatch(r"\d{4}", re.sub(r"\D", "", w[i-1][4]) or "x"):
            prev3 = [re.sub(r"\D", "", y[4]) for y in w[max(0, i-4):i-1]]
            if any(p in ("010", "10", "82", "8210") for p in prev3) and abs(w[i-1][1] - x[1]) < 6:
                boxes.append((x[0], x[1], x[2], x[3]))
    return boxes

def render(pg, key, masks=True, width=1400):
    z = width / pg.rect.width
    pm = pg.get_pixmap(matrix=pymupdf.Matrix(z, z), alpha=False)
    im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    if masks:
        d = ImageDraw.Draw(im)
        for b in (auto_boxes(pg, BYEAR.get(key)) if key not in MANUAL else []):
            d.rectangle([b[0]*z-2, b[1]*z-2, b[2]*z+2, b[3]*z+2], fill=GRAY)
        for b in MANUAL.get(key, []):
            d.rectangle([b[0]*im.width, b[1]*im.height, b[2]*im.width, b[3]*im.height], fill=GRAY)
    return im

for k, (pre, prof, works) in PICK.items():
    folder = [f for f in os.listdir(ROOT) if f.startswith(pre)][0]
    pdfs = [f for f in glob.glob(os.path.join(ROOT, folder, "*")) if f.lower().endswith(".pdf")]
    f = max([p for p in pdfs if any(x in p.lower() for x in ["포트폴리오", "portfolio", "포르폴리오", "vol.2"])], key=os.path.getsize)
    d = pymupdf.open(f); od = os.path.join(OUT, "a" + k); os.makedirs(od, exist_ok=True)
    # 번호가 붙은 작업·프로필 이미지만 지운다 (face.webp, thumb.webp는 다른 스크립트가 만든다)
    for old in glob.glob(od + "/*.webp"):
        if os.path.basename(old).split(".")[0].isdigit(): os.remove(old)
    items = ([("profile", prof)] if prof else []) + [("work", p) for p in works]
    tot = 0
    for n, (kind, p) in enumerate(items, 1):
        # 프로필 페이지는 글씨가 작아 고해상도(2000px)·고화질로 저장한다
        im = render(d[p-1], k, masks=(kind == "profile"), width=2000 if kind == "profile" else 1400)
        fp = os.path.join(od, f"{n}.webp"); im.save(fp, "WEBP", quality=88 if kind == "profile" else 78); tot += os.path.getsize(fp)
    print(k, folder, "profile" if prof else "-", works, round(tot/1024), "KB")
