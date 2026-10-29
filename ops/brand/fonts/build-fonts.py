"""
Rebuild the self-hosted brand fonts (woff2) from the google/fonts sources (SIL OFL 1.1).

    pip install fonttools brotli
    python ops/brand/fonts/build-fonts.py            # writes the .woff2 files next to this script

Subset: Latin, Latin Extended (Turkish, Azerbaijani, Turkmen, ...), Cyrillic and Cyrillic Extended (Kazakh, Kyrgyz, ...).
Variable weight axis kept (Onest 400-700, IBM Plex Sans 400-700, italic 400-600); IBM Plex Sans width fixed at 100.
The same files are copied into the tamga.network and tamgawallet.com sites (src/fonts/), which also carry Noto Sans Old Turkic.
"""
import io
import os
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
OUT = os.path.dirname(os.path.abspath(__file__))
RANGES = (
    "0000-00FF,0131,0152-0153,02BB-02BC,02C6,02DA,02DC,0300-0308,0329,2000-206F,20AC,2122,2190-2199,2212,2215,2713,FEFF,FFFD,"
    "0100-02BA,02BD-02C5,02C7-02CC,02CE-02D7,02DD-02FF,1E00-1E9F,1EF2-1EFF,20A0-20C0,2113,2C60-2C7F,A720-A7FF,"
    "0400-052F,1C80-1C8A,2116,2DE0-2DFF,A640-A69F,FE2E-FE2F"
)


def unicodes():
    out = []
    for part in RANGES.split(","):
        a, _, b = part.partition("-")
        out += range(int(a, 16), int(b or a, 16) + 1)
    return out


def build(src, dst, axes=None):
    font = TTFont(io.BytesIO(urllib.request.urlopen(BASE + src).read()))
    if axes:
        font = instancer.instantiateVariableFont(font, axes)
        buf = io.BytesIO()
        font.save(buf)
        buf.seek(0)
        font = TTFont(buf)
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=unicodes())
    s.subset(font)
    font.flavor = "woff2"
    font.save(os.path.join(OUT, dst))
    print(dst, os.path.getsize(os.path.join(OUT, dst)))


build("onest/Onest%5Bwght%5D.ttf", "onest-var.woff2", {"wght": (400, 700)})
build("ibmplexsans/IBMPlexSans%5Bwdth%2Cwght%5D.ttf", "ibm-plex-sans-var.woff2", {"wdth": 100, "wght": (400, 700)})
build("ibmplexsans/IBMPlexSans-Italic%5Bwdth%2Cwght%5D.ttf", "ibm-plex-sans-italic-var.woff2", {"wdth": 100, "wght": (400, 600)})
build("ibmplexmono/IBMPlexMono-Regular.ttf", "ibm-plex-mono-400.woff2")
build("ibmplexmono/IBMPlexMono-Medium.ttf", "ibm-plex-mono-500.woff2")
