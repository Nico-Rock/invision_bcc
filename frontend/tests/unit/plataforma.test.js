// Detección de iOS para ocultar el control de volumen: el sistema ignora el
// volumen que fija la página. iPadOS se anuncia como Mac con pantalla táctil.
import test from 'node:test';
import assert from 'node:assert/strict';
import { esIOS } from '../../src/lib/plataforma.js';

const UA_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

const IPHONE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
};
const CHROME_IPHONE = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
  platform: 'iPhone',
  maxTouchPoints: 5,
};
const IPAD_ANTERIOR = {
  userAgent: 'Mozilla/5.0 (iPad; CPU OS 12_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.2 Mobile/15E148 Safari/604.1',
  platform: 'iPad',
  maxTouchPoints: 5,
};
const IPAD_COMO_MAC = { userAgent: UA_MAC, platform: 'MacIntel', maxTouchPoints: 5 };
const MAC = { userAgent: UA_MAC, platform: 'MacIntel', maxTouchPoints: 0 };
const UA_WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const WINDOWS = { userAgent: UA_WINDOWS, platform: 'Win32', maxTouchPoints: 0 };
const WINDOWS_TACTIL = { userAgent: UA_WINDOWS, platform: 'Win32', maxTouchPoints: 10 };
const ANDROID = {
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  platform: 'Linux armv81',
  maxTouchPoints: 5,
};

test('iPhone, con Safari o con Chrome, es iOS', () => {
  assert.equal(esIOS(IPHONE), true);
  assert.equal(esIOS(CHROME_IPHONE), true);
});

test('iPad: el anterior a iPadOS 13 y el que se anuncia como Mac con pantalla táctil', () => {
  assert.equal(esIOS(IPAD_ANTERIOR), true);
  assert.equal(esIOS(IPAD_COMO_MAC), true);
});

test('escritorio y Android no son iOS', () => {
  assert.equal(esIOS(MAC), false);
  assert.equal(esIOS(WINDOWS), false);
  assert.equal(esIOS(WINDOWS_TACTIL), false);
  assert.equal(esIOS(ANDROID), false);
});

test('sin datos del navegador, no es iOS', () => {
  assert.equal(esIOS({}), false);
  assert.equal(esIOS(), false);
  assert.equal(esIOS(null), false);
});
