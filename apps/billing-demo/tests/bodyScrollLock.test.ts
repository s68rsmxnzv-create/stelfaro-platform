import { describe, expect, it, vi } from 'vitest';
import { createBodyScrollLock } from '../../../packages/billing/src/components/mobile/useBodyScrollLock';

function harness(scrollY = 240) {
  const body = { style: {} as Record<string, string> };
  const scrollTo = vi.fn();
  const lock = createBodyScrollLock({
    body,
    getScrollY: () => scrollY,
    scrollTo,
  });
  return { body, scrollTo, lock };
}

describe('createBodyScrollLock', () => {
  it('pins the body at the current scroll offset on lock', () => {
    const { body, lock } = harness(240);

    lock.lock();

    expect(body.style.position).toBe('fixed');
    expect(body.style.top).toBe('-240px');
    expect(body.style.width).toBe('100%');
  });

  it('restores styles and scroll position on unlock', () => {
    const { body, scrollTo, lock } = harness(240);

    lock.lock();
    lock.unlock();

    expect(body.style.position).toBe('');
    expect(body.style.top).toBe('');
    expect(body.style.width).toBe('');
    expect(scrollTo).toHaveBeenCalledWith(0, 240);
  });

  it('is idempotent: a second lock does not overwrite the stored offset', () => {
    const body = { style: {} as Record<string, string> };
    const scrollTo = vi.fn();
    let scrollY = 100;
    const lock = createBodyScrollLock({ body, getScrollY: () => scrollY, scrollTo });

    lock.lock();
    scrollY = 999;
    lock.lock();
    lock.unlock();

    expect(scrollTo).toHaveBeenCalledWith(0, 100);
  });
});
