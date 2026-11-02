#!/usr/bin/env bash
# Encode one video to an HLS ladder. Usage: transcode.sh <input> <output-dir>
# Produces master.m3u8 and stream_N/{playlist.m3u8,init_N.mp4,seg_*.m4s}.
# Runs under macOS's bash 3.2: keep the guards around arrays that may be empty.
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: transcode.sh <input> <output-dir>" >&2
  exit 2
fi
for tool in ffmpeg ffprobe; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "$tool is not installed or not on PATH (install it with: brew install ffmpeg)" >&2
    exit 127
  fi
done

in=$1
out=$2
mkdir -p "$out"

probe() { ffprobe -v error -select_streams "$1" -show_entries "$2" -of csv=p=0 "$in" | head -n1 | tr -d ',[:space:]'; }

width=$(probe v:0 stream=width)
height=$(probe v:0 stream=height)
rotation=$(probe v:0 stream_side_data=rotation || true)
has_audio=$(ffprobe -v error -select_streams a:0 -show_entries stream=index -of csv=p=0 "$in" | head -n1)

# Phone footage stores portrait as landscape + a rotation flag; ffmpeg auto-rotates, so match it.
case "${rotation#-}" in 90|270) tmp=$width; width=$height; height=$tmp ;; esac

portrait=0
short=$height
if [ "$height" -gt "$width" ]; then portrait=1; short=$width; fi

# "short side:max video bitrate". Rungs above the source's size are skipped: never upscale.
rungs=()
for rung in 1080:5000 720:2800 360:800; do
  [ "${rung%%:*}" -le "$short" ] && rungs+=("$rung")
done
[ "${#rungs[@]}" -eq 0 ] && rungs+=("$((short / 2 * 2)):800")

count=${#rungs[@]}
split="[0:v:0]split=${count}"
for ((i = 0; i < count; i++)); do split+="[v${i}in]"; done
filter="$split"

video_args=()
stream_map=""
for ((i = 0; i < count; i++)); do
  size=${rungs[$i]%%:*}
  rate=${rungs[$i]##*:}
  if [ "$portrait" -eq 1 ]; then scale="${size}:-2"; else scale="-2:${size}"; fi
  filter+=";[v${i}in]scale=${scale},format=yuv420p[v${i}]"
  video_args+=(-map "[v${i}]" "-c:v:${i}" libx264 "-crf:v:${i}" 23 "-preset:v:${i}" medium
    "-maxrate:v:${i}" "${rate}k" "-bufsize:v:${i}" "$((rate * 3 / 2))k")
  if [ -n "$has_audio" ]; then
    video_args+=(-map 0:a:0)
    stream_map+="v:${i},a:${i} "
  else
    stream_map+="v:${i} "
  fi
done

audio_args=()
[ -n "$has_audio" ] && audio_args=(-c:a aac -b:a 128k -ac 2)

# Fixed 6s keyframes keep every rung's segments aligned, so players can switch quality cleanly.
ffmpeg -hide_banner -loglevel warning -nostdin -y -i "$in" \
  -filter_complex "$filter" \
  "${video_args[@]}" ${audio_args[@]+"${audio_args[@]}"} \
  -force_key_frames 'expr:gte(t,n_forced*6)' -sc_threshold 0 \
  -f hls -hls_time 6 -hls_playlist_type vod -hls_segment_type fmp4 \
  -hls_flags independent_segments \
  -hls_fmp4_init_filename init.mp4 \
  -hls_segment_filename "$out/stream_%v/seg_%05d.m4s" \
  -master_pl_name master.m3u8 \
  -var_stream_map "${stream_map% }" \
  "$out/stream_%v/playlist.m3u8"
