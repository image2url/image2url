# imgtourl

Minimal client and CLI for uploading images to Cloudflare R2 (S3 compatible) and getting a permanent URL. Mirrors the upload rules used by imgtourl.com (image-only, 2MB default limit, CDN-friendly cache headers).

## Install

```bash
npm install imgtourl
```

Requires Node.js 18+.

## Configure

You need Cloudflare R2 credentials and a public bucket URL. Set them as env vars or pass in directly:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_URL` (e.g. `https://your-bucket.r2.dev`)
- Optional: `IMGTOURL_PREFIX` (defaults to `images/`), `IMGTOURL_MAX_SIZE` (bytes)
- Backward-compatible aliases: `IMAGETOURL_PREFIX`, `IMAGE2URL_PREFIX`, `IMAGETOURL_MAX_SIZE`, `IMAGE2URL_MAX_SIZE`

## Quick start (code)

```ts
import { Image2UrlClient, createClientFromEnv } from 'imgtourl';

const client = createClientFromEnv(); // uses the env vars above

const result = await client.uploadFile('./photo.png');
console.log(result.url); // https://your-bucket.r2.dev/images/...
```

You can also upload buffers or base64 strings:

```ts
const buffer = await fs.promises.readFile('./photo.png');
await client.uploadBuffer(buffer, { originalName: 'photo.png' });

await client.uploadBase64('data:image/png;base64,...');
```

## CLI

```bash
imgtourl <image-path> \
  --account <account-id> \
  --access-key <key> \
  --secret-key <secret> \
  --bucket <bucket> \
  --public-url https://your-bucket.r2.dev
```

Flags fallback to the same env vars shown above. Useful overrides:

- `--prefix` key prefix (default `images`)
- `--key` full object key (skip the default prefix/generator)
- `--name` filename metadata
- `--max-size` custom size limit in bytes

CLI output is JSON with the uploaded URL, key, size, and content type.

## Defaults and validation

- Only `image/*` content types are allowed.
- Default size limit: 2MB (`IMGTOURL_MAX_SIZE`, `IMAGETOURL_MAX_SIZE`, or `IMAGE2URL_MAX_SIZE` to change).
- Object keys are `images/<timestamp>-<uuid>.<ext>` unless you pass `--key`.
- Cache header: `public, max-age=31536000` (1 year).
