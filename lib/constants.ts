// 5 MB expressed as base64 length (each 3 raw bytes → 4 base64 chars)
export const MAX_PHOTO_B64_LEN = Math.ceil((5 * 1024 * 1024) * 4 / 3);
