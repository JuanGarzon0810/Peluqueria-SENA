"use strict";
/* ============================================================
   Núcleo compartido: API, sesión, utilidades de interfaz y
   formulario de usuarios (lo usan el registro y el panel admin).
   ============================================================ */

const API_DEFECTO = "http://localhost:3333"; // Puerto por defecto del backend (.env → PORT)
const CLAVE_SESION = "usuarioPeluqueria";
const CLAVE_API = "apiPeluqueria";
const TIEMPO_ESPERA_API = 15000;

/* ---------- Configuración del servidor ---------- */
const Config = {
  api() {
    try {
      return (localStorage.getItem(CLAVE_API) || API_DEFECTO).replace(/\/+$/, "");
    } catch {
      return API_DEFECTO;
    }
  },
  fijarApi(url) {
    const limpia = String(url || "").trim().replace(/\/+$/, "");
    if (!limpia) return { ok: false, error: "Escribe la dirección del backend." };

    let direccion;
    try {
      direccion = new URL(limpia);
    } catch {
      return { ok: false, error: "Escribe una URL válida, por ejemplo: http://localhost:3333." };
    }
    if (
      !["http:", "https:"].includes(direccion.protocol) ||
      direccion.username ||
      direccion.password ||
      direccion.pathname !== "/" ||
      direccion.search ||
      direccion.hash
    ) {
      return { ok: false, error: "Usa una dirección HTTP o HTTPS sin rutas, parámetros ni credenciales." };
    }

    try {
      if (limpia === API_DEFECTO) localStorage.removeItem(CLAVE_API);
      else localStorage.setItem(CLAVE_API, limpia);
      return { ok: true };
    } catch {
      return { ok: false, error: "No se pudo guardar la dirección en este navegador." };
    }
  },
};

/* ---------- Acceso a objetos sin importar mayúsculas ---------- */
// Los endpoints devuelven nombres distintos (idhorario / idHorario, etc.)
function dato(obj, ...nombres) {
  if (!obj || typeof obj !== "object") return undefined;
  const claves = Object.keys(obj);
  for (const n of nombres) {
    const k = claves.find((c) => c.toLowerCase() === n.toLowerCase());
    if (k !== undefined && obj[k] !== null && obj[k] !== undefined) return obj[k];
  }
  return undefined;
}

/* ---------- Llamadas a la API ---------- */
// Siempre devuelve { ok, status, datos, error }. Nunca lanza excepciones.
async function api(ruta, { method = "GET", body } = {}) {
  const control = new AbortController();
  const temporizador = setTimeout(() => control.abort(), TIEMPO_ESPERA_API);
  let r;
  try {
    r = await fetch(Config.api() + ruta, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: control.signal,
    });
  } catch (error) {
    const tardanza = error && error.name === "AbortError";
    return {
      ok: false,
      status: 0,
      datos: {},
      error: tardanza
        ? `El servidor tardó más de ${TIEMPO_ESPERA_API / 1000} segundos en responder (${Config.api()}).`
        : `No hay conexión con el servidor (${Config.api()}). Verifica que el backend esté encendido.`,
    };
  } finally {
    clearTimeout(temporizador);
  }

  const datos = (await r.json().catch(() => ({}))) || {};
  let error = null;
  if (!r.ok) {
    // Unos endpoints responden { error } y otros { mensaje }
    error = datos.error || datos.mensaje || `El servidor respondió con un error (${r.status}).`;
    if (datos.sugerencia) error += " " + datos.sugerencia;
  }
  return { ok: r.ok, status: r.status, datos, error };
}

/* ---------- Sesión ---------- */
const Sesion = {
  usuario() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_SESION));
    } catch {
      return null;
    }
  },
  guardar(u) {
    // Nunca se guarda el hash de la contraseña en el navegador
    const { contrasena, ...limpio } = u;
    localStorage.setItem(CLAVE_SESION, JSON.stringify(limpio));
  },
  salir() {
    localStorage.removeItem(CLAVE_SESION);
  },
  // Los clientes no traen "rol" desde la API
  rol(u) {
    return u && (u.rol === "admin" || u.rol === "trabajador") ? u.rol : "cliente";
  },
  id(u) {
    return Number(dato(u, "idTrabajador", "idCliente", "id"));
  },
  // Guarda de rol (solo UX; la seguridad real debe ir en el backend)
  proteger(rolEsperado) {
    const u = this.usuario();
    if (!u) {
      location.replace("../index.html");
      return null;
    }
    if (this.rol(u) !== rolEsperado) {
      location.replace(`${this.rol(u)}.html`);
      return null;
    }
    return u;
  },
};

// Mensaje que se muestra una vez en la pantalla de acceso
const Flash = {
  poner(t) {
    try {
      sessionStorage.setItem("flashPeluqueria", t);
    } catch {}
  },
  tomar() {
    try {
      const t = sessionStorage.getItem("flashPeluqueria");
      sessionStorage.removeItem("flashPeluqueria");
      return t;
    } catch {
      return null;
    }
  },
};

/* ---------- Creación de elementos (siempre con textContent: sin XSS) ---------- */
function el(tag, attrs, ...hijos) {
  const n = document.createElement(tag);
  if (typeof attrs === "string") n.className = attrs;
  else if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (["value", "checked", "disabled", "selected"].includes(k)) n[k] = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
  }
  const poner = (h) => {
    if (h == null || h === false) return;
    if (Array.isArray(h)) h.forEach(poner);
    else n.append(h instanceof Node ? h : document.createTextNode(String(h)));
  };
  hijos.forEach(poner);
  return n;
}

/* ---------- Iconos internos (nunca datos del usuario) ---------- */
const ICONOS = {
  tijeras:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><path d="M20 4 8.12 15.88"></path><path d="M14.47 14.48 20 20"></path><path d="M8.12 8.12 12 12"></path></svg>',
  salir:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><path d="m16 17 5-5-5-5"></path><path d="M21 12H9"></path></svg>',
  calendario:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path></svg>',
  reloj:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
  usuario:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>',
  equipo:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6"></path><path d="M18 14.2a6 6 0 0 1 3.5 5.8"></path></svg>',
  buscar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>',
  alerta:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4M12 17h.01"></path></svg>',
  check:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m8 12 2.5 2.5L16 9"></path></svg>',
  info:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5M12 8h.01"></path></svg>',
};

function icono(nombre, clase = "") {
  const caja = document.createElement("span");
  caja.className = "icono" + (clase ? " " + clase : "");
  caja.setAttribute("aria-hidden", "true");
  caja.innerHTML = ICONOS[nombre] || "";
  return caja;
}

/* ---------- Iniciales para el avatar ---------- */
function iniciales(nombre) {
  const partes = String(nombre || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  const primera = Array.from(partes[0])[0] || "";
  const ultima = partes.length > 1 ? Array.from(partes[partes.length - 1])[0] || "" : "";
  return (primera + ultima).toUpperCase() || "?";
}

/* ---------- Textos y números ---------- */
const FORMATO_NUMERO = new Intl.NumberFormat("es-CO");

function numero(n) {
  return FORMATO_NUMERO.format(Number(n) || 0);
}

function plural(n, singular, plural_) {
  return Number(n) === 1 ? singular : plural_;
}

/* ---------- Estados vacíos y de error ---------- */
function estadoVacio(nombreIcono, titulo, texto) {
  return el(
    "div",
    "vacio",
    icono(nombreIcono || "calendario"),
    el("strong", null, titulo),
    texto ? el("p", null, texto) : null,
  );
}

function estadoError(mensaje, reintentar) {
  const boton = el("button", { type: "button", class: "btn sec" }, "Reintentar");
  boton.addEventListener("click", reintentar);
  return el(
    "div",
    "fallo",
    icono("alerta"),
    el("div", "fallo-texto", el("strong", null, "No se pudo cargar"), el("p", null, mensaje)),
    boton,
  );
}

/* ---------- Esqueletos de carga ---------- */
function esqueletoFilas(cantidad = 3) {
  return el(
    "div",
    { class: "esqueleto", "aria-hidden": "true" },
    Array.from({ length: cantidad }, () =>
      el(
        "div",
        "esqueleto-fila",
        el("span", "esqueleto-hora"),
        el("span", "esqueleto-info"),
        el("span", "esqueleto-pill"),
      ),
    ),
  );
}

/* ---------- Avisos emergentes ---------- */
function toast(texto, tipo = "ok") {
  let caja = document.getElementById("toasts");
  if (!caja) {
    caja = el("div", { id: "toasts", class: "toasts", role: "status", "aria-live": "polite" });
    document.body.append(caja);
  }
  // Un <dialog> abierto tapa todo el documento: el aviso debe vivir dentro de él
  (document.querySelector("dialog[open]") || document.body).append(caja);

  // Evita que una ráfaga de avisos llene la pantalla
  while (caja.children.length >= 4) caja.firstElementChild.remove();

  const t = el(
    "div",
    "toast " + tipo,
    icono(tipo === "error" ? "alerta" : tipo === "info" ? "info" : "check"),
    el("span", "toast-texto", texto),
  );
  caja.append(t);

  let restante = tipo === "error" ? 7000 : 4200;
  let inicio = Date.now();
  let temporizador = null;
  let saliendo = false;

  const salir = () => {
    if (saliendo) return;
    saliendo = true;
    clearTimeout(temporizador);
    t.classList.add("saliendo");
    t.addEventListener("transitionend", () => t.remove(), { once: true });
    setTimeout(() => t.remove(), 400);
  };

  const programar = () => {
    clearTimeout(temporizador);
    inicio = Date.now();
    temporizador = setTimeout(salir, restante);
  };

  // Pausa el temporizador mientras se lee o se interactúa con el aviso
  t.addEventListener("pointerenter", () => {
    restante = Math.max(1200, restante - (Date.now() - inicio));
    clearTimeout(temporizador);
  });
  t.addEventListener("pointerleave", programar);
  t.addEventListener("focusin", () => clearTimeout(temporizador));
  t.addEventListener("focusout", programar);

  programar();
}

/* ---------- Ventanas modales ---------- */
let contadorModal = 0;

function modal(titulo, cuerpo) {
  const anterior = document.activeElement;
  const idTitulo = "modal-titulo-" + ++contadorModal;
  const dlg = el("dialog", { class: "modal", "aria-labelledby": idTitulo });
  dlg.append(
    el(
      "div",
      "modal-cab",
      el("h2", { id: idTitulo }, titulo),
      el("button", { type: "button", class: "cerrar", "aria-label": "Cerrar", onclick: () => dlg.close() }, "×"),
    ),
    cuerpo,
  );
  dlg.addEventListener("close", () => {
    dlg.remove();
    document.body.classList.toggle("modal-abierto", Boolean(document.querySelector("dialog[open]")));
    if (anterior && typeof anterior.focus === "function" && document.contains(anterior)) anterior.focus();
  });
  dlg.addEventListener("click", (e) => {
    if (e.target === dlg) dlg.close(); // clic en el fondo
  });
  document.body.append(dlg);
  document.body.classList.add("modal-abierto");
  dlg.showModal();
  return dlg;
}

function confirmar(titulo, texto, { boton = "Confirmar", peligro = false } = {}) {
  return new Promise((resolver) => {
    let acepto = false;
    const ok = el("button", { type: "button", class: "btn" + (peligro ? " peligro" : "") }, boton);
    const no = el("button", { type: "button", class: "btn sec" }, "Cancelar");
    const cuerpo = el("div", "modal-cuerpo", el("p", null, texto), el("div", "acciones", no, ok));
    const dlg = modal(titulo, cuerpo);
    ok.addEventListener("click", () => {
      acepto = true;
      dlg.close();
    });
    no.addEventListener("click", () => dlg.close());
    dlg.addEventListener("close", () => resolver(acepto));
    ok.focus();
  });
}

// Deshabilita un botón mientras se ejecuta una acción asíncrona
async function conCarga(boton, fn) {
  if (boton) {
    boton.disabled = true;
    boton.setAttribute("aria-busy", "true");
  }
  try {
    return await fn();
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute("aria-busy");
    }
  }
}

/* ---------- Pestañas ---------- */
// paneles: [{ id, titulo, render(contenedor) }]
function pestanas(barra, contenedor, paneles, inicial) {
  const botones = {};

  function mostrar(id) {
    const p = paneles.find((x) => x.id === id) || paneles[0];
    for (const [k, b] of Object.entries(botones)) {
      b.setAttribute("aria-selected", String(k === p.id));
      b.tabIndex = k === p.id ? 0 : -1;
    }
    contenedor.replaceChildren();
    contenedor.setAttribute("aria-labelledby", "tab-" + p.id);
    p.render(contenedor);
    try {
      history.replaceState(null, "", "#" + p.id);
    } catch {}
  }

  barra.setAttribute("role", "tablist");
  contenedor.setAttribute("role", "tabpanel");
  paneles.forEach((p) => {
    const b = el("button", {
      type: "button",
      role: "tab",
      id: "tab-" + p.id,
      class: "pestana",
      "aria-controls": contenedor.id,
    }, p.titulo);
    b.addEventListener("click", () => mostrar(p.id));
    b.addEventListener("keydown", (e) => {
      const i = paneles.findIndex((x) => x.id === p.id);
      let destino = null;
      if (e.key === "ArrowRight") destino = (i + 1) % paneles.length;
      else if (e.key === "ArrowLeft") destino = (i - 1 + paneles.length) % paneles.length;
      else if (e.key === "Home") destino = 0;
      else if (e.key === "End") destino = paneles.length - 1;
      if (destino === null) return;
      e.preventDefault();
      const sig = paneles[destino].id;
      mostrar(sig);
      botones[sig].focus();
    });
    botones[p.id] = b;
    barra.append(b);
  });

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (paneles.some((p) => p.id === id)) mostrar(id);
  });

  mostrar(inicial && paneles.some((p) => p.id === inicial) ? inicial : paneles[0].id);
}

/* ---------- Estructura común de los paneles ---------- */
function iniciarPanel(rol, etiqueta) {
  const u = Sesion.proteger(rol);
  if (!u) return null;
  const nombre = u.nombres || "Usuario";
  document.getElementById("nombre").textContent = nombre;
  document.getElementById("rol").textContent = etiqueta;
  const avatar = document.getElementById("avatar");
  if (avatar) avatar.textContent = iniciales(nombre);
  document.getElementById("btnCerrarSesion").addEventListener("click", () => {
    Sesion.salir();
    location.replace("../index.html");
  });
  return u;
}

/* ---------- Validación (misma que aplica el backend) ---------- */
const CAMPOS_USUARIO = [
  {
    clave: "t1",
    etiqueta: "Tipo de documento",
    tipo: "select",
    opciones: [
      ["CC", "Cédula de ciudadanía (CC)"],
      ["TI", "Tarjeta de identidad (TI)"],
      ["CE", "Cédula de extranjería (CE)"],
    ],
    validar: (v) => (/^(CC|TI|CE)$/.test(v) ? null : "Selecciona un tipo de documento."),
  },
  {
    clave: "t2",
    etiqueta: "Número de documento",
    inputmode: "numeric",
    maxlength: 10,
    validar: (v) => (/^\d{8,10}$/.test(v) ? null : "Debe tener entre 8 y 10 dígitos numéricos."),
  },
  {
    clave: "t3",
    etiqueta: "Nombres y apellidos",
    autocomplete: "name",
    autocapitalize: "words",
    maxlength: 100,
    validar: (v) =>
      /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{3,100}$/.test(v)
        ? null
        : "Usa solo letras y espacios (mínimo 3 caracteres).",
  },
  {
    clave: "t4",
    etiqueta: "Dirección",
    autocomplete: "street-address",
    maxlength: 200,
    validar: (v) =>
      /^[A-Za-z0-9ÁÉÍÓÚáéíóúÑñ\s.,#ºª/-]{5,200}$/.test(v)
        ? null
        : "Escribe una dirección de al menos 5 caracteres. Puedes usar letras, números y signos habituales de dirección.",
  },
  {
    clave: "t5",
    etiqueta: "Teléfono",
    inputmode: "numeric",
    maxlength: 10,
    autocomplete: "tel",
    validar: (v) => (/^\d{10}$/.test(v) ? null : "Debe tener exactamente 10 dígitos numéricos."),
  },
  {
    clave: "t6",
    etiqueta: "Correo electrónico",
    type: "email",
    maxlength: 250,
    autocomplete: "email",
    autocapitalize: "none",
    spellcheck: "false",
    validar: (v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 250 ? null : "Correo inválido. Ejemplo: nombre@correo.com",
  },
  {
    clave: "t7",
    etiqueta: "Contraseña",
    type: "password",
    sinTrim: true,
    autocomplete: "new-password",
    enterkeyhint: "done",
    validar: (v) =>
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(v)
        ? null
        : "Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.",
  },
];

/* Fuerza visual de la contraseña: 0 (vacía) a 4 (muy fuerte) */
function fuerzaClave(valor) {
  const v = String(valor || "");
  if (!v) return 0;
  let puntos = 0;
  if (v.length >= 8) puntos++;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) puntos++;
  if (/\d/.test(v)) puntos++;
  if (/[\W_]/.test(v)) puntos++;
  if (v.length >= 12) puntos++;
  return Math.max(1, Math.min(4, puntos));
}

const ETIQUETAS_FUERZA = ["", "Muy débil", "Débil", "Buena", "Muy fuerte"];

/* Formulario de 7 campos (t1…t7) con validación en línea.
   enviar(body) debe devolver el resultado de api(). */
function formularioUsuario({ boton = "Guardar", enviar, alExito }) {
  const form = el("form", { class: "form-grid", novalidate: true });
  const entradas = {};
  const errores = {};
  let medidor = null;

  CAMPOS_USUARIO.forEach((c) => {
    const id = "u-" + c.clave + "-" + Math.random().toString(36).slice(2, 7);
    let entrada;
    if (c.tipo === "select") {
      entrada = el("select", { id, required: true }, c.opciones.map(([v, t]) => el("option", { value: v }, t)));
    } else {
      entrada = el("input", {
        id,
        type: c.type || "text",
        inputmode: c.inputmode,
        maxlength: c.maxlength,
        autocomplete: c.autocomplete || "off",
        autocapitalize: c.autocapitalize,
        spellcheck: c.spellcheck,
        enterkeyhint: c.enterkeyhint,
        required: true,
      });
    }
    const err = el("small", { class: "error-campo", id: id + "-e" });
    entrada.setAttribute("aria-describedby", id + "-e");
    entradas[c.clave] = entrada;
    errores[c.clave] = err;

    let contenido = entrada;
    let extra = null;
    if (c.type === "password") {
      const ver = el("button", { type: "button", "aria-pressed": "false" }, "Mostrar");
      ver.addEventListener("click", () => {
        const oculta = entrada.type === "password";
        entrada.type = oculta ? "text" : "password";
        ver.textContent = oculta ? "Ocultar" : "Mostrar";
        ver.setAttribute("aria-pressed", String(oculta));
      });
      contenido = el("div", "clave", entrada, ver);

      medidor = el(
        "div",
        { class: "medidor", "aria-hidden": "true" },
        el(
          "div",
          "medidor-barras",
          el("span", "medidor-barra"),
          el("span", "medidor-barra"),
          el("span", "medidor-barra"),
          el("span", "medidor-barra"),
        ),
        el("span", "medidor-texto", "Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo."),
      );
      extra = medidor;
    }

    const bloque = el(
      "div",
      "campo" + (c.clave === "t4" || c.clave === "t3" ? " ancho" : ""),
      el("label", { for: id }, c.etiqueta),
      contenido,
      extra,
      err,
    );
    form.append(bloque);

    const pintarFuerza = () => {
      if (!medidor) return;
      const fuerza = fuerzaClave(entrada.value);
      medidor.dataset.fuerza = String(fuerza);
      medidor.lastElementChild.textContent = fuerza
        ? `Seguridad: ${ETIQUETAS_FUERZA[fuerza]}.`
        : "Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.";
    };

    entrada.addEventListener("input", () => {
      err.textContent = "";
      entrada.removeAttribute("aria-invalid");
      pintarFuerza();
    });
    // Valida al salir del campo, no mientras el usuario todavía escribe
    entrada.addEventListener("blur", () => {
      const valor = c.sinTrim ? entrada.value : entrada.value.trim();
      if (!valor) return;
      const msg = c.validar(valor);
      if (msg) {
        err.textContent = msg;
        entrada.setAttribute("aria-invalid", "true");
      }
    });
  });

  const aviso = el("p", { class: "aviso ancho", role: "alert" });
  const enviarBtn = el("button", { type: "submit", class: "btn" }, boton);
  form.append(el("div", "ancho", enviarBtn), aviso);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    aviso.textContent = "";
    aviso.className = "aviso ancho";
    const body = {};
    let primero = null;
    CAMPOS_USUARIO.forEach((c) => {
      const crudo = entradas[c.clave].value;
      const v = c.sinTrim ? crudo : crudo.trim();
      body[c.clave] = v;
      const msg = c.validar(v);
      errores[c.clave].textContent = msg || "";
      if (msg) {
        entradas[c.clave].setAttribute("aria-invalid", "true");
        primero = primero || entradas[c.clave];
      }
    });
    if (primero) {
      primero.focus();
      return;
    }
    await conCarga(enviarBtn, async () => {
      aviso.textContent = "Guardando…";
      aviso.className = "aviso ancho cargando";
      const r = await enviar(body);
      if (!r.ok) {
        aviso.textContent = r.error;
        aviso.className = "aviso ancho error";
        return;
      }
      aviso.textContent = "";
      aviso.className = "aviso ancho";
      form.reset();
      CAMPOS_USUARIO.forEach((c) => {
        errores[c.clave].textContent = "";
        entradas[c.clave].removeAttribute("aria-invalid");
      });
      if (medidor) {
        medidor.dataset.fuerza = "0";
        medidor.lastElementChild.textContent =
          "Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.";
      }
      if (alExito) alExito(r, body);
    });
  });
  return form;
}

/* ---------- Aviso de conexión ---------- */
window.addEventListener("offline", () => toast("Sin conexión a internet. Algunas acciones fallarán.", "error"));
window.addEventListener("online", () => toast("Conexión restablecida.", "ok"));
