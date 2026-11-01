# studio/tts: local narration (Kokoro)

Used by the voice step when `TTS_PROVIDER=kokoro` (see `studio/.env.example`). The pipeline
starts `kokoro_tts.py` once per voice step and sends it one scene at a time; it returns a
WAV plus per-word timestamps, which `pipeline/tts.ts` turns into the same character
alignment ElevenLabs returns, so cues, captions and the render work unchanged.

## Setup (once)

```sh
brew install espeak-ng          # phonemizer fallback for words Kokoro's dictionary lacks
cd studio/tts && uv sync        # Python 3.12 + Kokoro (~1 GB with PyTorch); model weights download on first run
```

## Voices

Kokoro has ~50 voices; the first letter is the language (`a` US English, `b` UK English), the
second the gender. `KOKORO_VOICES=af_heart,am_michael,bm_george` voices every episode in all
three; the first is the one the video is rendered with. Others are stored for a future
in-app voice choice:

```
work/<book>/ep-NN/
  audio/kokoro-<voice>/NN.mp3     one clip per scene, per voice
  voices/kokoro-<voice>.json      timings for that voice (same shape as voice.json)
  voices/index.json               { default, voices: [{ id, provider, voice, durationSec }] }
  voice.json                      the default voice's timings; this is what the render uses
```

Licence: Kokoro-82M is Apache 2.0, fine for commercial use.
