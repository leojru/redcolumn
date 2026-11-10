// Added in the leojru/redcolumn fork (revu-layout). As in Revu, a PDF on disk is what holds its markups:
// identical copies are separate documents, and removing a document forgets what was kept for it.
import { MarkupStore } from '@nb/markup';
import { contentHash } from '../storage/fileStore';
import { fileLocationPath, handleLocationPath } from '../storage/diskHandles';

interface OpenTab {
  file: { id: string; hash: string };
}

/**
 * The document id for a file opened from `source` while an identical file from somewhere else is
 * open, so each has its own tab and markups. Undefined when the usual id is right.
 */
export async function idForSeparateCopy(bytes: ArrayBuffer, source: object | null | undefined, tabs: readonly OpenTab[]): Promise<string | undefined> {
  const path = await handleLocationPath(source);
  if (!path) return undefined;
  const hash = await contentHash(bytes);
  for (const t of tabs) {
    if (t.file.id !== hash && t.file.hash !== hash) continue;
    const there = await fileLocationPath(t.file.id);
    if (there && there !== path) return `${hash}:${await contentHash(new TextEncoder().encode(path).buffer as ArrayBuffer)}`;
  }
  return undefined;
}

/** Forgets the markups kept for a document that is not open. */
export async function forgetKeptMarkups(id: string): Promise<void> {
  const store = await MarkupStore.open(id);
  store.startFromFile();
  await store.destroy();
}

export const REMOVE_FROM_DEVICE = (name: string) => `Remove "${name}" from this device? Markups saved in the file stay in the file. Any others are erased.`;
