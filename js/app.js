/* =========================================================
   KIHS — app.js
   Buscador de imágenes con:
   - Pantalla de inicio con variedad de imágenes (sin búsqueda fija)
   - Conexión a Unsplash API (content_filter en "high")
   - Fallback local si la red falla
   - Filtros cruzados (tamaño / color / tipo / fecha / derechos)
   - Animaciones con GSAP + respaldo nativo (Web Animations API)
   - Descarga forzada vía Blob
   ========================================================= */

/* ----------------------------------------------------------
   0. CONFIGURACIÓN
   La Access Key vive en js/config.js (protegido por .gitignore),
   no directamente aquí, para no exponerla en el repositorio.
   ---------------------------------------------------------- */

const UNSPLASH_ACCESS_KEY = (window.LENTE_CONFIG && window.LENTE_CONFIG.UNSPLASH_ACCESS_KEY) || "";
const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";

if (!UNSPLASH_ACCESS_KEY || UNSPLASH_ACCESS_KEY === "TU_ACCESS_KEY_AQUI") {
  console.warn(
    "[KIHS] No se encontró una Access Key válida en js/config.js. " +
    "Copia js/config.example.js como js/config.js y pega tu propia key. " +
    "Mientras tanto, el buscador usará el banco de imágenes local."
  );
}

/* ----------------------------------------------------------
   1. UTILIDAD: animación con GSAP o respaldo nativo
   Si GSAP no cargó (CDN bloqueado, sin internet, etc.)
   usamos la Web Animations API nativa como respaldo.
   ---------------------------------------------------------- */

const motor = {
  disponible: typeof window.gsap !== "undefined",

  // Anima la aparición de un elemento (fade + slide)
  entrada(el, delay = 0) {
    if (this.disponible) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 16, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, delay, ease: "power2.out" }
      );
    } else {
      el.animate(
        [
          { opacity: 0, transform: "translateY(16px) scale(.97)" },
          { opacity: 1, transform: "translateY(0) scale(1)" }
        ],
        { duration: 450, delay: delay * 1000, easing: "cubic-bezier(.16,.84,.44,1)", fill: "forwards" }
      );
    }
  },

  // Despliega/colapsa el panel de herramientas
  desplegar(el, mostrar) {
    if (this.disponible) {
      if (mostrar) {
        el.hidden = false;
        gsap.fromTo(
          el,
          { height: 0, opacity: 0 },
          {
            height: "auto",
            opacity: 1,
            duration: 0.35,
            ease: "power2.out"
          }
        );
      } else {
        gsap.to(el, {
          height: 0,
          opacity: 0,
          duration: 0.28,
          ease: "power2.in",
          onComplete: () => { el.hidden = true; }
        });
      }
    } else {
      // Respaldo nativo simple con clases
      if (mostrar) {
        el.hidden = false;
        el.animate(
          [{ opacity: 0 }, { opacity: 1 }],
          { duration: 280, easing: "ease-out", fill: "forwards" }
        );
      } else {
        el.animate(
          [{ opacity: 1 }, { opacity: 0 }],
          { duration: 220, easing: "ease-in", fill: "forwards" }
        ).onfinish = () => { el.hidden = true; };
      }
    }
  },

  // Micro-transición al refinar resultados (parpadeo suave de la rejilla)
  refinar(el) {
    if (this.disponible) {
      gsap.fromTo(el, { opacity: 0.3 }, { opacity: 1, duration: 0.3, ease: "power1.out" });
    } else {
      el.animate([{ opacity: 0.3 }, { opacity: 1 }], { duration: 300, easing: "ease-out" });
    }
  },

  toast(el) {
    if (this.disponible) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 20 },
        {
          opacity: 1, y: 0, duration: 0.3, ease: "power2.out",
          onComplete() {
            gsap.to(el, { opacity: 0, y: 20, duration: 0.3, delay: 1.8, onComplete: () => el.classList.remove("show") });
          }
        }
      );
    } else {
      el.classList.add("show");
      setTimeout(() => el.classList.remove("show"), 2100);
    }
  }
};

/* ----------------------------------------------------------
   2. BASE DE DATOS LOCAL DE RESPALDO
   Se usa si la petición a Pixabay falla (sin internet,
   red corporativa que bloquea el dominio, CORS, etc.)
   Variedad amplia de temáticas cotidianas y creativas.
   ---------------------------------------------------------- */

const BANCO_LOCAL = [
  { id: "l1", tags: ["montaña", "naturaleza", "paisaje", "azul"], color: "azul", width: 1920, height: 1280, tipo: "foto",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&q=60" },
  { id: "l2", tags: ["café", "bebida", "mesa", "cafe"], color: "cafe", width: 1200, height: 800, tipo: "foto",
    url: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&q=60" },
  { id: "l3", tags: ["ciudad", "arquitectura", "noche", "morado"], color: "morado", width: 1600, height: 1067, tipo: "foto",
    url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=900&q=60" },
  { id: "l4", tags: ["gato", "animal", "mascota", "gris"], color: "gris", width: 1000, height: 1000, tipo: "foto",
    url: "https://images.unsplash.com/photo-1533738363-b7f9aef128ce?w=900&q=60" },
  { id: "l5", tags: ["comida", "plato", "restaurante", "rojo"], color: "rojo", width: 1400, height: 933, tipo: "foto",
    url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900&q=60" },
  { id: "l6", tags: ["tecnologia", "codigo", "computadora", "negro"], color: "negro", width: 1800, height: 1200, tipo: "foto",
    url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=900&q=60" },
  { id: "l7", tags: ["playa", "mar", "verano", "azul"], color: "azul", width: 2000, height: 1333, tipo: "foto",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&q=60" },
  { id: "l8", tags: ["bosque", "arbol", "verde", "naturaleza"], color: "verde", width: 1500, height: 1000, tipo: "foto",
    url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=900&q=60" },
  { id: "l9", tags: ["deporte", "futbol", "cancha", "verde"], color: "verde", width: 1600, height: 900, tipo: "foto",
    url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=900&q=60" },
  { id: "l10", tags: ["flor", "jardin", "rosa", "primavera"], color: "rosa", width: 1200, height: 1600, tipo: "foto",
    url: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?w=900&q=60" },
  { id: "l11", tags: ["libro", "lectura", "biblioteca", "cafe"], color: "cafe", width: 1400, height: 933, tipo: "foto",
    url: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=900&q=60" },
  { id: "l12", tags: ["auto", "carro", "carretera", "amarillo"], color: "amarillo", width: 1920, height: 1080, tipo: "foto",
    url: "https://images.unsplash.com/photo-1502877338535-766e1452684a?w=900&q=60" },
  { id: "l13", tags: ["perro", "animal", "mascota", "blanco"], color: "blanco", width: 1000, height: 1250, tipo: "foto",
    url: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=900&q=60" },
  { id: "l14", tags: ["desierto", "arena", "naranja", "paisaje"], color: "naranja", width: 1800, height: 1200, tipo: "foto",
    url: "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=900&q=60" },
  { id: "l15", tags: ["musica", "guitarra", "instrumento", "negro"], color: "negro", width: 1400, height: 933, tipo: "foto",
    url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=900&q=60" },
  { id: "l16", tags: ["nieve", "invierno", "montaña", "blanco"], color: "blanco", width: 1920, height: 1280, tipo: "foto",
    url: "https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=900&q=60" },
  { id: "l17", tags: ["icono", "diseño", "clipart", "morado"], color: "morado", width: 512, height: 512, tipo: "clipart",
    url: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=60" },
  { id: "l18", tags: ["dibujo", "lineal", "bosquejo", "gris"], color: "gris", width: 800, height: 800, tipo: "lineal",
    url: "https://images.unsplash.com/photo-1618004652321-13a63e576b80?w=600&q=60" },
  { id: "l19", tags: ["cafeteria", "postre", "dulce", "rosa"], color: "rosa", width: 1300, height: 867, tipo: "foto",
    url: "https://images.unsplash.com/photo-1481391319762-47dff72954d9?w=900&q=60" },
  { id: "l20", tags: ["oficina", "trabajo", "escritorio", "azul"], color: "azul", width: 1600, height: 1067, tipo: "foto",
    url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=900&q=60" }
];

/* ----------------------------------------------------------
   3. ESTADO GLOBAL
   ---------------------------------------------------------- */

const estado = {
  query: "",
  resultadosCrudos: [],   // lo que devolvió la API o el banco local
  filtros: {
    tamano: "cualquiera",
    color: "cualquiera",
    tipo: "cualquiera",
    fecha: "cualquiera",
    derechos: "cualquiera"
  }
};

/* ----------------------------------------------------------
   4. REFERENCIAS AL DOM
   ---------------------------------------------------------- */

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const toolsToggle = document.getElementById("tools-toggle");
const toolsPanel = document.getElementById("tools-panel");
const clearFiltersBtn = document.getElementById("clear-filters");
const statsEl = document.getElementById("results-stats");
const statusBanner = document.getElementById("status-banner");
const grid = document.getElementById("results-grid");
const emptyState = document.getElementById("empty-state");
const toast = document.getElementById("toast");

/* ----------------------------------------------------------
   5. PANEL DE HERRAMIENTAS: abrir/cerrar + pestañas
   ---------------------------------------------------------- */

toolsToggle.addEventListener("click", () => {
  const abierto = toolsToggle.getAttribute("aria-expanded") === "true";
  toolsToggle.setAttribute("aria-expanded", String(!abierto));
  motor.desplegar(toolsPanel, !abierto);
});

// Abrir/cerrar cada dropdown de sección al hacer clic en su pestaña
document.querySelectorAll(".tool-tab").forEach(tab => {
  tab.addEventListener("click", (e) => {
    e.stopPropagation();
    const dropdown = tab.nextElementSibling;
    const yaAbierto = dropdown.classList.contains("show");

    // Cierra cualquier otro dropdown abierto
    document.querySelectorAll(".tool-dropdown.show").forEach(d => d.classList.remove("show"));
    document.querySelectorAll(".tool-tab.open").forEach(t => t.classList.remove("open"));

    if (!yaAbierto) {
      dropdown.classList.add("show");
      tab.classList.add("open");
    }
  });
});

// Cierra los dropdowns si se hace clic fuera
document.addEventListener("click", () => {
  document.querySelectorAll(".tool-dropdown.show").forEach(d => d.classList.remove("show"));
  document.querySelectorAll(".tool-tab.open").forEach(t => t.classList.remove("open"));
});

// Selección de una opción dentro de una sección
document.querySelectorAll(".tool-dropdown .option, .swatch").forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const { filter, value } = btn.dataset;
    aplicarSeleccion(filter, value, btn);
  });
});

function aplicarSeleccion(filtro, valor, btnClicado) {
  estado.filtros[filtro] = valor;

  // Actualiza clases activas dentro de la misma sección
  const seccion = document.querySelector(`.tool-section[data-section="${filtro}"]`);
  seccion.querySelectorAll(".option").forEach(o => o.classList.toggle("active", o === btnClicado));
  seccion.querySelectorAll(".swatch").forEach(s => s.classList.toggle("active", s === btnClicado));

  // Si se eligió un color de la paleta, desmarcar "cualquier color" y viceversa
  if (filtro === "color" && btnClicado.classList.contains("swatch")) {
    seccion.querySelectorAll(".option").forEach(o => o.classList.remove("active"));
  } else if (filtro === "color") {
    seccion.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
  }

  // Etiqueta visible en la pestaña (ej. "Color: Azul")
  const tab = seccion.querySelector(".tool-tab-value");
  tab.textContent = valor === "cualquiera" ? "" : `· ${etiquetaLegible(valor)}`;

  actualizarBotonBorrar();
  renderizarResultados(); // refina en tiempo real, sin nueva petición a la API
}

function etiquetaLegible(valor) {
  const mapa = {
    grande: "Grandes", mediano: "Medianos", icono: "Iconos",
    byn: "Blanco y negro", transparente: "Transparentes",
    rojo: "Rojo", naranja: "Naranja", amarillo: "Amarillo", verde: "Verde",
    azul: "Azul", morado: "Morado", rosa: "Rosa", cafe: "Café", negro: "Negro",
    gris: "Gris", blanco: "Blanco",
    clipart: "Clip art", lineal: "Dibujo lineal", gif: "GIF animado",
    "24h": "Últimas 24h", semana: "Última semana", anio: "Último año",
    cc: "Creative Commons", comercial: "Comercial"
  };
  return mapa[valor] || valor;
}

function actualizarBotonBorrar() {
  const hayFiltrosActivos = Object.values(estado.filtros).some(v => v !== "cualquiera");
  clearFiltersBtn.classList.toggle("hidden", !hayFiltrosActivos);
}

clearFiltersBtn.addEventListener("click", () => {
  Object.keys(estado.filtros).forEach(f => (estado.filtros[f] = "cualquiera"));
  document.querySelectorAll(".tool-dropdown .option").forEach(o => {
    o.classList.toggle("active", o.dataset.value === "cualquiera");
  });
  document.querySelectorAll(".swatch").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".tool-tab-value").forEach(t => (t.textContent = ""));
  actualizarBotonBorrar();
  renderizarResultados();
});

/* ----------------------------------------------------------
   6. PANTALLA DE INICIO: variedad de imágenes sin búsqueda fija
   Usa el endpoint de fotos aleatorias de Unsplash (sin "query"),
   así cada visita/recarga trae una mezcla distinta de temáticas.
   ---------------------------------------------------------- */

const UNSPLASH_RANDOM_ENDPOINT = "https://api.unsplash.com/photos/random";

async function mostrarPantallaInicio() {
  mostrarEstado("Cargando imágenes…");
  const t0 = performance.now();
  estado.query = "";

  try {
    if (!UNSPLASH_ACCESS_KEY) {
      throw new Error("Falta configurar la Access Key en js/config.js.");
    }

    const params = new URLSearchParams({
      count: "30",
      content_filter: "high"   // búsqueda segura también en la pantalla de inicio
    });

    const resp = await fetch(`${UNSPLASH_RANDOM_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });
    if (!resp.ok) throw new Error(`Error de red: ${resp.status}`);

    const data = await resp.json();

    estado.resultadosCrudos = data.map(hit => ({
      id: String(hit.id),
      tags: (hit.tags || []).map(t => t.title).filter(Boolean),
      color: hexANombreColor(hit.color),
      width: hit.width,
      height: hit.height,
      tipo: "foto",
      url: hit.urls.small,
      descargaUrl: hit.urls.full,
      downloadLocation: hit.links.download_location
    }));

    ocultarEstado();
  } catch (err) {
    console.warn("[KIHS] Falló la API de Unsplash en el inicio, usando banco local:", err.message);
    mostrarEstado("Sin conexión a la API. Mostrando imágenes locales.");

    // Sin query -> se muestra TODO el banco local, con su variedad completa de temáticas
    estado.resultadosCrudos = BANCO_LOCAL.map(img => ({ ...img, descargaUrl: img.url }));
  }

  const t1 = performance.now();
  const segundos = ((t1 - t0) / 1000).toFixed(2);
  actualizarContador(estado.resultadosCrudos.length, segundos);
  renderizarResultados();
}

/* ----------------------------------------------------------
   7. BÚSQUEDA: conexión a Unsplash + respaldo local
   ---------------------------------------------------------- */

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const texto = input.value.trim();
  if (!texto) return;
  estado.query = texto;
  await buscarImagenes(texto);
});

async function buscarImagenes(query) {
  mostrarEstado("Buscando…");
  const t0 = performance.now();

  try {
    if (!UNSPLASH_ACCESS_KEY) {
      throw new Error("Falta configurar la Access Key en js/config.js.");
    }

    const params = new URLSearchParams({
      query,
      per_page: "30",
      content_filter: "high"   // equivalente a búsqueda segura en Unsplash
    });

    const resp = await fetch(`${UNSPLASH_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` }
    });
    if (!resp.ok) throw new Error(`Error de red: ${resp.status}`);

    const data = await resp.json();

    estado.resultadosCrudos = data.results.map(hit => ({
      id: String(hit.id),
      tags: (hit.tags || []).map(t => t.title).filter(Boolean),
      color: hexANombreColor(hit.color),   // Unsplash sí da el color dominante real
      width: hit.width,
      height: hit.height,
      tipo: "foto",
      url: hit.urls.small,
      descargaUrl: hit.urls.full,
      downloadLocation: hit.links.download_location // requerido por las normas de Unsplash al descargar
    }));

    ocultarEstado();
  } catch (err) {
    console.warn("[KIHS] Falló la API de Unsplash, usando banco local:", err.message);
    mostrarEstado("Sin conexión a la API. Mostrando resultados locales.");

    // Filtra el banco local por relevancia simple de texto (tags o coincidencia parcial)
    const q = query.toLowerCase();
    let coincidencias = BANCO_LOCAL.filter(img =>
      img.tags.some(tag => tag.includes(q) || q.includes(tag))
    );
    // Si no hay coincidencia directa, muestra todo el banco (variedad amplia)
    if (coincidencias.length === 0) coincidencias = BANCO_LOCAL;

    estado.resultadosCrudos = coincidencias.map(img => ({ ...img, descargaUrl: img.url }));
  }

  const t1 = performance.now();
  const segundos = ((t1 - t0) / 1000).toFixed(2);
  actualizarContador(estado.resultadosCrudos.length, segundos);
  renderizarResultados();
}

function mostrarEstado(msg) {
  statusBanner.textContent = msg;
  statusBanner.classList.remove("hidden");
}
function ocultarEstado() {
  statusBanner.classList.add("hidden");
}

/* ----------------------------------------------------------
   8. CONTADOR DE RESULTADOS (estadística simulada)
   ---------------------------------------------------------- */

function actualizarContador(cantidadReal, segundos) {
  // Simulamos una cifra "de estilo buscador" a partir de resultados reales
  const factor = 1000 + Math.floor(Math.random() * 900000);
  const numeroSimulado = (cantidadReal * factor).toLocaleString("es-ES");
  statsEl.textContent = `Cerca de ${numeroSimulado} resultados (${segundos} s)`;
}

/* ----------------------------------------------------------
   9. FILTRADO "SEMÁNTICO": cruza filtros con propiedades reales
   ---------------------------------------------------------- */

function pasaFiltros(img) {
  const f = estado.filtros;

  // --- Tamaño (según dimensiones reales de la imagen) ---
  if (f.tamano !== "cualquiera") {
    const area = img.width * img.height;
    if (f.tamano === "grande" && area < 1_000_000) return false;
    if (f.tamano === "mediano" && (area < 150_000 || area >= 1_000_000)) return false;
    if (f.tamano === "icono" && area >= 150_000) return false;
  }

  // --- Color (color dominante estimado o etiquetas) ---
  if (f.color !== "cualquiera") {
    const colorImg = img.color || inferirColorPorTags(img.tags);
    if (f.color === "byn") {
      if (!(colorImg === "gris" || colorImg === "negro" || colorImg === "blanco")) return false;
    } else if (f.color === "transparente") {
      if (img.tipo !== "clipart") return false; // aproximación: PNGs/clipart suelen tener fondo transparente
    } else if (colorImg !== f.color) {
      return false;
    }
  }

  // --- Tipo de archivo/estilo ---
  if (f.tipo !== "cualquiera" && img.tipo !== f.tipo) return false;

  // --- Fecha: simulada de forma determinística por id, ya que la API
  //     gratuita no siempre expone la fecha de publicación exacta ---
  if (f.fecha !== "cualquiera") {
    const antiguedadDias = hashSimple(img.id) % 400; // 0–399 días "simulados"
    if (f.fecha === "24h" && antiguedadDias > 1) return false;
    if (f.fecha === "semana" && antiguedadDias > 7) return false;
    if (f.fecha === "anio" && antiguedadDias > 365) return false;
  }

  // --- Derechos de uso: simulado de forma determinística también ---
  if (f.derechos !== "cualquiera") {
    const esComercial = hashSimple(img.id) % 2 === 0;
    if (f.derechos === "comercial" && !esComercial) return false;
    if (f.derechos === "cc" && esComercial) return false;
  }

  return true;
}

// Si no tenemos color real, lo inferimos de las etiquetas de texto
function inferirColorPorTags(tags = []) {
  const colores = ["rojo","naranja","amarillo","verde","azul","morado","rosa","cafe","negro","gris","blanco"];
  return tags.find(t => colores.includes(t)) || null;
}

// Convierte el hex de color dominante que entrega Unsplash a un nombre de nuestra paleta
function hexANombreColor(hex) {
  if (!hex) return null;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const paleta = {
    rojo: [225, 78, 78], naranja: [232, 135, 58], amarillo: [228, 197, 58],
    verde: [76, 175, 109], azul: [63, 127, 224], morado: [138, 95, 214],
    rosa: [224, 104, 168], cafe: [138, 90, 60], negro: [34, 34, 38],
    gris: [154, 160, 166], blanco: [255, 255, 255]
  };

  let masCercano = null;
  let distanciaMin = Infinity;
  for (const [nombre, [pr, pg, pb]] of Object.entries(paleta)) {
    const distancia = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distancia < distanciaMin) {
      distanciaMin = distancia;
      masCercano = nombre;
    }
  }
  return masCercano;
}

// Hash numérico simple y determinístico a partir de un string (para simular metadatos)
function hashSimple(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

/* ----------------------------------------------------------
   10. RENDERIZADO DE LA REJILLA
   ---------------------------------------------------------- */

function renderizarResultados() {
  const filtrados = estado.resultadosCrudos.filter(pasaFiltros);

  grid.innerHTML = "";

  if (filtrados.length === 0) {
    emptyState.classList.remove("hidden");
    motor.refinar(grid);
    return;
  }
  emptyState.classList.add("hidden");

  filtrados.forEach((img, i) => {
    const card = document.createElement("article");
    card.className = "result-card";
    card.innerHTML = `
      <img src="${img.url}" alt="${(img.tags || []).join(', ')}" loading="lazy">
      <div class="card-overlay">
        <div class="card-tags">
          ${(img.tags || []).slice(0, 2).map(t => `<span class="card-tag">${t}</span>`).join("")}
        </div>
        <div class="card-actions">
          <button class="download-btn" title="Descargar imagen" aria-label="Descargar imagen">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M5 20h14v-2H5v2zm7-18v12.17l4-4L17.41 11.6 12 17l-5.41-5.4L8 10.17l4 4V2h0z"/></svg>
          </button>
        </div>
      </div>
    `;

    card.querySelector(".download-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      descargarImagen(img.descargaUrl || img.url, `kihs-${img.id}.jpg`, e.currentTarget, img.downloadLocation);
    });

    grid.appendChild(card);
    motor.entrada(card, i * 0.03); // pequeño stagger progresivo
  });
}

/* ----------------------------------------------------------
   11. DESCARGA DIRECTA (fetch -> Blob -> disco local)
   ---------------------------------------------------------- */

async function descargarImagen(url, nombreArchivo, boton, downloadLocation) {
  boton.classList.add("loading");
  try {
    // Unsplash exige notificar este endpoint cada vez que se descarga una foto
    // (requisito de sus normas de API, no afecta al usuario ni bloquea nada si falla)
    if (downloadLocation && UNSPLASH_ACCESS_KEY) {
      fetch(`${downloadLocation}?client_id=${UNSPLASH_ACCESS_KEY}`).catch(() => {});
    }

    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) throw new Error("No se pudo obtener el archivo.");
    const blob = await resp.blob();

    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);

    mostrarToast("Descarga iniciada ✓");
  } catch (err) {
    console.error("[KIHS] Error al descargar:", err);
    // Respaldo: si el fetch falla por CORS, abrimos en pestaña nueva como último recurso
    window.open(url, "_blank");
    mostrarToast("No se pudo forzar la descarga, se abrió en otra pestaña.");
  } finally {
    boton.classList.remove("loading");
  }
}

function mostrarToast(mensaje) {
  toast.textContent = mensaje;
  toast.classList.remove("hidden");
  motor.toast(toast);
}

/* ----------------------------------------------------------
   12. ARRANQUE: pantalla de inicio con variedad
   ---------------------------------------------------------- */

window.addEventListener("DOMContentLoaded", () => {
  input.value = "";               // no dejamos una búsqueda predeterminada en el input
  mostrarPantallaInicio();        // en su lugar, mostramos variedad de imágenes de entrada
});