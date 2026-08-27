# Shell móvil tipo app para la plataforma de facturación

Fecha: 2026-08-27
Estado: diseño aprobado, pendiente plan de implementación
Rama: `integration`

## 1. Problema

La navegación móvil de la app de facturación
([`packages/billing/src/pages/BillingAppPage.vue`](../../../packages/billing/src/pages/BillingAppPage.vue))
es una web de escritorio metida en un cajón:

- Barra superior fija con botón hamburguesa que abre un drawer a pantalla
  completa (`<Teleport to="body">`).
- Dentro del drawer: grid de "Accesos rápidos", un selector expandible de
  tipo de documento, y **el mismo menú de escritorio**
  ([`BillingAppNav.vue`](../../../packages/billing/src/components/BillingAppNav.vue))
  renderizado en modo acordeón con 6 menús anidados (Facturación, Eventos,
  Respuestas, Comprobantes, Fiscal, Gestión).
- Llegar a cualquier destino cuesta 2-3 toques a través de menús anidados.
- Los colores del drawer están hardcodeados (`text-slate-200`, `bg-white/5`,
  `border-sky-400/60`) con parches `.dark` en `theme.css`, en vez de usar los
  tokens `--sf-color-*`.

## 2. Objetivo y alcance

Reemplazar el shell de navegación móvil por un patrón **tipo app nativa**:
barra de pestañas inferior fija + botón de acción central (FAB) + hojas
inferiores (bottom sheets). El destino frecuente queda a un toque.

**Dentro de alcance:**

- Nuevo shell móvil: tab bar, FAB, sheet de acciones, sheet "Gestión",
  pantalla "Más".
- Ajustes de layout en `BillingAppPage.vue` (safe areas, padding inferior,
  barra superior móvil reducida, borrado del drawer y estado obsoleto).
- Compatibilidad PWA / `standalone`, iOS (notch + home indicator), Android
  (botón atrás), los 4 temas, `prefers-reduced-motion` /
  `prefers-reduced-transparency`.

**Fuera de alcance (trabajo posterior, cada uno su propio spec):**

- Rediseño del contenido de las páginas (Inicio móvil, lista de Documentos
  tipo app, taller, emisión).
- Reescritura de `BillingAppNav.vue` (se sigue reutilizando tal cual dentro
  de "Más").
- Cambios de router en las apps host (patrón C descartado).

## 3. Contexto técnico relevante

- `BillingAppPage.vue` es el shell compartido por las apps host
  (billing-demo, taller, …). Tiene ~1337 líneas con lógica móvil embebida.
- La navegación es por `href` interceptado: `navigate(event, href)` emite y
  el host decide. No hay recargas de página.
- `module` (prop), `extraNavItems` (prop, trae Taller cuando el tenant lo
  tiene) y el contexto fiscal (`getBillingContext`, tipos de documento y
  eventos habilitados) determinan qué módulos existen para el tenant.
- El escritorio usa `md:flex` / `md:hidden` y **no se toca**.
- `theme.css` ya aporta: utilidades `sf-safe-screen` / `sf-safe-x` /
  `sf-safe-bottom` / `sf-safe-overlay`, clases `sheet-glass` /
  `toolbar-glass` (con fallback `@media (prefers-reduced-transparency:
  reduce)`), y tokens `--sf-color-*` para claro, `dark`,
  `dark-medium-contrast`, `dark-high-contrast` vía `[data-theme]`.
- Testing del repo: Vitest puro (sin `@vue/test-utils` ni jsdom).
- No hay manifest PWA ni service worker en este repo; la PWA real vive en
  otro host. El diseño debe ser válido en `display: standalone` de todos
  modos.

## 4. Modelo de navegación

Objeto declarativo que `BillingAppPage` calcula y pasa al shell. El shell no
conoce reglas de negocio; solo pinta el modelo.

```
mobileNavModel = {
  tabs: [
    { key: 'dashboard', label: 'Inicio',     icon: Home,     href: dashboardHref,
      match: m => m === 'dashboard' },
    { key: 'documents', label: 'Documentos', icon: FileText, href: hrefFor('/comprobantes/dte'),
      match: m => ['artifacts','mh-responses','mh-event-responses'].includes(m) },
    { key: 'action',    kind: 'fab',         icon: Plus },
    { key: 'slot4',     ... },   // Taller | Gestión, según tenant
    { key: 'more',      label: 'Más',        icon: EllipsisHorizontal, kind: 'sheet:more' }
  ],
  actions: [   // contenido del sheet del FAB, ya filtrado
    { label: 'Factura consumidor final', href: hrefFor('.../fe'),  icon: FileText, enabled },
    { label: 'Crédito fiscal',           href: hrefFor('.../ccf'), icon: FileText, enabled },
    { label: 'Nueva orden de taller',    href: hrefFor('/ordenes-trabajo'), icon: ClipboardList },  // solo si hasWorkshop
    { label: 'Nuevo cliente',            href: hrefFor('/clientes'), icon: UserPlus },
    { label: 'Evento MH',                href: hrefFor('/mh-events/invalidacion'), icon: Bolt }      // solo si hasEvents
  ],
  management: [   // contenido del sheet "Gestión" (solo cuando slot4 = gestión)
    { label: 'Órdenes y cotizaciones', href: hrefFor('/ordenes-trabajo'), icon: ... },
    { label: 'Caja',                   href: hrefFor('/caja'), icon: ... },
    { label: 'Pendientes',             href: hrefFor('/pendientes'), icon: ... },
    { label: 'Clientes',               href: hrefFor('/clientes'), icon: ... },
    { label: 'Catálogo',               href: hrefFor('/catalogo'), icon: ... },
    { label: 'Inventario',             href: hrefFor('/inventario'), icon: ..., newTab: true }
  ]
}
```

### Reglas

- **`slot4`**: si `extraNavItems` incluye taller → tab **Taller** (navega a
  la primera entrada de taller). Si no → tab **Gestión** con
  `kind: 'sheet:management'` (abre el sheet Gestión).
- **Tab activa**: derivada de `module` vía `tab.match(activeModule)`. Sin
  estado persistente nuevo.
- **Filtrado de acciones**: `actions` se construye ya filtrado por
  `enabled` (tipos de documento habilitados) y por `hasWorkshop` /
  `hasEvents`. Ítems deshabilitados de emisión se muestran en estado
  "no habilitado" (como hoy); los condicionales por módulo simplemente no
  aparecen.
- **Degradación**: si `slot4` no aplica y no hay gestión (raro), la tab bar
  pinta 4 tabs centradas.

### `buildMobileNavModel(input)`

Función pura extraída del `computed`. Firma aproximada:

```
buildMobileNavModel({
  module, dashboardHref, hrefFor,
  extraNavItems, billingOptions, hasWorkshop, hasEvents
}) => { tabs, actions, management }
```

Vive en `packages/billing/src/components/mobile/mobileNavModel.ts`. Es el
núcleo testeable.

## 5. Estructura de componentes

Todo nuevo en `packages/billing/src/components/mobile/`.

| Archivo | Responsabilidad | Interfaz |
| --- | --- | --- |
| `BillingMobileShell.vue` | Orquesta. Renderiza la tab bar fija; gestiona `activeSheet: null \| 'action' \| 'more' \| 'management'`; scroll-lock del body; integra `useSheetHistory`; expone `<slot>` para el contenido de la página. En `md:` se vuelve transparente (`display: contents` / `md:hidden` en su chrome). | props: `navModel`, `activeModule`; emite `navigate({ event, href })` |
| `BillingMobileTabBar.vue` | Presentación pura. 5 slots; resalta la activa con `tab.match(activeModule)`; el `kind:'fab'` se pinta elevado y centrado. | props: `tabs`, `activeModule`; emite `select(tab)` |
| `BillingMobileSheet.vue` | Primitiva reutilizable: bottom sheet `<Teleport to="body">`, backdrop, swipe-down / tap para cerrar, `Escape`, foco atrapado, `sf-safe-bottom`. | props: `open`, `title`; slot; emite `close` |
| `BillingMobileActionGrid.vue` | Rejilla de acciones (compartida por sheet de FAB y sheet Gestión): ítems con icono, label, estado `enabled`, `newTab`. | props: `items`; emite `navigate` |
| `mobileNavModel.ts` | `buildMobileNavModel` (función pura). | — |
| `useSheetHistory.ts` | Composable: integra apertura/cierre de sheets con `history`. | ver §6 |
| `useBodyScrollLock.ts` | Composable: guarda/restaura `scrollY`, aplica `position: fixed` al body (iOS ignora `overflow:hidden`). | `lock()` / `unlock()` |

### Pantalla "Más"

`BillingMobileSheet` a `90vh` con scroll interno que contiene:

1. Identidad de empresa / usuario.
2. `<BillingAppNav mobile ... />` **tal cual** (acordeón de Facturación,
   Eventos, Respuestas, Comprobantes, Fiscal).
3. "Salir".

### Cambios en `BillingAppPage.vue`

- **Borrar**: el `<Teleport>` del drawer (~líneas 1062-1253), el botón
  hamburguesa (~809-821), los `ref` `mobileMenuOpen` /
  `mobileQuickInvoiceOpen` / `mobileQuickMoreOpen`, sus `watch` y los
  `computed` `mobilePrimaryBillingOptions` / `mobileSecondaryBillingOptions`
  (su lógica se traslada a `buildMobileNavModel`).
- **Barra superior móvil**: queda como barra fina — logo + `pageTitle` +
  `OwnerAvatarMenu`. En `md:` sigue igual.
- **Nuevo**: `computed` `mobileNavModel` que llama a `buildMobileNavModel`.
- **Envoltura**: el `<main>` se envuelve en `<BillingMobileShell>` que solo
  aporta chrome en móvil.
- `hasWorkshop` = `extraNavItems.length > 0`; `hasEvents` =
  `visibleEventOptions`/`enabledEventTypes` no vacío (reutilizar lo que ya
  calcula `BillingAppNav` — extraer helper o recomputar en la página).

## 6. Comportamiento e interacción

### Tab bar

- `position: fixed; inset-inline: 0; bottom: 0`. Altura `56px +
  env(safe-area-inset-bottom)`; la fila de iconos con `padding-bottom:
  env(safe-area-inset-bottom)`.
- Fondo `sheet-glass` (borde y sombra hacia arriba). En
  `prefers-reduced-transparency: reduce` cae a fondo sólido (heredado).
- `<main>` recibe `padding-bottom: calc(56px + env(safe-area-inset-bottom))`.
- Tab normal: `<a :href>` → `emit('navigate')` (mismo `navigate()`
  interceptado). Tab `kind:'sheet:*'` → abre sheet. FAB → `<button>`, abre
  sheet `action`.
- Tab activa: `text-primary` + label en negrita. Derivada de la ruta.
- Usa `100dvh` / `fixed`, nunca `vh`, para no romper con la barra dinámica
  de Safari iOS.

### Sheets

- Uno a la vez: `activeSheet` es un único valor; abrir uno cierra el otro.
- Cierre: tap en backdrop, swipe-down, botón X, `Escape`, y **al navegar**.
- Body scroll-lock vía `useBodyScrollLock` mientras haya sheet abierto.
- Animación: slide-up 200ms `ease-out` + backdrop fade. Con
  `prefers-reduced-motion: reduce` → solo fade, sin desplazamiento.
- Altura: `action` y `management` = contenido, máx `70vh`; `more` = `90vh`
  con scroll interno.
- Backdrop = `bg-overlay` (token).

### Botón atrás (Android) / gesto atrás de borde (iOS) — `useSheetHistory`

- Al abrir un sheet: `history.pushState({ sfSheet: <key> }, '')`.
- Listener `popstate`: si hay sheet abierto → cerrarlo (no navegar).
- Al cerrar por X / backdrop / navegación: si nuestra entrada sigue en el
  tope del historial, `history.back()` una sola vez (para consumirla).
- Abrir sheet B con A abierto: reemplaza el estado (`replaceState`), no
  apila una segunda entrada.
- En iOS el gesto de borde dispara `popstate`, así que cubre ambos casos.
- Composable aislado y testeable con stub de `history` / `window`.

### PWA / standalone / iOS

- Todo el shell funciona igual en `display: standalone`.
- Requiere `<meta name="viewport" content="..., viewport-fit=cover">` en el
  host. **Prerequisito**: verificarlo en cada app host; billing-demo no lo
  tiene. Documentar en el plan.
- `theme-color` del manifiesto debería seguir a `--sf-color-navbar`. Nota
  para el equipo del host; no se toca aquí.

### Theming

- Cero colores hardcodeados. Todo desde tokens: `text-text` /
  `text-text-soft`, `bg-surface`, `border-line`, activo `text-primary`, FAB
  `bg-primary text-primary-contrast`, backdrop `bg-overlay`.
- Funciona en los 4 temas automáticamente al salir de variables.

## 7. Estrategia de pruebas

### Vitest (lógica pura, sin DOM)

- **`buildMobileNavModel`**: con taller / sin taller (slot4 = Gestión) / sin
  eventos (acción MH oculta) / opciones de emisión filtradas por `enabled` /
  degradación a 4 tabs.
- **`useSheetHistory`** (stub de `history` / `window`): abrir hace
  `pushState`; `popstate` cierra en vez de navegar; cerrar manualmente hace
  `back()` una sola vez; abrir sheet B con A abierto no apila dos entradas.
- **`useBodyScrollLock`** (body mockeado mínimo): guarda/restaura `scrollY`,
  aplica/quita estilos.

### QA manual (checklist en el plan; no hay infra de componentes)

- iOS Safari (notch + home indicator) y Android Chrome, en navegador y en
  PWA `standalone`.
- Los 4 temas: contraste de tab activa y FAB.
- `prefers-reduced-motion` y `prefers-reduced-transparency`.
- Botón atrás cierra el sheet sin salir de la página; doble-atrás no rompe
  el historial.
- Contenido no queda tapado por la tab bar; teclado abierto no rompe
  layout.
- Escritorio (`md:`) intacto.

### Decisión consciente

No se añade `@vue/test-utils` al proyecto. Las piezas con lógica se extraen
como funciones puras / composables testeables y los componentes quedan como
presentación delgada.

## 8. Riesgos y notas

- `BillingAppPage.vue` es grande y compartido por varias apps host; el
  borrado del drawer debe verificarse contra cada host (billing-demo,
  taller). El QA de "escritorio intacto" cubre regresiones visuales.
- `history` API + interceptación de `navigate` del host: validar que
  `history.back()` para cerrar el sheet no interfiere con la navegación
  SPA del host.
- `hasEvents` hoy se calcula dentro de `BillingAppNav`; hay que exponerlo o
  recomputarlo en `BillingAppPage`. Preferible extraer un helper compartido.
