# Media and signed URLs

Episode videos (MP4, optionally also HLS) and thumbnails (JPG) live in the Cloud Storage bucket `gs://mintsy-media` (project `mintsy-prod`). The database stores only object **paths** (`EpisodeDoc.videoPath`, `hlsPath`, `thumbnailPath`, e.g. `books/psychology-of-money/4.mp4`, and the same for each voice in `EpisodeDoc.voices`). The API turns them into URLs in `src/media.ts`, so clients must refetch URLs from the API rather than store them. With signing off, a URL is `MEDIA_BASE_URL` + path, so a CDN or custom domain later is only an env change.

## One-time bucket setup

The public bucket. See [Locking the media](media.md#locking-the-media) for the private, signed-URL setup.

```sh
gcloud storage buckets create gs://mintsy-media --project mintsy-prod --location us-central1 --uniform-bucket-level-access
gcloud storage buckets add-iam-policy-binding gs://mintsy-media --member allUsers --role roles/storage.objectViewer
```

## Two modes

|                | `SIGNED_MEDIA` off (default)                     | `SIGNED_MEDIA=true`                                                        |
| -------------- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| Bucket         | public                                           | private                                                                    |
| `videoUrl`     | `MEDIA_BASE_URL` + `/` + path                    | V4 signed URL, about 60-90 minutes left when issued                        |
| `hlsUrl`       | `MEDIA_BASE_URL` + `/` + path                    | always `null` (see [HLS](media.md#hls))                                    |
| `thumbnailUrl` | `MEDIA_BASE_URL` + `/` + path                    | V4 signed URL, about 6-7 days left (the V4 maximum is 7 days)              |
| Free tier      | enforced in the API only; the raw file is public | enforced: locked episodes get no URL and the bucket refuses unsigned reads |

Either way, `videoUrl` is `null` for locked episodes and for episodes without a `videoPath`.

TODO: confirm whether `SIGNED_MEDIA=true` is currently on in production.

## HLS

Episodes can also have an HLS encode (adaptive bitrate), written by the studio worker. `EpisodeDoc.hlsPath` is the master playlist's object path, e.g. `books/<bookId>/<n>-<hash>/master.m3u8`. It's optional and sits beside the MP4, which stays: offline downloads and older app builds use `videoUrl`.

`Episode.hlsUrl` is decided in this order:

1. Locked for this viewer (same check as `videoUrl`): `null`.
2. No `hlsPath`: `null`.
3. `SIGNED_MEDIA=true`: `null`.
4. Otherwise: `MEDIA_BASE_URL` + `/` + path.

::: warning
**HLS isn't available while `SIGNED_MEDIA` is on.** A V4 signed URL covers one object, but a player fetches variant playlists and segments by relative path, without a signature, so a signed master playlist would 403 on its segments. The API returns `hlsUrl: null` instead and clients fall back to `videoUrl`, so turning `SIGNED_MEDIA` on can't break playback.
:::

`EpisodeVoice.videoUrl` and `hlsUrl` go through the same functions. `episodeVoices` returns `[]` for a locked episode, so the lock is checked once, before any voice URL is issued.

With a public bucket, HLS files are as public as the MP4: the free tier is enforced by the API only (no URL for locked episodes), not by the bucket. Protecting HLS for Premium is a separate, later project.

## How signing works

* URLs are aligned to time windows (video: 30 minutes, valid 90; thumbnail: 1 day, valid 7) and memoized in-process. The same object gets the same URL within a window, so client caches keep working and the API makes one signing call per object per window.
* On Cloud Run there's no key file: `@google-cloud/storage` signs through the IAM Credentials `signBlob` API as the runtime service account. That account needs **Service Account Token Creator on itself** (`iam.serviceAccounts.signBlob`) and read access to the bucket.
* Signing failures are logged and the field returns `null`.
* `MEDIA_BASE_URL` is ignored for signed URLs (always `https://storage.googleapis.com/<bucket>/...`). `MEDIA_BUCKET` sets the bucket (default `mintsy-media`).

## Locking the media

With a public bucket anyone can fetch `books/<id>/<n>-<hash>.mp4` directly, so the free tier is only enforced in the UI. `SIGNED_MEDIA=true` with a private bucket fixes that.

Thumbnails are signed too. They're allowed to be public, but a private bucket makes every object private and studio uploads both into the same bucket. The trade-off is no public CDN URLs for thumbnails, in exchange for no second bucket and no studio change. The alternative, not done, is a separate public `mintsy-thumbs` bucket, which needs studio to upload JPGs there and a `thumbnailPath` base change.

**Steve runs these steps; none had been run when they were written.** Order matters: deploy the code and turn `SIGNED_MEDIA` on **before** closing the bucket, so the app never gets URLs that 403.

```sh
PROJECT=mintsy-prod; REGION=us-central1; BUCKET=gs://mintsy-media
# 0. Find the Cloud Run runtime service account (empty = PROJECT_NUMBER-compute@developer.gserviceaccount.com)
SA=$(gcloud run services describe mintsy-api --region $REGION --project $PROJECT \
  --format 'value(spec.template.spec.serviceAccountName)')
[ -z "$SA" ] && SA="$(gcloud projects describe $PROJECT --format 'value(projectNumber)')-compute@developer.gserviceaccount.com"
echo $SA

# 1. Let the service account sign as itself (signBlob) and read objects
gcloud iam service-accounts add-iam-policy-binding $SA --project $PROJECT \
  --member "serviceAccount:$SA" --role roles/iam.serviceAccountTokenCreator
gcloud storage buckets add-iam-policy-binding $BUCKET \
  --member "serviceAccount:$SA" --role roles/storage.objectViewer
gcloud services enable iamcredentials.googleapis.com --project $PROJECT

# 2. Deploy this code (merge to main), then turn signing on. URLs are signed; the bucket is still public.
gcloud run services update mintsy-api --region $REGION --project $PROJECT --update-env-vars SIGNED_MEDIA=true
#    Check: { books { episodes { number locked videoUrl thumbnailUrl } } } returns X-Goog-Signature URLs that play.

# 3. Close the bucket: remove public read, enforce uniform access and public access prevention
gcloud storage buckets remove-iam-policy-binding $BUCKET --member allUsers --role roles/storage.objectViewer
gcloud storage buckets update $BUCKET --uniform-bucket-level-access --public-access-prevention

# 4. Verify: the plain URL is now 403, a signed one is 200
curl -sI https://storage.googleapis.com/mintsy-media/books/<bookId>/<file>.mp4 | head -1   # 403
```

Objects uploaded with `Cache-Control: public, max-age=31536000` may still sit in Google's edge cache or other shared caches for up to their max-age after step 3. Content-hashed names mean new uploads aren't affected, and studio's uploads already use `private, max-age=31536000`.

**Rollback** (re-open the bucket first, then turn signing off):

```sh
gcloud storage buckets update $BUCKET --no-public-access-prevention
gcloud storage buckets add-iam-policy-binding $BUCKET --member allUsers --role roles/storage.objectViewer
gcloud run services update mintsy-api --region $REGION --project $PROJECT --update-env-vars SIGNED_MEDIA=false
```

Leaving `SIGNED_MEDIA=true` on a public bucket also works; signed URLs remain valid.

## Adding a video by hand

Normally the studio worker's `render` job encodes every voice, uploads and upserts the draft episode, and staff publish it from the admin dashboard. By hand:

1.  Encode to 720p H.264 MP4 with `+faststart`, which lets playback start before the whole file downloads, and grab a thumbnail:

    ```sh
    ffmpeg -i in.mov -vf scale=-2:720 -c:v libx264 -preset slow -crf 23 -maxrate 1.8M -bufsize 3.6M \
      -c:a aac -b:a 128k -movflags +faststart 4.mp4
    ffmpeg -ss 5 -i 4.mp4 -frames:v 1 -vf scale=264:-2 4.jpg
    ```
2.  Upload. Files are cached for a year, so upload a changed video under a new name (for example `4-v2.mp4`):

    ```sh
    gcloud storage cp 4.mp4 4.jpg gs://mintsy-media/books/the-science-of-getting-rich/ \
      --cache-control "public, max-age=31536000"
    ```
3. Set the episode's `videoPath` / `thumbnailPath` (for example `books/the-science-of-getting-rich/4.mp4`) and a matching `durationSec` in the admin dashboard, then publish.
