"""엑셀(1번 시트) -> data/applicants.js 변환 (연락처/이메일 일부 마스킹).

사용: python scripts/build_data.py "<엑셀 경로>"
- 2번 시트(지난해 전공무관 지원자)는 읽지 않는다.
- 원본 엑셀/PDF는 저장소에 포함하지 않는다(.gitignore).
"""
import json, re, sys, os
import openpyxl

SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "..", "data", "applicants.js")
EMPTY = {"", "기재 X", "기재X", "X", None}


def clean(v):
    if v is None:
        return ""
    s = str(v).strip()
    return "" if s in EMPTY else s


def mask_phone(v):
    s = clean(v)
    m = re.match(r"(\d{2,3})-(\d{3,4})-(\d{4})", s)
    return f"{m.group(1)}-{m.group(2)}-****" if m else s


def mask_email(v):
    s = clean(v).rstrip(">")
    if "@" not in s:
        return s
    user, dom = s.split("@", 1)
    return user[:2] + "***@" + dom


def scrub(text):
    """자유서술 칸(비고 등)에 섞인 연락처/이메일 제거."""
    text = re.sub(r"0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4}", "***-****-****", text)
    text = re.sub(r"[\w.+-]+@[\w-]+\.[\w.]+", "***@***", text)
    return text


BASE = os.path.join(os.path.dirname(__file__), "..")
PROFILES = json.load(open(os.path.join(BASE, "data", "profiles.json"), encoding="utf-8"))


def images_for(no):
    d = os.path.join(BASE, "assets", "img", f"a{no:02d}")
    if not os.path.isdir(d):
        return []
    return [f"assets/img/a{no:02d}/{f}" for f in sorted(os.listdir(d)) if f.split(".")[0].isdigit() and f.endswith(".webp")]


def face_for(no):
    p = f"assets/img/a{no:02d}/face.webp"
    return p if os.path.exists(os.path.join(BASE, p)) else None


def thumb_for(no):
    p = f"assets/img/a{no:02d}/thumb.webp"
    return p if os.path.exists(os.path.join(BASE, p)) else None


wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb.worksheets[0]
rows = list(ws.iter_rows(values_only=True))
hdr = [re.sub(r"\s+", " ", str(h)).strip() if h else "" for h in rows[0]]
ix = {re.split(r"\s*\*", h)[0].strip(): i for i, h in enumerate(hdr)}

# 지원자별 개별 수정(이름 표기, 비고 문구 통일)은 data/overrides.json 에 둔다.
# (이름 같은 개인정보가 코드에 들어가지 않도록 올리지 않는 data/ 폴더에서 읽는다)
_ovr_path = os.path.join(BASE, "data", "overrides.json")
OVR = json.load(open(_ovr_path, encoding="utf-8-sig")) if os.path.exists(_ovr_path) else {}
NAME_FIX = {int(k): v for k, v in OVR.get("name", {}).items()}               # 예: {"8": "표기할 이름"}
NOTE_FIX = {int(k): tuple(v) for k, v in OVR.get("noteReplace", {}).items()}  # 예: {"9": ["바꿀 문구", "새 문구"]}

NOTE_DROP = ("희망연봉", "경력증명서")          # 웹에 싣지 않는 항목


def fix_note(no, text):
    parts = [p.strip() for p in text.split(" / ") if p.strip()]
    parts = [p for p in parts if not any(k in p for k in NOTE_DROP)]
    out = " / ".join(parts)
    if no in NOTE_FIX:
        out = out.replace(*NOTE_FIX[no])
    return out


people = []
for r in rows[1:]:
    no = r[ix["순번"]]
    if not str(no).isdigit():  # '예시' 행 제외
        continue
    g = lambda k: r[ix[k]]
    date = g("지원일자")
    people.append({
        "no": int(no),
        "name": NAME_FIX.get(int(no), clean(g("이름"))),
        "type": clean(g("신입/경력")),
        "appliedAt": date.strftime("%Y-%m-%d") if hasattr(date, "strftime") else clean(date),
        "gender": clean(g("성별")),
        "birthYear": clean(g("출생년도")),
        "age": (2026 - int(g("출생년도"))) if str(g("출생년도")).strip().isdigit() else None,  # 연 나이(2026-출생연도)
        "bachelor": clean(g("학사")),
        "master": clean(g("석사")),
        "major": clean(g("학과 (최종학력)")),
        "docs": {"portfolio": clean(g("포트폴리오")), "resume": clean(g("이력서")), "coverLetter": clean(g("자기소개서"))},
        "certificates": clean(g("자격증")),
        "residence": clean(g("거주지")),
        "phone": mask_phone(g("연락처")),
        "email": mask_email(g("이메일")),
        "note": fix_note(int(no), scrub(clean(g("비고")))),
        "profile": PROFILES.get(str(int(no))),
        "images": images_for(int(no)),
        "thumb": thumb_for(int(no)),
        "face": face_for(int(no)),
        "profileImage": int(no) not in (2, 8, 12),  # images[0]이 프로필 페이지(얼굴 사진·인적 정보)인지
    })

with open(OUT, "w", encoding="utf-8") as f:
    f.write("// 자동 생성 파일 - scripts/build_data.py 로 만든다. 직접 수정하지 말 것.\n")
    f.write("window.APPLICANTS = " + json.dumps(people, ensure_ascii=False, indent=2) + ";\n")
print(len(people), "명 ->", os.path.abspath(OUT))
