// Photos / screenshots attached to a question's notes. They live in IndexedDB (localStorage is far
// too small for images) and never leave the device. Large images are downscaled before saving.
const DB = "gatepyq-photos";
const STORE = "photos";
const MAX_SIDE = 1800;

let dbPromise;
function open() {
  dbPromise ||= new Promise((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("Photo storage is not available in this browser mode"));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" }).createIndex("qid", "qid");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}
const wrap = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const objectStore = async (mode) => (await open()).transaction(STORE, mode).objectStore(STORE);

// question id -> number of photos, kept in memory so lists and badges stay synchronous
const counts = new Map();
export const has = (qid) => (counts.get(qid) || 0) > 0;
export const total = () => [...counts.values()].reduce((a, b) => a + b, 0);

export const ready = (async () => {
  try {
    const cursorReq = (await objectStore("readonly")).index("qid").openKeyCursor();
    await new Promise((resolve, reject) => {
      cursorReq.onsuccess = () => {
        const c = cursorReq.result;
        if (!c) return resolve();
        counts.set(c.key, (counts.get(c.key) || 0) + 1);
        c.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch {
    /* storage unavailable: the rest of the app keeps working without photos */
  }
})();

async function shrink(file) {
  if (!/^image\/(png|jpe?g|webp|bmp)$/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise((r) => canvas.toBlob(r, "image/webp", 0.86));
    return out && out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

export async function add(qid, files) {
  const imgs = [...files].filter((f) => f.type.startsWith("image/"));
  if (!imgs.length) throw new Error("That is not an image");
  // shrink first: an IndexedDB transaction closes itself if we await anything else while it is open
  const blobs = await Promise.all(imgs.map(shrink));
  const st = await objectStore("readwrite");
  for (const [i, blob] of blobs.entries()) {
    await wrap(st.put({ id: crypto.randomUUID(), qid, blob, name: imgs[i].name || "screenshot", t: Date.now() + i }));
    counts.set(qid, (counts.get(qid) || 0) + 1);
  }
  // ask the browser not to evict this site's data under storage pressure
  navigator.storage?.persist?.().catch(() => {});
  return imgs.length;
}

export async function list(qid) {
  const rows = await wrap((await objectStore("readonly")).index("qid").getAll(qid));
  return rows.sort((a, b) => a.t - b.t);
}

export async function remove(id, qid) {
  await wrap((await objectStore("readwrite")).delete(id));
  counts.set(qid, Math.max(0, (counts.get(qid) || 1) - 1));
}

const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });

export async function exportAll() {
  try {
    const rows = await wrap((await objectStore("readonly")).getAll());
    return await Promise.all(rows.map(async ({ id, qid, name, t, blob }) => ({ id, qid, name, t, data: await toDataUrl(blob) })));
  } catch {
    return [];
  }
}

export async function importAll(items, mode) {
  if (mode === "replace") await removeByPrefix("");
  const blobs = await Promise.all((items || []).map(async (it) => (await fetch(it.data)).blob()));
  const st = await objectStore("readwrite");
  for (const [i, it] of (items || []).entries()) await wrap(st.put({ id: it.id, qid: it.qid, name: it.name, t: it.t, blob: blobs[i] }));
  counts.clear();
  await rebuild();
}

async function rebuild() {
  const rows = await wrap((await objectStore("readonly")).index("qid").getAllKeys());
  for (const k of rows) counts.set(k, (counts.get(k) || 0) + 1);
}

export async function removeByPrefix(prefix) {
  try {
    const st = await objectStore("readwrite");
    const rows = await wrap(st.getAll());
    for (const r of rows) if (r.qid.startsWith(prefix)) { st.delete(r.id); counts.delete(r.qid); }
  } catch {
    /* nothing stored */
  }
}

export async function storageSummary() {
  const est = (await navigator.storage?.estimate?.().catch(() => null)) || {};
  const persisted = (await navigator.storage?.persisted?.().catch(() => false)) || false;
  return { photos: total(), usedMB: est.usage ? Math.round(est.usage / 1e5) / 10 : null, persisted };
}
