// @ts-nocheck
/**
 * Bridges the mobile bottom sheets with the browser history stack so the
 * Android back button and the iOS edge-swipe close the open sheet instead
 * of navigating away from the page.
 *
 * Split into a framework-free `createSheetHistory` core (testable with a
 * fake `history`) and a thin `useSheetHistory` composable that wires the
 * `popstate` listener into the Vue lifecycle.
 */
import { onBeforeUnmount, onMounted } from 'vue';

export function createSheetHistory({ history, onRequestClose }) {
  let ownsEntry = false;

  function open() {
    if (ownsEntry) {
      history.replaceState({ sfSheet: true }, '');
      return;
    }
    history.pushState({ sfSheet: true }, '');
    ownsEntry = true;
  }

  function close() {
    if (!ownsEntry) return;
    ownsEntry = false;
    history.back();
  }

  /**
   * Drop ownership of the pushed entry WITHOUT navigating back. Used when we
   * leave a sheet by navigating to another page: the router pushes its own
   * entry and a `history.back()` here would race it and undo the navigation.
   */
  function release() {
    ownsEntry = false;
  }

  function handlePopState() {
    if (!ownsEntry) return;
    ownsEntry = false;
    onRequestClose();
  }

  return { open, close, release, handlePopState };
}

export function useSheetHistory(onRequestClose) {
  const sheets = createSheetHistory({
    history: window.history,
    onRequestClose,
  });

  function listener() {
    sheets.handlePopState();
  }

  onMounted(() => window.addEventListener('popstate', listener));
  onBeforeUnmount(() => window.removeEventListener('popstate', listener));

  return sheets;
}
