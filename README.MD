# KIHS — Buscador de imágenes

Buscador de imágenes con pantalla de inicio variada, herramientas de filtrado avanzado (al estilo Google Imágenes) y descarga directa de archivos. Conectado a la API de Unsplash, con un banco de imágenes local como respaldo automático si la API falla.

## Características

- **Pantalla de inicio con variedad real**: al cargar, se muestran ~30 imágenes aleatorias de temáticas distintas (no una búsqueda predeterminada).
- **Herramientas de búsqueda por secciones**, desplegables, inspiradas en Google Imágenes:
  - Tamaño (cualquiera, grandes, medianos, iconos)
  - Color (cualquiera, blanco y negro, transparentes, paleta de 11 colores)
  - Tipo (cualquiera, clip art, dibujo lineal, GIF animado)
  - Fecha (cualquiera, últimas 24h, última semana, último año)
  - Derechos de uso (cualquiera, Creative Commons, comercial)
- **Filtrado en tiempo real**: los filtros cruzan las propiedades reales de cada imagen (dimensiones, color dominante, tipo de archivo) sin necesidad de volver a llamar a la API.
- **Contador de resultados dinámico**, estilo "Cerca de X resultados (Y s)".
- **Descarga directa**: cada imagen se descarga como archivo binario real (vía `Blob`), no se abre en una pestaña nueva.
- **Animaciones con GSAP**, con respaldo automático a la Web Animations API nativa si el CDN de GSAP no carga.
- **Búsqueda segura activada** (`content_filter: high` de Unsplash) y notificación al endpoint de descarga de Unsplash según sus normas de uso.
- Responsive, con soporte para `prefers-reduced-motion` y foco visible por teclado.

## Estructura del proyecto

```
buscador/
├── index.html
├── .gitignore
├── css/
│   └── style.css
└── js/
    ├── app.js              # Lógica principal (fetch, filtros, render, descarga)
    ├── config.js            # Tu Access Key real — NO se sube al repo
    └── config.example.js    # Plantilla pública de config.js
```

## Cómo correrlo localmente

### 1. Consigue tu Access Key de Unsplash (gratis)

1. Crea una cuenta en [unsplash.com/join](https://unsplash.com/join).
2. Ve a [unsplash.com/oauth/applications](https://unsplash.com/oauth/applications) → **New Application**.
3. Ponle un nombre a tu app y copia el **Access Key** que te genera.

### 2. Configura tu clave localmente

```bash
cp js/config.example.js js/config.js
```

Abre `js/config.js` y pega tu Access Key:

```javascript
window.LENTE_CONFIG = {
  UNSPLASH_ACCESS_KEY: "TU_ACCESS_KEY_AQUI"
};
```

> ⚠️ `js/config.js` está en `.gitignore` y nunca se sube al repositorio. Cada persona que clone el proyecto debe crear el suyo con su propia clave.

### 3. Ábrelo con un servidor local

No abras `index.html` directo con doble clic (`file://`) — algunas peticiones fetch fallan por CORS. Usa una extensión como **Live Server** en VS Code, o corre:

```bash
python -m http.server 5500
```

y entra a `http://localhost:5500`.

## Comportamiento sin conexión / sin API key

Si la API de Unsplash no responde (sin key configurada, sin internet, red que bloquea el dominio, etc.), el buscador cae automáticamente a un banco de ~20 imágenes locales de temáticas variadas, sin interrumpir la experiencia del usuario. Verás un aviso discreto arriba de los resultados indicando que se está usando el banco local.

## Tecnologías

- HTML5 semántico
- CSS puro (sin frameworks) — variables CSS, grid, animaciones
- JavaScript vanilla (ES6+) — `fetch`, `async/await`, `Blob`, Web Animations API
- [GSAP](https://gsap.com/) para animaciones, con respaldo nativo
- [Unsplash API](https://unsplash.com/developers)

## Créditos

Fotografías provistas por [Unsplash](https://unsplash.com), bajo la [Licencia Unsplash](https://unsplash.com/license).