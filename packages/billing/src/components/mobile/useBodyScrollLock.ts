// @ts-nocheck
/**
 * Locks page scroll while a bottom sheet is open. iOS Safari ignores
 * `overflow: hidden` on <body>, so we pin the body with `position: fixed`
 * at a negative offset and restore the scroll position on release.
 *
 * `createBodyScrollLock` is the framework-free core (testable with a fake
 * body); `useBodyScrollLock` binds it to the real document.
 */
import { onBeforeUnmount } from 'vue';

export function createBodyScrollLock({ body, getScrollY, scrollTo }) {
  let locked = false;
  let storedScrollY = 0;

  function lock() {
    if (locked) return;
    locked = true;
    storedScrollY = getScrollY();
    body.style.position = 'fixed';
    body.style.top = `-${storedScrollY}px`;
    body.style.width = '100%';
  }

  function unlock() {
    if (!locked) return;
    locked = false;
    body.style.position = '';
    body.style.top = '';
    body.style.width = '';
    scrollTo(0, storedScrollY);
  }

  return { lock, unlock };
}

export function useBodyScrollLock() {
  const lock = createBodyScrollLock({
    body: document.body,
    getScrollY: () => window.scrollY,
    scrollTo: (x, y) => window.scrollTo(x, y),
  });

  onBeforeUnmount(lock.unlock);

  return lock;
}
