# Media and signed URLs

Episode videos (MP4) and thumbnails (JPG) live in the Cloud Storage bucket `gs://mintsy-media` (project `mintsy-prod`). The database stores only object **paths** (`EpisodeDoc.videoPath`, `thumbnailPath`, e.g. `books/psychology-of-money/4.mp4`). The API turns them into URLs in `src/media.ts`, so clients must refetch URLs from the API rather than store them.

## Two modes

| | `SIGNED_MEDIA` off (default) | `SIGNED_MEDIA=true` |
| --- | --- | --- |
| Bucket | public | private |
| `videoUrl` | `MEDIA_BASE_URL` + `/` + path | V4 signed URL, about 60-90 minutes left when issued |
| `thumbnailUrl` | `MEDIA_BASE_URL` + `/` + path | V4 signed URL, about 6-7 days left (the V4 maximum is 7 days) |
| Free tier | enforced in the API only; the raw file is public | enforced: locked episodes get no URL and the bucket refuses unsigned reads |

Either way, `videoUrl` is `null` for locked episodes and for episodes without a `videoPath`.

TODO: confirm whether `SIGNED_MEDIA=true` is currently on in production.

## How signing works

* URLs are aligned to time windows (video: 30 minutes, valid 90; thumbnail: 1 day, valid 7) and memoized in-process. The same object gets the same URL within a window, so client caches keep working and the API makes one signing call per object per window.
* On Cloud Run there's no key file: `@google-cloud/storage` signs through the IAM Credentials `signBlob` API as the runtime service account. That account needs **Service Account Token Creator on itself** (`iam.serviceAccounts.signBlob`) and read access to the bucket.
* Signing failures are logged and the field returns `null`.
* `MEDIA_BASE_URL` is ignored for signed URLs (always `https://storage.googleapis.com/<bucket>/...`). `MEDIA_BUCKET` sets the bucket (default `mintsy-media`).

The step-by-step switch to a private bucket (and rollback) is in the backend `README.md` ("Locking the media"). Order matters: deploy and turn `SIGNED_MEDIA` on **before** closing the bucket, so the app never gets URLs that 403.

## Adding a video by hand

Normally the studio worker's `render` job encodes, uploads and upserts the draft episode, and staff publish it from the admin dashboard. By hand:

1. Encode to 720p H.264 MP4 with `+faststart`, and grab a thumbnail:
   ```sh
   ffmpeg -i in.mov -vf scale=-2:720 -c:v libx264 -preset slow -crf 23 -maxrate 1.8M -bufsize 3.6M \
     -c:a aac -b:a 128k -movflags +faststart 4.mp4
   ffmpeg -ss 5 -i 4.mp4 -frames:v 1 -vf scale=264:-2 4.jpg
   ```
2. Upload. Files are cached for a year, so upload a changed video under a new name:
   ```sh
   gcloud storage cp 4.mp4 4.jpg gs://mintsy-media/books/psychology-of-money/ \
     --cache-control "public, max-age=31536000"
   ```
3. Set the episode's `videoPath` / `thumbnailPath` and a matching `durationSec` in the admin dashboard, then publish.
