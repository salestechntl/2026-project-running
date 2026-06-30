import { LOAD_SLOW_MS, LOAD_TIMEOUT_MS, USER_MESSAGES, userMessageFromError } from "./errors";

export function createLoadWatchdog() {
  let slowTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
  let timedOut = false;

  return {
    start(onSlow: () => void, onTimeout: () => void) {
      timedOut = false;
      slowTimer = setTimeout(onSlow, LOAD_SLOW_MS);
      timeoutTimer = setTimeout(() => {
        timedOut = true;
        onTimeout();
      }, LOAD_TIMEOUT_MS);
    },
    finish() {
      if (slowTimer) clearTimeout(slowTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      slowTimer = undefined;
      timeoutTimer = undefined;
    },
    isTimedOut() {
      return timedOut;
    },
  };
}

export async function runGuardedLoad<T>(
  action: () => Promise<T>,
  handlers: {
    onSlow: () => void;
    onSettled: (result: { ok: true; value: T } | { ok: false; message: string }) => void | Promise<void>;
  },
): Promise<void> {
  const watchdog = createLoadWatchdog();
  watchdog.start(handlers.onSlow, () => {
    void handlers.onSettled({ ok: false, message: USER_MESSAGES.loadTimeout });
  });

  try {
    const value = await action();
    if (watchdog.isTimedOut()) return;
    await handlers.onSettled({ ok: true, value });
  } catch (e) {
    if (watchdog.isTimedOut()) return;
    await handlers.onSettled({ ok: false, message: userMessageFromError(e, USER_MESSAGES.loadFailed) });
  } finally {
    watchdog.finish();
  }
}
