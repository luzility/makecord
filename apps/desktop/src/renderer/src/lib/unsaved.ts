import { type UnsavedChoice, useStore } from "./store";

const st = () => useStore.getState();

export function askUnsaved(paths: string[]): Promise<UnsavedChoice> {
  return new Promise((resolve) => {
    st().set({
      unsavedPrompt: {
        paths,
        resolve: (choice) => {
          st().set({ unsavedPrompt: null });
          resolve(choice);
        },
      },
    });
  });
}

export async function resolveUnsaved(only?: string[]): Promise<boolean> {
  const state = st();
  if (state.settings.autoSave) {
    await state.flushSaves();
    return true;
  }
  const dirty = (only ?? Object.keys(state.docs)).filter((p) => st().isDirty(p));
  if (!dirty.length) return true;
  const choice = await askUnsaved(dirty);
  if (choice === "cancel") return false;
  if (choice === "save") {
    for (const path of dirty) await st().savePath(path);
    return dirty.every((p) => !st().isDirty(p));
  }
  for (const path of dirty) st().discard(path);
  return true;
}
