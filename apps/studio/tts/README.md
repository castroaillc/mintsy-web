# apps/studio/tts: local narration (Kokoro)

The voice step's only narration provider, so this setup is required. When a voice step has a
clip that isn't cached, the pipeline starts `kokoro_tts.py` and sends it one scene at a time; it
returns a WAV plus per-word timestamps, which `pipeline/tts.ts` spreads into per-character
timings for cues, captions and the render.

## Setup (once)

```sh
brew install uv espeak-ng       # uv runs the environment; espeak-ng is the phonemizer fallback for words Kokoro's dictionary lacks
cd apps/studio/tts && uv sync        # Python 3.12 + Kokoro (~1 GB with PyTorch); model weights download on first run
```

Without `tts/.venv` the voice step stops with an error giving these commands instead of installing anything itself.

## Voices

Kokoro has ~50 voices ([list](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md)); the first letter is the language (`a` US English, `b` UK English), the
second the gender. `KOKORO_VOICES=af_heart,am_michael,bm_george` voices every episode in all
three; the first is the one the video is rendered with. Others are stored for a future
in-app voice choice:

```
work/<book>/ep-NN/
  audio/kokoro-<voice>/NN.mp3     one clip per scene, per voice
  voices/kokoro-<voice>.json      timings for that voice (same shape as voice.json)
  voices/index.json               { default, voices: [{ id, provider: "kokoro", voice, durationSec, file }] }
  voice.json                      the default voice's timings; this is what the render uses
```

Episodes voiced before Kokoro have flat `audio/NN.mp3` + `NN.json` clips and only `voice.json`, with no `voices/`.

Licence: Kokoro-82M is Apache 2.0, fine for commercial use.
