"""
Kokoro TTS server for apps/studio/pipeline/tts.ts.

Reads one JSON request per line on stdin:
  {"id": 1, "text": "...", "voice": "af_heart", "speed": 1.0, "out": "/abs/path.wav"}
writes the WAV (24 kHz mono) and answers one JSON line on stdout:
  {"id": 1, "ok": true, "durationSec": 16.0, "words": [{"word": "Then", "start": 0.275, "end": 0.475}, ...]}
  {"id": 1, "ok": false, "error": "..."}
Prints {"ready": true} once the model is loaded. Everything else (warnings, progress) goes to stderr.
"""
import json
import os
import sys

# Keep stdout for protocol lines only; libraries print freely.
proto = sys.stdout
sys.stdout = sys.stderr

# The espeak-ng copy bundled with espeakng-loader on macOS has its build machine's data path
# compiled in, so use a system espeak-ng (brew install espeak-ng) instead.
prefix = os.environ.get("ESPEAK_NG_PREFIX", "/opt/homebrew/opt/espeak-ng")
lib = next(
    (p for p in (f"{prefix}/lib/libespeak-ng.dylib", f"{prefix}/lib/libespeak-ng.so.1", f"{prefix}/lib/libespeak-ng.so") if os.path.exists(p)),
    None,
)
if lib is None:
    print(json.dumps({"ready": False, "error": f"espeak-ng not found under {prefix}: run `brew install espeak-ng` or set ESPEAK_NG_PREFIX"}), file=proto, flush=True)
    sys.exit(1)
import espeakng_loader  # noqa: E402

espeakng_loader.get_library_path = lambda: lib
espeakng_loader.get_data_path = lambda: f"{prefix}/share/espeak-ng-data"

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from kokoro import KPipeline  # noqa: E402

SAMPLE_RATE = 24000
pipelines: dict[str, KPipeline] = {}


def pipeline_for(voice: str) -> KPipeline:
    # Voice ids start with the language code: a = American English, b = British English, ...
    lang = voice[0]
    if lang not in pipelines:
        pipelines[lang] = KPipeline(lang_code=lang, repo_id="hexgrad/Kokoro-82M")
    return pipelines[lang]


def synthesize(req: dict) -> dict:
    voice, speed = req["voice"], float(req.get("speed", 1.0))
    chunks, words, offset = [], [], 0.0
    for result in pipeline_for(voice)(req["text"], voice=voice, speed=speed):
        audio = result.audio.numpy()
        for tok in result.tokens or []:
            if tok.start_ts is not None:
                words.append({
                    "word": tok.text,
                    "start": round(offset + tok.start_ts, 3),
                    "end": round(offset + (tok.end_ts if tok.end_ts is not None else tok.start_ts), 3),
                })
        chunks.append(audio)
        offset += len(audio) / SAMPLE_RATE
    if not chunks:
        raise ValueError("Kokoro produced no audio")
    sf.write(req["out"], np.concatenate(chunks), SAMPLE_RATE)
    return {"durationSec": round(offset, 3), "words": words}


pipeline_for(os.environ.get("KOKORO_WARM_VOICE", "af_heart"))
print(json.dumps({"ready": True}), file=proto, flush=True)

for line in sys.stdin:
    if not line.strip():
        continue
    req = {}
    try:
        req = json.loads(line)
        reply = {"id": req.get("id"), "ok": True, **synthesize(req)}
    except Exception as err:  # report and keep serving
        reply = {"id": req.get("id"), "ok": False, "error": f"{type(err).__name__}: {err}"}
    print(json.dumps(reply), file=proto, flush=True)
