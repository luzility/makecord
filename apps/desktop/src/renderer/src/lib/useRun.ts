import { api } from "./api";
import { cleanError, useStore } from "./store";

async function runExclusive(fn: () => Promise<void>) {
  const { set, runBusy } = useStore.getState();
  if (runBusy) return;
  set({ runBusy: true });
  try {
    await fn();
  } catch (e) {
    set({ status: "error", statusDetail: cleanError(e), statusCode: undefined, online: undefined });
  } finally {
    set({ runBusy: false });
  }
}

export const startBot = () => runExclusive(() => api.runtime.start());
export const stopBot = () => runExclusive(() => api.runtime.stop());
export const isRunning = (status: string) => status === "starting" || status === "ready";

export function useRunActions() {
  const status = useStore((s) => s.status);
  const runBusy = useStore((s) => s.runBusy);
  return {
    running: isRunning(status),
    busy: runBusy || status === "stopping",
    start: startBot,
    stop: stopBot,
  };
}
