"use strict";
/* Panel de administración.
   Horarios: RF-06/07 (consultar), RF-11 (editar), RF-12 (eliminar).
   Usuarios: crear (RF-01, 04, 16), activar/desactivar (RF-18…21, 23, 24), eliminar (RF-13, 14, 25). */

document.addEventListener("DOMContentLoaded", () => {
  const u = iniciarPanel("admin", "Administración");
  if (!u) return;
  const miId = Sesion.id(u);

  /* La API no tiene endpoints para listar usuarios. Para no depender de memorizar IDs,
     se recuerdan en este navegador los usuarios creados o descubiertos por sus horarios. */
  const Registro = {
    clave: "registroUsuariosPeluqueria",
    leer() {
      try {
        const d = JSON.parse(localStorage.getItem(this.clave)) || {};
        return { trabajador: d.trabajador || [], cliente: d.cliente || [], admin: d.admin || [] };
      } catch {
        return { trabajador: [], cliente: [], admin: [] };
      }
    },
    guardar(d) {
      try {
        localStorage.setItem(this.clave, JSON.stringify(d));
      } catch {}
    },
    lista(tipo) {
      return this.leer()[tipo].sort((a, b) => a.id - b.id);
    },
    poner(tipo, reg) {
      const d = this.leer();
      const i = d[tipo].findIndex((x) => x.id === reg.id);
      if (i >= 0) d[tipo][i] = { ...d[tipo][i], ...reg };
      else d[tipo].push(reg);
      this.guardar(d);
    },
    quitar(tipo, id) {
      const d = this.leer();
      d[tipo] = d[tipo].filter((x) => x.id !== id);
      this.guardar(d);
    },
  };
  Registro.poner("admin", { id: miId, nombre: u.nombres, correo: u.correo, estado: "Activo" });

  const TIPOS = {
    trabajador: {
      titulo: "Trabajadores",
      singular: "trabajador",
      crear: "/seguridad/creartrabajador",
      activar: (id) => `/seguridad/activartrabajador/${id}`,
      desactivar: (id) => `/seguridad/desactivartrabajador/${id}`,
      eliminar: (id) => `/seguridad/trabajadores/${id}`,
    },
    cliente: {
      titulo: "Clientes",
      singular: "cliente",
      crear: "/seguridad/crearcliente",
      activar: (id) => `/seguridad/activarcliente/${id}`,
      desactivar: (id) => `/seguridad/desactivarcliente/${id}`,
      eliminar: (id) => `/seguridad/clientes/${id}`,
    },
    admin: {
      titulo: "Administradores",
      singular: "administrador",
      crear: "/seguridad/crearadmin",
      activar: (id) => `/seguridad/activaradmin/${id}`,
      desactivar: (id) => `/seguridad/desactivaradmin/${id}`,
      eliminar: (id) => `/seguridad/admins/${id}`,
    },
  };
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  /* ================= Horarios ================= */
  function pintarHorarios(cont) {
    let todos = [];
    const conocidos = new Map(); // idTrabajador → nombre
    Registro.lista("trabajador").forEach((t) => conocidos.set(t.id, t.nombre));

    const selTrab = el("select", { id: "fTrab" });
    const fFecha = el("input", { type: "date", id: "fFecha" });
    const fEstado = el(
      "select",
      { id: "fEstado" },
      el("option", { value: "" }, "Todos"),
      el("option", { value: "activo" }, "Disponibles"),
      el("option", { value: "inactivo" }, "No disponibles"),
    );
    const btnAct = el("button", { type: "button", class: "btn sec" }, "Actualizar");
    const resumen = el("p", { class: "resumen", "aria-live": "polite" });
    const lista = el("div", { id: "listaHorarios" });
    cont.append(
      el(
        "div",
        "herramientas",
        el("div", "campo", el("label", { for: "fTrab" }, "Trabajador"), selTrab),
        el("div", "campo", el("label", { for: "fFecha" }, "Fecha"), fFecha),
        el("div", "campo", el("label", { for: "fEstado" }, "Estado"), fEstado),
        btnAct,
      ),
      resumen,
      lista,
    );

    function llenarSelect(seleccionado) {
      selTrab.replaceChildren(
        el("option", { value: "" }, "Todos los trabajadores"),
        ...[...conocidos]
          .sort((a, b) => a[0] - b[0])
          .map(([id, n]) => el("option", { value: id }, `${n || "Trabajador"} (ID ${id})`)),
      );
      selTrab.value = conocidos.has(Number(seleccionado)) ? String(seleccionado) : "";
    }

    let version = 0;
    async function cargar(forzar = false) {
      const miVersion = ++version;
      resumen.textContent = "";
      lista.setAttribute("aria-busy", "true");
      lista.replaceChildren(esqueletoFilas(4));
      const sel = selTrab.value;
      try {
        // RF-07 si hay un trabajador elegido; si no, todos (RF-06 con respaldo por RF-07)
        todos = sel ? await Horarios.deTrabajador(sel) : await Horarios.todos({ forzar });
      } catch (e) {
        if (miVersion !== version) return;
        lista.removeAttribute("aria-busy");
        lista.replaceChildren(estadoError(e.message || "No se pudieron cargar los horarios.", () => cargar(true)));
        return;
      }
      if (miVersion !== version) return;
      const admins = new Set(Registro.lista("admin").map((a) => a.id));
      todos.forEach((h) => {
        if (!h.idTrabajador) return;
        conocidos.set(h.idTrabajador, h.trabajador || conocidos.get(h.idTrabajador));
        if (!admins.has(h.idTrabajador)) Registro.poner("trabajador", { id: h.idTrabajador, nombre: h.trabajador });
      });
      llenarSelect(sel);
      lista.removeAttribute("aria-busy");
      pintar();
    }

    function pintar() {
      let l = todos;
      if (fFecha.value) l = l.filter((h) => h.fecha === fFecha.value);
      if (fEstado.value) l = l.filter((h) => h.estado.toLowerCase() === fEstado.value);
      const libres = l.filter(Horarios.disponible).length;
      resumen.textContent = l.length
        ? [
            `${numero(l.length)} ${plural(l.length, "horario", "horarios")}`,
            `${numero(libres)} ${plural(libres, "disponible", "disponibles")}`,
            `${numero(l.length - libres)} ${plural(l.length - libres, "no disponible", "no disponibles")}`,
          ].join(" · ")
        : "";
      pintarAgenda(lista, l, {
        tituloVacio: todos.length ? "Sin resultados" : "Aún no hay horarios",
        iconoVacio: "calendario",
        vacio: todos.length
          ? "No hay horarios que coincidan con el trabajador, la fecha o el estado elegido."
          : "Cuando se registren horarios, aparecerán aquí agrupados por día.",
        trabajador: true,
        acciones: (h) => {
          const descripcion = `el horario de ${h.trabajador || "este trabajador"}, del ${formatoDia(h.fecha)}, de ${formatoHora(h.horaInicio)} a ${formatoHora(h.horaFinal)}`;
          const ed = el("button", { type: "button", class: "btn sec pequeno" }, "Editar");
          const borrar = el("button", { type: "button", class: "btn peligro pequeno" }, "Eliminar");
          ed.setAttribute("aria-label", `Editar ${descripcion}`);
          borrar.setAttribute("aria-label", `Eliminar ${descripcion}`);
          ed.addEventListener("click", () =>
            formularioHorario(h, {
              admin: true,
              guardar: (c) => api(`/seguridad/horarios/${h.id}`, { method: "PUT", body: c }),
              alExito: () => {
                Horarios.invalidar();
                cargar(true);
              },
            }),
          );
          borrar.addEventListener("click", async () => {
            const ok = await confirmar(
              "Eliminar horario",
              `¿Eliminar el horario de ${h.trabajador || "este trabajador"} del ${formatoDia(h.fecha)}, ${formatoHora(h.horaInicio)} a ${formatoHora(h.horaFinal)}?`,
              { boton: "Eliminar", peligro: true },
            );
            if (!ok) return;
            await conCarga(borrar, async () => {
              const r = await api(`/seguridad/horarios/${h.id}`, { method: "DELETE" });
              if (!r.ok) return toast(r.error, "error");
              Horarios.invalidar();
              toast(r.datos.mensaje || "Horario eliminado correctamente.");
              cargar(true);
            });
          });
          return [ed, borrar];
        },
      });
    }

    selTrab.addEventListener("change", () => cargar());
    [fFecha, fEstado].forEach((c) => c.addEventListener("change", pintar));
    btnAct.addEventListener("click", () => cargar(true));
    llenarSelect("");
    cargar();
  }

  /* ================= Trabajadores, clientes y administradores ================= */
  function pintarUsuarios(tipo) {
    return (cont) => {
      const cfg = TIPOS[tipo];
      const tabla = el("div", "tabla-caja");
      const resumen = el("p", { class: "resumen", "aria-live": "polite" });
      const conteo = el("span", "conteo-dia", "0");
      const buscar = el("input", {
        type: "search",
        id: "buscar-" + tipo,
        placeholder: "Nombre, correo o ID",
        autocomplete: "off",
        spellcheck: "false",
        enterkeyhint: "search",
        "aria-label": `Buscar ${cfg.titulo.toLowerCase()} conocidos`,
      });
      const cabecera = el(
        "div",
        "tarjeta-cab",
        el("h2", null, `${cfg.titulo} conocidos`, conteo),
        el(
          "div",
          "campo campo-buscar",
          el("label", { class: "sr-only", for: buscar.id }, `Buscar ${cfg.singular}`),
          buscar,
        ),
      );
      let filtro = "";

      async function accion(id, que, boton) {
        if (!Number.isInteger(id) || id < 1)
          return toast("Escribe un ID válido (número entero positivo).", "error");
        if (tipo === "admin" && id === miId && que !== "activar")
          return toast(
            `No puedes ${que === "eliminar" ? "eliminar" : "desactivar"} tu propia cuenta.`,
            "error",
          );
        if (que === "eliminar") {
          const ok = await confirmar(
            `Eliminar ${cfg.singular}`,
            `¿Eliminar definitivamente al ${cfg.singular} con ID ${id}? Esta acción no se puede deshacer.`,
            { boton: "Eliminar", peligro: true },
          );
          if (!ok) return;
        }
        await conCarga(boton, async () => {
          const r = await api(cfg[que](id), { method: que === "eliminar" ? "DELETE" : "PUT" });
          if (!r.ok) return toast(r.error, "error");
          toast(r.datos.mensaje || "Operación realizada correctamente.");
          if (que === "eliminar") Registro.quitar(tipo, id);
          else Registro.poner(tipo, { id, estado: que === "activar" ? "Activo" : "Inactivo" });
          dibujar();
        });
      }

      /* Crear */
      const formCrear = formularioUsuario({
        boton: `Crear ${cfg.singular}`,
        enviar: (body) => api(cfg.crear, { method: "POST", body }),
        alExito: (r, body) => {
          Registro.poner(tipo, { id: r.datos.id, nombre: body.t3, correo: body.t6, estado: "Activo" });
          toast(`${mayus(cfg.singular)} creado con el ID ${r.datos.id}.`);
          filtro = "";
          buscar.value = "";
          dibujar();
        },
      });

      /* Gestionar por ID */
      const entradaId = el("input", {
        type: "number",
        min: "1",
        id: "idGestion-" + tipo,
        inputmode: "numeric",
        placeholder: "Ej. 3",
        autocomplete: "off",
        spellcheck: "false",
        enterkeyhint: "done",
      });
      const botones = [
        ["activar", "Activar", "btn sec"],
        ["desactivar", "Desactivar", "btn sec"],
        ["eliminar", "Eliminar", "btn peligro"],
      ].map(([que, texto, clase]) => {
        const b = el("button", { type: "button", class: clase }, texto);
        b.addEventListener("click", () => accion(Number(entradaId.value), que, b));
        return b;
      });

      const gestion = el(
        "form",
        { novalidate: true },
        el("p", "ayuda", `Activa, desactiva o elimina un ${cfg.singular} escribiendo su número de ID.`),
        el("div", "campo", el("label", { for: entradaId.id }, `ID del ${cfg.singular}`), entradaId),
        el("div", "acciones-fila", botones),
      );
      gestion.addEventListener("submit", (e) => e.preventDefault());

      cont.append(
        el(
          "div",
          "rejilla-2",
          el("section", "tarjeta", el("h2", null, `Crear ${cfg.singular}`), formCrear),
          el("section", "tarjeta", el("h2", null, "Gestionar por ID"), gestion),
        ),
        el("section", "tarjeta", cabecera, resumen, tabla),
      );

      buscar.addEventListener("input", () => {
        filtro = buscar.value.trim().toLowerCase();
        dibujar();
      });

      function coincide(r) {
        if (!filtro) return true;
        return [r.id, r.nombre, r.correo, r.estado]
          .filter((v) => v != null)
          .some((v) => String(v).toLowerCase().includes(filtro));
      }

      function dibujar() {
        const regs = Registro.lista(tipo);
        const visibles = regs.filter(coincide);

        conteo.textContent = numero(regs.length);
        conteo.setAttribute(
          "aria-label",
          `${regs.length} ${plural(regs.length, cfg.singular, cfg.titulo.toLowerCase())}`,
        );
        resumen.textContent = regs.length
          ? filtro
            ? `${numero(visibles.length)} de ${numero(regs.length)} ${plural(regs.length, cfg.singular, cfg.titulo.toLowerCase())}`
            : `${numero(regs.length)} ${plural(regs.length, cfg.singular, cfg.titulo.toLowerCase())}`
          : "";

        if (!regs.length) {
          tabla.replaceChildren(
            estadoVacio(
              "equipo",
              `Aún no hay ${cfg.titulo.toLowerCase()}`,
              "Crea uno desde el formulario o añade su ID en «Gestionar por ID».",
            ),
          );
          return;
        }
        if (!visibles.length) {
          tabla.replaceChildren(
            estadoVacio(
              "buscar",
              "Sin coincidencias",
              `No hay ${cfg.titulo.toLowerCase()} que coincidan con «${buscar.value.trim()}». Prueba con otro nombre, correo o ID.`,
            ),
          );
          return;
        }

        const filas = visibles.map((r) => {
          const acc = el("div", "acciones-fila");
          [
            ["activar", "Activar", "btn sec pequeno", r.estado !== "Activo"],
            ["desactivar", "Desactivar", "btn sec pequeno", r.estado !== "Inactivo"],
            ["eliminar", "Eliminar", "btn peligro pequeno", true],
          ].forEach(([que, texto, clase, mostrar]) => {
            if (!mostrar) return;
            const b = el("button", { type: "button", class: clase }, texto);
            b.setAttribute(
              "aria-label",
              `${texto} al ${cfg.singular} ${r.id}${r.nombre ? ` (${r.nombre})` : ""}`,
            );
            b.addEventListener("click", () => accion(r.id, que, b));
            acc.append(b);
          });
          const est = r.estado
            ? el("span", "estado " + (r.estado === "Activo" ? "disponible" : "cancelado"), r.estado)
            : el("span", "estado", "sin consultar");
          const nombre = (r.nombre || "—") + (tipo === "admin" && r.id === miId ? " (tú)" : "");
          return el(
            "tr",
            null,
            el("td", { "data-label": "ID" }, String(r.id)),
            el("td", { "data-label": "Nombre" }, nombre),
            el("td", { "data-label": "Correo" }, r.correo || "—"),
            el("td", { "data-label": "Estado" }, est),
            el("td", { "data-label": "Acciones" }, acc),
          );
        });
        tabla.replaceChildren(
          el(
            "table",
            "tabla",
            el(
              "thead",
              null,
              el(
                "tr",
                null,
                ["ID", "Nombre", "Correo", "Estado", "Acciones"].map((t) =>
                  el("th", { scope: "col" }, t),
                ),
              ),
            ),
            el("tbody", null, filas),
          ),
        );
      }
      dibujar();
    };
  }

  pestanas(
    document.getElementById("pestanas"),
    document.getElementById("contenido"),
    [
      { id: "horarios", titulo: "Horarios", render: pintarHorarios },
      { id: "trabajadores", titulo: "Trabajadores", render: pintarUsuarios("trabajador") },
      { id: "clientes", titulo: "Clientes", render: pintarUsuarios("cliente") },
      { id: "admins", titulo: "Administradores", render: pintarUsuarios("admin") },
    ],
    location.hash.slice(1),
  );
});
