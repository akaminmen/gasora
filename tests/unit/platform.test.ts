import { describe, expect, it } from 'vitest';
import { detectPlatform } from '../../src/pwa/platform';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.108 Mobile/15E148 Safari/604.1',
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
  iphoneEdge:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/126.2592.87 Mobile/15E148 Safari/605.1.15',
  ipadOs:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  androidSamsung:
    'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
  androidEdge:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36 EdgA/126.0.0.0',
  winChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  winEdge:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  opera:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 OPR/111.0.0.0',
};

describe('detectPlatform', () => {
  it('iPhone: Safari y los navegadores de terceros', () => {
    expect(detectPlatform(UA.iphoneSafari)).toEqual({ device: 'ios', browser: 'safari' });
    expect(detectPlatform(UA.iphoneChrome)).toEqual({ device: 'ios', browser: 'chrome' });
    expect(detectPlatform(UA.iphoneFirefox)).toEqual({ device: 'ios', browser: 'firefox' });
    expect(detectPlatform(UA.iphoneEdge)).toEqual({ device: 'ios', browser: 'edge' });
  });
  it('un iPad con iPadOS se presenta como Mac: se distingue por la pantalla táctil', () => {
    expect(detectPlatform(UA.ipadOs, 5)).toEqual({ device: 'ios', browser: 'safari' });
    expect(detectPlatform(UA.macSafari, 0)).toEqual({ device: 'desktop', browser: 'safari' });
  });
  it('Android: Chrome, Samsung Internet, Firefox y Edge', () => {
    expect(detectPlatform(UA.androidChrome)).toEqual({ device: 'android', browser: 'chrome' });
    expect(detectPlatform(UA.androidSamsung)).toEqual({ device: 'android', browser: 'samsung' });
    expect(detectPlatform(UA.androidFirefox)).toEqual({ device: 'android', browser: 'firefox' });
    expect(detectPlatform(UA.androidEdge)).toEqual({ device: 'android', browser: 'edge' });
  });
  it('ordenador: Chrome, Edge, Firefox, Safari y otros', () => {
    expect(detectPlatform(UA.winChrome)).toEqual({ device: 'desktop', browser: 'chrome' });
    expect(detectPlatform(UA.winEdge)).toEqual({ device: 'desktop', browser: 'edge' });
    expect(detectPlatform(UA.winFirefox)).toEqual({ device: 'desktop', browser: 'firefox' });
    expect(detectPlatform(UA.macSafari)).toEqual({ device: 'desktop', browser: 'safari' });
    expect(detectPlatform(UA.opera)).toEqual({ device: 'desktop', browser: 'other' });
  });
  it('un agente desconocido cae en ordenador / otro', () => {
    expect(detectPlatform('')).toEqual({ device: 'desktop', browser: 'other' });
  });
});
