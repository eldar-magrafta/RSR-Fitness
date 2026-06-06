// ── Nutrition shared state ──
// Session-scoped in-memory cache of resolved cloud photos (base64), keyed by
// `${collection}/${docId}`. Shared across the nutrition core and the barcode
// module so a photo saved in one is instantly available in the other without
// re-hitting IndexedDB/Firestore.

export const cloudImgCache = new Map();
