import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
const DEFAULT_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const DEFAULT_CACHE_CONTROL = 'public, max-age=31536000';
const MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.ico': 'image/x-icon',
};
const EXT_BY_MIME = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/svg+xml': 'svg',
    'image/tiff': 'tiff',
    'image/x-icon': 'ico',
};
export class Image2UrlClient {
    client;
    bucket;
    publicUrl;
    prefix;
    maxSize;
    cacheControl;
    constructor(config) {
        this.bucket = requireValue(config.bucket, 'bucket');
        this.publicUrl = trimTrailingSlash(requireValue(config.publicUrl, 'publicUrl'));
        this.prefix = trimSlashes(config.keyPrefix ?? 'images');
        this.maxSize = config.maxSizeBytes ?? DEFAULT_MAX_SIZE;
        this.cacheControl = config.cacheControl ?? DEFAULT_CACHE_CONTROL;
        const accountId = requireValue(config.accountId, 'accountId');
        const accessKeyId = requireValue(config.accessKeyId, 'accessKeyId');
        const secretAccessKey = requireValue(config.secretAccessKey, 'secretAccessKey');
        this.client = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    async uploadFile(filePath, options) {
        const stats = await fs.stat(filePath);
        if (!stats.isFile()) {
            throw new Error(`Path is not a file: ${filePath}`);
        }
        const buffer = await fs.readFile(filePath);
        const originalName = options?.originalName ?? path.basename(filePath);
        const contentType = options?.contentType ?? guessContentType(originalName);
        return this.uploadBuffer(buffer, {
            ...options,
            originalName,
            contentType,
        });
    }
    async uploadBase64(base64, options) {
        const decoded = decodeBase64(base64);
        return this.uploadBuffer(decoded.buffer, {
            ...options,
            originalName: options?.originalName ?? decoded.originalName,
            contentType: options?.contentType ?? decoded.contentType,
        });
    }
    async uploadBuffer(data, options) {
        const buffer = toBuffer(data);
        if (buffer.length === 0) {
            throw new Error('Cannot upload an empty file.');
        }
        if (buffer.length > this.maxSize) {
            const limitMb = (this.maxSize / (1024 * 1024)).toFixed(1);
            throw new Error(`File is larger than the allowed limit (${limitMb} MB).`);
        }
        const contentType = ensureImageContentType(options?.contentType ?? guessContentType(options?.originalName) ?? 'image/jpeg');
        const key = this.buildKey(options?.key, options?.originalName, contentType);
        const metadata = buildMetadata(options?.metadata, options?.originalName);
        const uploadCommand = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            ContentLength: buffer.length,
            CacheControl: this.cacheControl,
            Metadata: metadata,
        });
        const response = await this.client.send(uploadCommand);
        return {
            url: buildPublicUrl(this.publicUrl, key),
            key,
            bucket: this.bucket,
            size: buffer.length,
            type: contentType,
            etag: response.ETag ?? undefined,
        };
    }
    buildKey(key, originalName, contentType) {
        if (key && key.trim().length > 0) {
            return normalizeKey(key);
        }
        const extension = guessExtension(originalName, contentType) ?? 'jpg';
        const filename = `${Date.now()}-${randomUUID()}.${extension}`;
        return this.prefix ? `${this.prefix}/${filename}` : filename;
    }
}
export function createClientFromEnv(env = process.env) {
    return new Image2UrlClient({
        accountId: requireValue(firstEnv(env, ['R2_ACCOUNT_ID', 'IMGTOURL_ACCOUNT_ID', 'IMAGETOURL_ACCOUNT_ID', 'IMAGE2URL_ACCOUNT_ID']), 'R2_ACCOUNT_ID'),
        accessKeyId: requireValue(firstEnv(env, ['R2_ACCESS_KEY_ID', 'IMGTOURL_ACCESS_KEY_ID', 'IMAGETOURL_ACCESS_KEY_ID', 'IMAGE2URL_ACCESS_KEY_ID']), 'R2_ACCESS_KEY_ID'),
        secretAccessKey: requireValue(firstEnv(env, [
            'R2_SECRET_ACCESS_KEY',
            'IMGTOURL_SECRET_ACCESS_KEY',
            'IMAGETOURL_SECRET_ACCESS_KEY',
            'IMAGE2URL_SECRET_ACCESS_KEY',
        ]), 'R2_SECRET_ACCESS_KEY'),
        bucket: requireValue(firstEnv(env, ['R2_BUCKET_NAME', 'IMGTOURL_BUCKET', 'IMAGETOURL_BUCKET', 'IMAGE2URL_BUCKET']), 'R2_BUCKET_NAME'),
        publicUrl: requireValue(firstEnv(env, ['R2_PUBLIC_URL', 'IMGTOURL_PUBLIC_URL', 'IMAGETOURL_PUBLIC_URL', 'IMAGE2URL_PUBLIC_URL']), 'R2_PUBLIC_URL'),
        keyPrefix: firstEnv(env, ['IMGTOURL_PREFIX', 'IMAGETOURL_PREFIX', 'IMAGE2URL_PREFIX']),
        maxSizeBytes: parseOptionalNumber(firstEnv(env, ['IMGTOURL_MAX_SIZE', 'IMAGETOURL_MAX_SIZE', 'IMAGE2URL_MAX_SIZE'])),
    });
}
function ensureImageContentType(contentType) {
    if (!contentType) {
        throw new Error('Unable to determine content type. Provide a contentType or filename with an image extension.');
    }
    if (!contentType.startsWith('image/')) {
        throw new Error(`Only image uploads are allowed. Received content type: ${contentType}`);
    }
    return contentType;
}
function guessContentType(originalName) {
    if (!originalName)
        return undefined;
    const ext = path.extname(originalName).toLowerCase();
    return MIME_BY_EXT[ext];
}
function guessExtension(originalName, contentType) {
    const nameExt = originalName ? path.extname(originalName).replace('.', '').toLowerCase() : '';
    if (nameExt) {
        return nameExt;
    }
    return EXT_BY_MIME[contentType];
}
function toBuffer(data) {
    if (Buffer.isBuffer(data)) {
        return data;
    }
    if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
    }
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
}
function decodeBase64(input) {
    const value = input.trim();
    const dataUriMatch = value.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUriMatch) {
        const [, mime, encoded] = dataUriMatch;
        const buffer = Buffer.from(encoded, 'base64');
        return {
            buffer,
            contentType: mime,
            originalName: `upload.${EXT_BY_MIME[mime] ?? 'jpg'}`,
        };
    }
    return {
        buffer: Buffer.from(value, 'base64'),
    };
}
function buildMetadata(metadata, originalName) {
    const result = metadata ? { ...metadata } : {};
    if (originalName) {
        result['original-name'] = originalName;
    }
    result['upload-time'] = new Date().toISOString();
    return result;
}
function buildPublicUrl(base, key) {
    const normalizedBase = trimTrailingSlash(base);
    const normalizedKey = key.replace(/^\/+/, '');
    return `${normalizedBase}/${normalizedKey}`;
}
function trimTrailingSlash(value) {
    return value.replace(/\/+$/, '');
}
function trimSlashes(value) {
    return value.replace(/^\/+/, '').replace(/\/+$/, '');
}
function normalizeKey(key) {
    return key.replace(/^\/+/, '').replace(/\\/g, '/');
}
function requireValue(value, field) {
    if (!value) {
        throw new Error(`Missing ${field} in Image2Url configuration.`);
    }
    return value;
}
function firstEnv(env, keys) {
    for (const key of keys) {
        const value = env[key];
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
}
function parseOptionalNumber(value) {
    if (value === undefined) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}
