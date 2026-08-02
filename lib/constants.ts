// Base64 length for exactly 5 MB: ceil(bytes/3)*4 gives the padded length.
// ceil(bytes*4/3) is off by 1 when bytes%3==2, causing valid 5MB files to be rejected.
export const MAX_PHOTO_B64_LEN = Math.ceil(5 * 1024 * 1024 / 3) * 4;

export const VALID_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'] as const;
