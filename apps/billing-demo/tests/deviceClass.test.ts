import { describe, expect, it } from 'vitest';
import { isMobilePrintingDevice } from '../../../packages/billing/src/printing/deviceClass';

describe('mobile printing device detection', () => {
  it.each([
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 Mobile Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  ])('detects mobile user agent %s', (userAgent) => {
    expect(isMobilePrintingDevice({ userAgent })).toBe(true);
  });

  it('detects an iPad using desktop browsing mode', () => {
    expect(isMobilePrintingDevice({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    })).toBe(true);
  });

  it('detects a generic touch tablet without classifying a touch desktop as mobile', () => {
    expect(isMobilePrintingDevice({
      userAgent: 'Generic browser',
      maxTouchPoints: 10,
      coarsePointer: true,
      viewportWidth: 1280,
      viewportHeight: 800,
    })).toBe(true);
    expect(isMobilePrintingDevice({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      maxTouchPoints: 10,
      coarsePointer: true,
      viewportWidth: 1920,
      viewportHeight: 1080,
    })).toBe(false);
  });

  it('keeps narrow desktop browsers in the desktop printing flow', () => {
    expect(isMobilePrintingDevice({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      maxTouchPoints: 0,
      coarsePointer: false,
      viewportWidth: 600,
      viewportHeight: 900,
    })).toBe(false);
  });
});
