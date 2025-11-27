#!/usr/bin/env node

import path from 'node:path';
import process from 'node:process';
import { Image2UrlClient } from './index.js';

type ArgValue = string | boolean;
type ParsedArgs = Record<string, ArgValue>;

async function main() {
  const { args, file } = parseArgs(process.argv.slice(2));

  if (args.help || args.h) {
    printHelp();
    process.exit(0);
  }

  if (!file) {
    printHelp('Missing file path to upload.');
    process.exit(1);
  }

  try {
    const client = new Image2UrlClient({
      accountId: requireArg(
        args,
        ['account', 'a'],
        ['R2_ACCOUNT_ID', 'IMGTOURL_ACCOUNT_ID', 'IMAGETOURL_ACCOUNT_ID', 'IMAGE2URL_ACCOUNT_ID'],
        'account id',
      ),
      accessKeyId: requireArg(
        args,
        ['access-key'],
        ['R2_ACCESS_KEY_ID', 'IMGTOURL_ACCESS_KEY_ID', 'IMAGETOURL_ACCESS_KEY_ID', 'IMAGE2URL_ACCESS_KEY_ID'],
        'access key',
      ),
      secretAccessKey: requireArg(
        args,
        ['secret-key'],
        [
          'R2_SECRET_ACCESS_KEY',
          'IMGTOURL_SECRET_ACCESS_KEY',
          'IMAGETOURL_SECRET_ACCESS_KEY',
          'IMAGE2URL_SECRET_ACCESS_KEY',
        ],
        'secret key',
      ),
      bucket: requireArg(
        args,
        ['bucket', 'b'],
        ['R2_BUCKET_NAME', 'IMGTOURL_BUCKET', 'IMAGETOURL_BUCKET', 'IMAGE2URL_BUCKET'],
        'bucket name',
      ),
      publicUrl: requireArg(
        args,
        ['public-url'],
        ['R2_PUBLIC_URL', 'IMGTOURL_PUBLIC_URL', 'IMAGETOURL_PUBLIC_URL', 'IMAGE2URL_PUBLIC_URL'],
        'public URL',
      ),
      keyPrefix: readString(args, ['prefix'], ['IMGTOURL_PREFIX', 'IMAGETOURL_PREFIX', 'IMAGE2URL_PREFIX']),
      maxSizeBytes: readNumber(args, ['max-size'], ['IMGTOURL_MAX_SIZE', 'IMAGETOURL_MAX_SIZE', 'IMAGE2URL_MAX_SIZE']),
    });

    const result = await client.uploadFile(path.resolve(file), {
      key: readString(args, ['key']),
      originalName: readString(args, ['name', 'n']),
      contentType: readString(args, ['content-type']),
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`imagetourl: ${message}`);
    process.exit(1);
  }
}

function parseArgs(argv: string[]): { args: ParsedArgs; file?: string } {
  const args: ParsedArgs = {};
  let file: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '-h' || current === '--help') {
      args.help = true;
      continue;
    }

    if (current.startsWith('--')) {
      const key = current.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
      continue;
    }

    if (current.startsWith('-')) {
      const key = current.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
      continue;
    }

    if (!file) {
      file = current;
    }
  }

  return { args, file };
}

function readString(args: ParsedArgs, keys: string[], envKeys: string[] = []): string | undefined {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === 'string') {
      return value;
    }
  }

  for (const envKey of envKeys) {
    const value = process.env[envKey];
    if (value) {
      return value;
    }
  }

  return undefined;
}

function readNumber(args: ParsedArgs, keys: string[], envKeys: string[] = []): number | undefined {
  const fromArg = readString(args, keys);
  if (fromArg) {
    const parsed = Number(fromArg);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  const fromEnv = readString(args, [], envKeys);
  if (fromEnv) {
    const parsed = Number(fromEnv);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function requireArg(
  args: ParsedArgs,
  keys: string[],
  envKeys: string[],
  label: string,
): string {
  const value = readString(args, keys, envKeys);
  if (!value) {
    throw new Error(
      `Missing ${label}. Provide --${keys[0]} or set ${envKeys.join(' / ')}.`,
    );
  }

  return value;
}

function printHelp(message?: string) {
  if (message) {
    console.error(message);
  }

  console.log(`Usage: imagetourl <image-path> [options]

Options:
  --account, -a         Cloudflare R2 account id (env: R2_ACCOUNT_ID / IMGTOURL_ACCOUNT_ID / IMAGETOURL_ACCOUNT_ID)
  --access-key          R2 access key id (env: R2_ACCESS_KEY_ID / IMGTOURL_ACCESS_KEY_ID / IMAGETOURL_ACCESS_KEY_ID)
  --secret-key          R2 secret access key (env: R2_SECRET_ACCESS_KEY / IMGTOURL_SECRET_ACCESS_KEY / IMAGETOURL_SECRET_ACCESS_KEY)
  --bucket, -b          Target bucket name (env: R2_BUCKET_NAME / IMGTOURL_BUCKET / IMAGETOURL_BUCKET)
  --public-url          Public base URL for the bucket (env: R2_PUBLIC_URL / IMGTOURL_PUBLIC_URL / IMAGETOURL_PUBLIC_URL)
  --prefix              Optional key prefix (env: IMGTOURL_PREFIX, default: images)
  --max-size            Override max size in bytes (env: IMGTOURL_MAX_SIZE, default: 2MB)
  --key                 Custom object key; overrides the default generated key
  --name, -n            Override original filename metadata
  --content-type        Force a specific content type (must start with image/)
  --help, -h            Show this help message

Examples:
  imagetourl ./cat.png
  imagetourl ./cat.png --bucket my-bucket --public-url https://cdn.example.com
`);
}

main();
