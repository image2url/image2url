export type Image2UrlConfig = {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
    keyPrefix?: string;
    maxSizeBytes?: number;
    cacheControl?: string;
};
export type UploadOptions = {
    key?: string;
    originalName?: string;
    contentType?: string;
    metadata?: Record<string, string>;
};
export type UploadResult = {
    url: string;
    key: string;
    bucket: string;
    size: number;
    type: string;
    etag?: string;
};
export declare class Image2UrlClient {
    private readonly client;
    private readonly bucket;
    private readonly publicUrl;
    private readonly prefix;
    private readonly maxSize;
    private readonly cacheControl;
    constructor(config: Image2UrlConfig);
    uploadFile(filePath: string, options?: UploadOptions): Promise<UploadResult>;
    uploadBase64(base64: string, options?: UploadOptions): Promise<UploadResult>;
    uploadBuffer(data: Buffer | ArrayBuffer | Uint8Array, options?: UploadOptions): Promise<UploadResult>;
    private buildKey;
}
export declare function createClientFromEnv(env?: NodeJS.ProcessEnv): Image2UrlClient;
//# sourceMappingURL=index.d.ts.map