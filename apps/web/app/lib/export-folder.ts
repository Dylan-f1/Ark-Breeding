// EF-07: the DinoExports folder, connected once (File System Access API, Chrome and Edge) and read
// again at each import: no file picker to browse. The folder handle is kept in IndexedDB, only in
// this browser; reading it still needs the player's permission, asked on the click.

/** The parts of the File System Access API used here (not in TypeScript's DOM lib yet). */
interface FolderHandle extends FileSystemDirectoryHandle {
  values(): AsyncIterable<FileSystemDirectoryHandle | FileSystemFileHandle>;
  queryPermission(options: { mode: "read" }): Promise<PermissionState>;
  requestPermission(options: { mode: "read" }): Promise<PermissionState>;
}

interface FilePickerWindow {
  showDirectoryPicker(options: { id: string; mode: "read" }): Promise<FolderHandle>;
}

interface SavedFolder {
  handle: FolderHandle;
  /** lastModified of the newest export already imported: older files are skipped. */
  importedUntil: number;
}

const DB_NAME = "ark-breeding";
const STORE = "folders";
const KEY = "dinoexports";
/** Picker id: the browser reopens the picker where it was left. */
const PICKER_ID = "dinoexports";

const pickerWindow = () => window as unknown as Window & FilePickerWindow;

export const folderSupported = () => typeof window !== "undefined" && "showDirectoryPicker" in window;

function store<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const req = run(db.transaction(STORE, mode).objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.transaction!.oncomplete = () => db.close();
    };
  });
}

export async function savedFolder(): Promise<SavedFolder | undefined> {
  if (!folderSupported()) return undefined;
  return store<SavedFolder | undefined>("readonly", (s) => s.get(KEY)).catch(() => undefined);
}

const saveFolder = (folder: SavedFolder) => store("readwrite", (s) => s.put(folder, KEY));
export const forgetFolder = () => store("readwrite", (s) => s.delete(KEY));

/** Asks the player for the DinoExports folder; every export in it will be imported the first time. */
export async function connectFolder(): Promise<SavedFolder> {
  const handle = await pickerWindow().showDirectoryPicker({ id: PICKER_ID, mode: "read" });
  const folder = { handle, importedUntil: 0 };
  await saveFolder(folder);
  return folder;
}

/** Exports (.ini) of the folder and of its sub-folders (ASA puts one per player id). */
async function* iniFiles(dir: FolderHandle, depth = 0): AsyncGenerator<File> {
  for await (const entry of dir.values()) {
    if (entry.kind === "file" && entry.name.toLowerCase().endsWith(".ini")) yield await entry.getFile();
    else if (entry.kind === "directory" && depth < 2) yield* iniFiles(entry as FolderHandle, depth + 1);
  }
}

/**
 * Exports written since the last import. Must run from a click: the browser may ask the player
 * to allow reading the folder again. Returns null when the permission is refused.
 */
export async function readNewExports(folder: SavedFolder): Promise<File[] | null> {
  const mode = { mode: "read" } as const;
  if ((await folder.handle.queryPermission(mode)) !== "granted" && (await folder.handle.requestPermission(mode)) !== "granted")
    return null;
  const files: File[] = [];
  for await (const file of iniFiles(folder.handle)) if (file.lastModified > folder.importedUntil) files.push(file);
  return files;
}

/** Remembers the newest imported export, for the next readNewExports. */
export async function markImported(folder: SavedFolder, files: File[]) {
  const newest = Math.max(folder.importedUntil, ...files.map((f) => f.lastModified));
  folder.importedUntil = newest;
  await saveFolder(folder);
}

