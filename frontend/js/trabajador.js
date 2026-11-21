"use strict";
/* Panel del trabajador: ver su agenda (RF-08.1, 08.2, 08.3),
   editar (RF-09) y eliminar (RF-10) sus horarios. */

document.addEventListener("DOMContentLoaded", () => {
  const u = iniciarPanel("trabajador", "Equipo");
  if (!u) return;
  const idTrabajador = Sesion.id(u);
  const cont = document.getElementById("contenido");

  const fFecha = el("input", { type: "date", id: "fFecha" });
  const fEstado = el(
    "select",
    { id: "fEstado" },
    el("option", { value: "" }, "Todos"),
    el("option", { value: "A" }, "Disponibles"),
    el("option", { value: "I" }, "No disponibles"),
  );
  const btnFiltrar = el("button", { type: "submit", class: "btn" }, "Filtrar");
  const btnTodos = el("button", { type: "button", class: "btn sec" }, "Ver todos");
  const resumen = el("p", { class: "resumen", "aria-live": "polite" });
  const lista = el("div", { id: "listaHorarios" });

  const barra = el(
    "form",
    { class: "herramientas", novalidate: true },
    el("div", "campo", el("label", { for: "fFecha" }, "Fecha"), fFecha),
    el("div", "campo", el("label", { for: "fEstado" }, "Estado"), fEstado),
    btnFiltrar,
    btnTodos,
  );
  cont.append(barra, resumen, lista);

  let version = 0; // descarta respuestas viejas si se filtra varias veces seguidas

  async function cargar() {
    const miVersion = ++version;
    resumen.textContent = "";
    lista.setAttribute("aria-busy", "true");
    lista.replaceChildren(esqueletoFilas(4));

    const fecha = fFecha.value;
    const est = fEstado.value;

    // RF-07: sirve para conocer el idhorario de cada fila (los endpoints RF-08 no lo traen)
    const idsPromesa = Horarios.deTrabajador(idTrabajador).catch(() => []);

    try {
      // RF-08.2 (por fecha) o RF-08.1 (todos)
      const r = fecha
        ? await api(`/trabajador/horariod/${idTrabajador}&${encodeURIComponent(fecha)}`)
        : await api(`/trabajador/horariot/${idTrabajador}`);
      if (miVersion !== version) return;
      if (!r.ok) {
        lista.removeAttribute("aria-busy");
        lista.replaceChildren(estadoError(r.error, cargar));
        return;
      }

      let filas = Horarios.lista(r.datos);

      // RF-08.3 (fecha + estado). Si el servidor no devuelve datos, se filtra en pantalla.
      if (fecha && est) {
        const r3 = await api(`/trabajador/horarioe/${idTrabajador}&${encodeURIComponent(fecha)}&${est}`);
        const l3 = r3.ok ? Horarios.lista(r3.datos) : [];
        if (l3.length) filas = l3;
      }
      if (miVersion !== version) return;
      if (est) filas = filas.filter((h) => (est === "A" ? Horarios.disponible(h) : !Horarios.disponible(h)));

      const conIds = new Map((await idsPromesa).map((h) => [Horarios.clave(h), h]));
      if (miVersion !== version) return;
      filas = filas.map((h) => ({ ...h, idTrabajador, id: conIds.get(Horarios.clave(h))?.id ?? null }));

      const libres = filas.filter(Horarios.disponible).length;
      const noDisponibles = filas.length - libres;
      resumen.textContent = filas.length
        ? [
            `${numero(filas.length)} ${plural(filas.length, "horario", "horarios")}`,
            `${numero(libres)} ${plural(libres, "disponible", "disponibles")}`,
            `${numero(noDisponibles)} ${plural(noDisponibles, "no disponible", "no disponibles")}`,
          ].join(" · ")
        : "";

      lista.removeAttribute("aria-busy");
      pintarAgenda(lista, filas, {
        tituloVacio: fecha || est ? "Sin resultados" : "Aún no tienes horarios",
        iconoVacio: "calendario",
        vacio: fecha || est
          ? "No hay horarios que coincidan con la fecha o el estado elegido. Prueba a quitar los filtros."
          : "Cuando la administración te asigne turnos, aparecerán aquí.",
        trabajador: false,
        acciones: (h) => {
          const descripcion = `el horario del ${formatoDia(h.fecha)}, de ${formatoHora(h.horaInicio)} a ${formatoHora(h.horaFinal)}`;
          const ed = el("button", { type: "button", class: "btn sec pequeno" }, "Editar");
          const borrar = el("button", { type: "button", class: "btn peligro pequeno" }, "Eliminar");
          ed.setAttribute("aria-label", `Editar ${descripcion}`);
          borrar.setAttribute("aria-label", `Eliminar ${descripcion}`);
          if (!h.id) {
            [ed, borrar].forEach((b) => {
              b.disabled = true;
              b.title = "No se pudo identificar este horario. Pulsa «Ver todos» para recargar.";
            });
            ed.setAttribute("aria-label", "Editar no disponible: no se pudo identificar el horario");
            borrar.setAttribute("aria-label", "Eliminar no disponible: no se pudo identificar el horario");
          }
          ed.addEventListener("click", () => editar(h));
          borrar.addEventListener("click", () => eliminar(h, borrar));
          return [ed, borrar];
        },
      });
    } catch (e) {
      if (miVersion !== version) return;
      lista.removeAttribute("aria-busy");
      lista.replaceChildren(estadoError(e.message || "No se pudieron cargar los horarios.", cargar));
    }
  }

  function editar(h) {
    formularioHorario(h, {
      guardar: (c) =>
        api(`/trabajador/horarios/${h.id}`, { method: "PUT", body: { idtrabajador: idTrabajador, ...c } }),
      alExito: () => {
        Horarios.invalidar();
        cargar();
      },
    });
  }

  async function eliminar(h, boton) {
    const ok = await confirmar(
      "Eliminar horario",
      `¿Eliminar el horario del ${formatoDia(h.fecha)}, de ${formatoHora(h.horaInicio)} a ${formatoHora(h.horaFinal)}?`,
      { boton: "Eliminar", peligro: true },
    );
    if (!ok) return;
    await conCarga(boton, async () => {
      const r = await api(`/trabajador/horarios/${h.id}?idtrabajador=${idTrabajador}`, { method: "DELETE" });
      if (!r.ok) return toast(r.error, "error");
      Horarios.invalidar();
      toast(r.datos.mensaje || "Horario eliminado correctamente.");
      cargar();
    });
  }

  barra.addEventListener("submit", (e) => {
    e.preventDefault();
    cargar();
  });
  btnTodos.addEventListener("click", () => {
    fFecha.value = "";
    fEstado.value = "";
    cargar();
  });
  cargar();
});
