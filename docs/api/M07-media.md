# M07 media and lesson access API

Base URL: `http://localhost:3000/api/v1`. These are proposed contracts. Use a valid access token from `POST /api/v1/auth/login` and actual lesson UUIDs from an instructor-managed course. The local private media adapter is for development and review; a production storage provider still needs team approval.

## Request upload

`POST /lessons/{lessonId}/media/upload-request` with `Authorization: Bearer <instructor-access-token>` and `Content-Type: application/json`.

```json
{"fileName":"intro.mp4","contentType":"video/mp4","sizeBytes":12}
```

Expected `201` (IDs, signature and expiry vary):

```json
{"media":{"id":"11111111-1111-4111-8111-111111111111","status":"PENDING","contentType":"video/mp4","sizeBytes":12},"upload":{"method":"PUT","url":"/api/v1/media/22222222-2222-4222-8222-222222222222/upload?expires=1795460000000&signature=<64-hex-characters>","expiresAt":"2026-11-23T12:13:20.000Z"}}
```

The signed URL expires after five minutes. `PUT` that URL with `Content-Type: video/mp4` and exactly 12 bytes of MP4 data. A successful upload returns `204` with no body. The file must have MP4 `ftyp` bytes at offsets 4–7. Supported types: `video/mp4` up to 100 MiB, `audio/mpeg` and `application/pdf` up to 20 MiB. Size must be at least one byte. Only one media record is allowed per lesson. Upload is allowed on a draft course owned by the instructor or an admin. Replacing media needs a future explicit workflow.

Example errors:

```json
{"error":{"code":"VALIDATION_ERROR","message":"validation error."}}
```

`400` for unsupported type, wrong byte count or oversize declaration; `413 FILE_TOO_LARGE` for raw body over 100 MiB; `403 FORBIDDEN` for wrong owner or invalid signed URL; `409 MEDIA_EXISTS` for a duplicate request. An unauthenticated request returns `401 UNAUTHORIZED`.

## Lesson access and playback metadata

`GET /lessons/{lessonId}/access` with `Authorization: Bearer <learner-access-token>` and `Accept: application/json`.

An active enrollment grants access only when the course is published. A paid course also requires a linked `SUCCEEDED` payment. The course instructor and admin can access their lesson. A `200` response provides metadata and a signed download URL valid for 60 seconds:

```json
{"lesson":{"id":"33333333-3333-4333-8333-333333333333","title":"Introduction"},"media":{"id":"11111111-1111-4111-8111-111111111111","fileName":"intro.mp4","contentType":"video/mp4","sizeBytes":12,"url":"/api/v1/media/22222222-2222-4222-8222-222222222222/download?expires=1795460000000&signature=<64-hex-characters>","expiresAt":"2026-11-23T12:13:20.000Z"}}
```

`GET` the signed URL to receive private bytes. It does not need a Bearer token; treat the URL as a short lived credential. Never log or share it. An unenrolled or unpaid learner gets `403`:

```json
{"error":{"code":"FORBIDDEN","message":"forbidden."}}
```

Unknown lessons return `404 NOT_FOUND`. Media not yet uploaded returns `404 MEDIA_NOT_READY`. Existing public course detail omits legacy `resourceUrl` and never exposes storage keys or signatures.

## Operations and limitations

Set `MEDIA_ROOT` to a private writable directory outside the web root and `MEDIA_SIGNING_SECRET` to a random value of at least 32 characters. Production startup rejects missing values. Back up this directory together with PostgreSQL metadata. Local filesystem storage needs a durable shared volume or approved object storage adapter before production deployment. The current API buffers at most 100 MiB per upload and download, so production should use direct object store transfers. Upload bytes are checked by signature and declared length; antivirus scanning and media transcoding are not implemented. A database failure after a successful file write may leave an orphan file for manual cleanup.
