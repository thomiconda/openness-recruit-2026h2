"""목록용 썸네일(assets/img/aNN/thumb.webp)을 만든다. 첫 번째 작품 이미지를 520px로 줄여 사용.
export_images.py 실행 뒤에 실행: python scripts/make_thumbs.py
"""
import os, glob
from PIL import Image

NO_PROFILE = {"a02", "a08", "a12"}
BASE = os.path.join(os.path.dirname(__file__), "..", "assets", "img")
for d in sorted(glob.glob(os.path.join(BASE, "a*"))):
    files = sorted(f for f in os.listdir(d) if f.split(".")[0].isdigit() and f.endswith(".webp"))
    if not files:
        continue
    # 첫 장이 프로필 페이지면 건너뛰고 작품 이미지를 쓴다 (프로필 페이지가 없는 지원자: 02, 08, 12)
    src = files[0] if os.path.basename(d) in NO_PROFILE else files[1]
    im = Image.open(os.path.join(d, src)).convert("RGB")
    im.thumbnail((520, 520))
    im.save(os.path.join(d, "thumb.webp"), "WEBP", quality=72)
    print(os.path.basename(d), src, os.path.getsize(os.path.join(d, "thumb.webp")) // 1024, "KB")
