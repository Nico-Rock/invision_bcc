// Enlaces de salto y foco tras un cambio de vista (variante S3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { enlacesDeSalto, destinoDeFoco, pideFoco, decidirFoco, enfocarDestino, ESTADO_FOCO } from '../../src/lib/navegacion.js';

const destinos = (vista) => enlacesDeSalto(vista).map((e) => e.destino);
const base = { autenticado: true, cargando: false, hayLibro: false };

test('ingreso: solo el salto al contenido principal (no hay buscador ni géneros)', () => {
  assert.deepEqual(destinos({ ...base, pathname: '/login', autenticado: false }), ['main-content-section']);
});

test('catálogo: contenido, menú, buscador y géneros, en ese orden; el reproductor solo con un libro cargado', () => {
  assert.deepEqual(destinos({ ...base, pathname: '/' }), ['main-content-section', 'menu-heading', 'buscador', 'genres-heading']);
  assert.deepEqual(destinos({ ...base, pathname: '/', hayLibro: true }), ['main-content-section', 'menu-heading', 'buscador', 'genres-heading', 'reproductor']);
});

test('perfil: menú en segundo lugar; sin buscador; sí géneros', () => {
  assert.deepEqual(destinos({ ...base, pathname: '/perfil' }), ['main-content-section', 'menu-heading', 'genres-heading']);
});

test('Administración: menú y secciones en segundo y tercer lugar; sin buscador ni géneros', () => {
  assert.deepEqual(destinos({ ...base, pathname: '/admin/import' }), ['main-content-section', 'menu-heading', 'secciones-admin']);
  assert.deepEqual(destinos({ ...base, pathname: '/admin/import', hayLibro: true }), ['main-content-section', 'menu-heading', 'secciones-admin', 'reproductor']);
});

test('el menú es el segundo enlace en /, /perfil y /admin*; «Saltar a las secciones» solo en /admin*', () => {
  ['/', '/perfil', '/admin/import', '/admin'].forEach((pathname) => {
    const e = enlacesDeSalto({ ...base, pathname });
    assert.equal(e[1].destino, 'menu-heading', pathname);
    assert.equal(e[1].texto, 'Saltar al menú', pathname);
    assert.equal(e.some((x) => x.texto === 'Saltar a las secciones'), pathname.startsWith('/admin'), pathname);
  });
});

test('sin sesión no hay salto al menú ni a las secciones, ni siquiera en /admin', () => {
  ['/login', '/admin/import'].forEach((pathname) => {
    assert.deepEqual(destinos({ ...base, pathname, autenticado: false }), ['main-content-section'], pathname);
  });
});

test('«Saltar a las secciones» apunta a la pestaña activa (selector) y trae un href de respaldo que existe', () => {
  const secciones = enlacesDeSalto({ ...base, pathname: '/admin/import' }).find((e) => e.texto === 'Saltar a las secciones');
  assert.equal(secciones.destinoSelector, '[role="tab"][aria-selected="true"]');
  assert.equal(secciones.href, '#tab-inicio');
  // Los demás enlaces apuntan a un id y su href es ese id
  enlacesDeSalto({ ...base, pathname: '/', hayLibro: true }).forEach((e) => {
    assert.equal(e.destinoSelector, undefined);
    assert.equal(e.href, `#${e.destino}`);
  });
});

test('mientras se carga la sesión, el catálogo no está y no hay salto al buscador', () => {
  assert.deepEqual(destinos({ ...base, pathname: '/', cargando: true }), ['main-content-section', 'menu-heading', 'genres-heading']);
});

test('con un libro cargado tras salir, el reproductor sigue en pantalla y su salto también', () => {
  assert.deepEqual(destinos({ ...base, pathname: '/login', autenticado: false, hayLibro: true }), ['main-content-section', 'reproductor']);
});

test('cada enlace tiene un texto que empieza con "Saltar a"', () => {
  const enlaces = enlacesDeSalto({ ...base, pathname: '/', hayLibro: true });
  assert.equal(enlaces[0].texto, 'Saltar al contenido principal');
  enlaces.forEach((e) => assert.match(e.texto, /^Saltar a/));
  assert.equal(new Set(enlaces.map((e) => e.texto)).size, enlaces.length);
});

test('destino del foco: encabezado de cada vista y, en Administración, la pestaña activa', () => {
  assert.equal(destinoDeFoco('/'), '#results-title-header');
  assert.equal(destinoDeFoco('/perfil'), '#profile-title');
  assert.equal(destinoDeFoco('/admin/import'), '[role="tab"][aria-selected="true"]');
  assert.equal(destinoDeFoco('/login'), null);
  assert.equal(destinoDeFoco('/otra'), null);
});

test('el foco se mueve solo tras una acción de la persona, no en la carga inicial ni en una redirección', () => {
  const inicial = 'clave-inicial';
  assert.equal(pideFoco({ key: inicial, state: ESTADO_FOCO }, inicial), false, 'carga inicial (también al recargar con estado guardado)');
  assert.equal(pideFoco({ key: 'otra', state: ESTADO_FOCO }, inicial), true, 'enlace del menú, género o ingreso');
  assert.equal(pideFoco({ key: 'otra', state: null }, inicial), false, 'redirección o navegación sin pedido de foco');
  assert.equal(pideFoco({ key: 'otra', state: { otra: 1 } }, inicial), false);
});

// Al ingresar, la sesión cambia antes que la ruta: el redireccionamiento de
// /login a / no lleva el pedido de foco (visto con la API simulada). El pedido
// queda pendiente hasta que aparece una vista con destino.
const ctx = (extra) => ({ claveInicial: 'k0', pendiente: false, autenticadoAntes: true, autenticado: true, ...extra });

test('decidirFoco: carga inicial con sesión guardada, sin pedido: no mueve el foco', () => {
  assert.deepEqual(decidirFoco(ctx({ location: { key: 'k0', pathname: '/', state: null } })), { selector: null, pendiente: false });
});

test('decidirFoco: al ingresar, el pedido espera en /login y se cumple en el catálogo aunque la redirección no traiga estado', () => {
  const enLogin = decidirFoco(ctx({ autenticadoAntes: false, location: { key: 'k1', pathname: '/login', state: null } }));
  assert.deepEqual(enLogin, { selector: null, pendiente: true });
  const enCatalogo = decidirFoco(ctx({ pendiente: enLogin.pendiente, location: { key: 'k2', pathname: '/', state: null } }));
  assert.deepEqual(enCatalogo, { selector: '#results-title-header', pendiente: false });
});

test('decidirFoco: un enlace del menú o un género con ESTADO_FOCO mueve el foco a la vista nueva', () => {
  assert.deepEqual(decidirFoco(ctx({ location: { key: 'k3', pathname: '/perfil', state: ESTADO_FOCO } })), { selector: '#profile-title', pendiente: false });
  assert.deepEqual(decidirFoco(ctx({ location: { key: 'k4', pathname: '/admin/import', state: ESTADO_FOCO } })), { selector: '[role="tab"][aria-selected="true"]', pendiente: false });
});

test('decidirFoco: al salir no se pide foco y un pedido pendiente se descarta', () => {
  assert.deepEqual(decidirFoco(ctx({ autenticado: false, pendiente: true, location: { key: 'k5', pathname: '/login', state: null } })), { selector: null, pendiente: false });
  assert.deepEqual(decidirFoco(ctx({ autenticadoAntes: true, autenticado: false, location: { key: 'k6', pathname: '/login', state: null } })), { selector: null, pendiente: false });
});

test('decidirFoco: una redirección sin pedido (p. ej. a / desde una ruta desconocida) no mueve el foco', () => {
  assert.deepEqual(decidirFoco(ctx({ location: { key: 'k7', pathname: '/', state: null } })), { selector: null, pendiente: false });
});

// enfocarDestino: el salto comprueba que el foco llegó; si el destino no puede
// recibir foco, le pone tabindex="-1" y reintenta una vez.
const falso = ({ enfocable }) => {
  const doc = { activeElement: null };
  const attrs = {};
  const el = {
    getAttribute: (n) => (n in attrs ? attrs[n] : null),
    setAttribute: (n, v) => { attrs[n] = v; },
    focus: () => { if (enfocable || 'tabindex' in attrs) doc.activeElement = el; },
    intentos: () => attrs,
  };
  return { doc, el };
};

test('enfocarDestino: un destino que ya recibe foco no se toca', () => {
  const { doc, el } = falso({ enfocable: true });
  assert.equal(enfocarDestino(el, doc), true);
  assert.equal(doc.activeElement, el);
  assert.equal(el.getAttribute('tabindex'), null);
});

test('enfocarDestino: si el foco no cambió, pone tabindex -1 y reintenta una vez', () => {
  const { doc, el } = falso({ enfocable: false });
  assert.equal(enfocarDestino(el, doc), true);
  assert.equal(doc.activeElement, el);
  assert.equal(el.getAttribute('tabindex'), '-1');
});

test('enfocarDestino: si tampoco así recibe foco, lo dice (false) para que el enlace deje actuar al ancla', () => {
  const doc = { activeElement: null };
  const el = { getAttribute: () => null, setAttribute: () => {}, focus: () => {} };
  assert.equal(enfocarDestino(el, doc), false);
  assert.equal(enfocarDestino(null, doc), false);
});
