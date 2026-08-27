import { describe, expect, it, vi } from 'vitest';
import { createSheetHistory } from '../../../packages/billing/src/components/mobile/useSheetHistory';

function fakeHistory() {
  return {
    pushState: vi.fn(),
    replaceState: vi.fn(),
    back: vi.fn(),
  };
}

describe('createSheetHistory', () => {
  it('pushes one history entry when the first sheet opens', () => {
    const history = fakeHistory();
    const sheets = createSheetHistory({ history, onRequestClose: vi.fn() });

    sheets.open('action');

    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  it('replaces the entry instead of stacking a second one when switching sheets', () => {
    const history = fakeHistory();
    const sheets = createSheetHistory({ history, onRequestClose: vi.fn() });

    sheets.open('action');
    sheets.open('more');

    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(history.replaceState).toHaveBeenCalledTimes(1);
  });

  it('consumes its history entry with a single back() on manual close', () => {
    const history = fakeHistory();
    const sheets = createSheetHistory({ history, onRequestClose: vi.fn() });

    sheets.open('action');
    sheets.close();
    sheets.close();

    expect(history.back).toHaveBeenCalledTimes(1);
  });

  it('asks the caller to close on popstate without calling back()', () => {
    const history = fakeHistory();
    const onRequestClose = vi.fn();
    const sheets = createSheetHistory({ history, onRequestClose });

    sheets.open('action');
    sheets.handlePopState();

    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(history.back).not.toHaveBeenCalled();
  });

  it('release() forgets the entry without calling back()', () => {
    const history = fakeHistory();
    const sheets = createSheetHistory({ history, onRequestClose: vi.fn() });

    sheets.open('action');
    sheets.release();
    sheets.close();

    expect(history.back).not.toHaveBeenCalled();
  });

  it('ignores popstate when no sheet entry is owned', () => {
    const history = fakeHistory();
    const onRequestClose = vi.fn();
    const sheets = createSheetHistory({ history, onRequestClose });

    sheets.handlePopState();

    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
