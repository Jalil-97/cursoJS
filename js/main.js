// =====================
// main.js - con IDs únicos y modal custom para eliminar
// Requisitos implementados:
// - ID único en cada movimiento
// - Modal custom para confirmar eliminación (no usamos window.confirm())
// - Promesas (.then/.catch/.finally) para I/O con localStorage
// - Arrow functions, funciones async donde corresponde
// - Edición, filtros, agrupado por mes
// - Eventos y comentarios redundantes (intencionalmente detallados)
// =====================

// =====================
// Referencias DOM (cacheadas)
// =====================
const form = document.getElementById("form-movimiento"); // formulario principal
const lista = document.getElementById("lista-movimientos"); // tbody
const saldoEl = document.getElementById("saldo"); // elemento saldo
const ingresosEl = document.getElementById("ingresos"); // elemento ingresos
const gastosEl = document.getElementById("gastos"); // elemento gastos

const categoriaSelect = document.getElementById("categoria"); // select categorias
const categoriaOtrosInput = document.getElementById("categoria-otros"); // input aclaracion "Otros"
const btnSubmit = document.getElementById("btn-submit"); // boton submit
const btnCancelEdit = document.getElementById("btn-cancel-edit"); // boton cancelar edicion
const formTitle = document.getElementById("form-title"); // titulo form

// filtros
const filtroTexto = document.getElementById("filtro-texto");
const filtroCategoria = document.getElementById("filtro-categoria");
const filtroDesde = document.getElementById("filtro-desde");
const filtroHasta = document.getElementById("filtro-hasta");
const btnAplicarFiltro = document.getElementById("btn-aplicar-filtro");
const btnLimpiarFiltro = document.getElementById("btn-limpiar-filtro");

// modal (custom)
const modal = document.getElementById("modal-confirm");
const modalText = document.getElementById("modal-text");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel");
const modalBackdrop = document.querySelector(".modal-backdrop");

// estado en memoria
let movimientos = []; // array de movimientos en memoria
let editIndex = null; // índice si estamos editando
let idAEliminar = null; // id del movimiento que está pendiente de eliminar (en modal)

// =====================
// UTIL: generar ID único seguro (timestamp + random) - arrow function
// =====================
const generarIdUnico = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// =====================
// UTIL: formato fecha (yyyy-mm-dd -> dd/mm/yyyy)
// =====================
const formatearFecha = fechaStr => {
  if (!fechaStr) return "";
  const d = new Date(fechaStr + "T00:00:00");
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();
  return `${dia}/${mes}/${anio}`;
};

// =====================
// UTIL: clave mes-anio para agrupar (YYYY-MM)
// =====================
const mesAnioKey = fechaStr => {
  const d = new Date(fechaStr + "T00:00:00");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();
  return `${anio}-${mes}`;
};

// =====================
// Wrappers con Promesas para localStorage
// - getMovimientos: Promise que resuelve array
// - saveMovimientos: Promise que guarda y resuelve true
// =====================
const getMovimientos = () =>
  new Promise((resolve, reject) => {
    try {
      const raw = localStorage.getItem("movimientos");
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) resolve([]);
      else resolve(parsed);
    } catch (err) {
      reject(err);
    }
  });

const saveMovimientos = movimientosAguardar =>
  new Promise((resolve, reject) => {
    try {
      localStorage.setItem("movimientos", JSON.stringify(movimientosAguardar));
      resolve(true);
    } catch (err) {
      reject(err);
    }
  });

// =====================
// actualizarTabla: async para poder usar await si se quisiera
// - aplica filtros desde inputs
// - agrupa por mes
// - renderiza filas con botones (editar/eliminar) que usan el id único
// =====================
const actualizarTabla = async (opciones = {}) => {
  // limpiar tbody
  lista.innerHTML = "";

  // usar movimientos en memoria
  let arr = [...movimientos];

  // leer filtros (si no vienen por opciones)
  const texto = opciones.texto ?? filtroTexto.value.trim().toLowerCase();
  const categoriaFiltro = opciones.categoria ?? filtroCategoria.value;
  const desde = opciones.desde ?? filtroDesde.value;
  const hasta = opciones.hasta ?? filtroHasta.value;

  // aplicar filtro por texto (categoria o aclaración)
  if (texto) {
    arr = arr.filter(
      m =>
        (m.categoria && m.categoria.toLowerCase().includes(texto)) ||
        (m.categoriaAclaracion &&
          m.categoriaAclaracion.toLowerCase().includes(texto))
    );
  }

  // aplicar filtro por categoria
  if (categoriaFiltro) {
    arr = arr.filter(m => m.categoria === categoriaFiltro);
  }

  // filtro por fechas
  if (desde) {
    arr = arr.filter(m => new Date(m.fecha) >= new Date(desde));
  }
  if (hasta) {
    arr = arr.filter(m => new Date(m.fecha) <= new Date(hasta));
  }

  // agrupar por mes (obj: key -> array)
  const grupos = arr.reduce((acc, mov) => {
    const key = mesAnioKey(mov.fecha);
    if (!acc[key]) acc[key] = [];
    acc[key].push(mov);
    return acc;
  }, {});

  const keysOrdenadas = Object.keys(grupos).sort((a, b) => (a < b ? 1 : -1)); // meses recientes arriba

  let ingresos = 0;
  let gastos = 0;

  if (keysOrdenadas.length === 0) {
    const fila = document.createElement("tr");
    fila.innerHTML = `<td colspan="4">No hay movimientos</td>`;
    lista.appendChild(fila);
  } else {
    keysOrdenadas.forEach(key => {
      const [anio, mes] = key.split("-");
      const nombreMes = new Date(`${anio}-${mes}-01`).toLocaleString("es-AR", {
        month: "long",
        year: "numeric",
      });

      const filaHeader = document.createElement("tr");
      const tdHeader = document.createElement("td");
      tdHeader.setAttribute("colspan", "4");
      tdHeader.classList.add("mes-header");
      tdHeader.textContent = nombreMes;
      filaHeader.appendChild(tdHeader);
      lista.appendChild(filaHeader);

      grupos[key]
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)) // orden dentro del mes
        .forEach(mov => {
          const montoFormateado = Math.abs(mov.monto).toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });

          const tr = document.createElement("tr");

          const tdFecha = document.createElement("td");
          tdFecha.textContent = formatearFecha(mov.fecha);

          const tdCategoria = document.createElement("td");
          tdCategoria.textContent = mov.categoriaAclaracion
            ? `${mov.categoria} (${mov.categoriaAclaracion})`
            : mov.categoria;

          const tdMonto = document.createElement("td");
          tdMonto.innerHTML =
            mov.monto < 0
              ? `<span class="gasto">-${montoFormateado}</span>`
              : `<span class="ingreso">+${montoFormateado}</span>`;

          const tdAcciones = document.createElement("td");

          // btn editar
          const btnEditar = document.createElement("button");
          btnEditar.textContent = "Editar";
          btnEditar.classList.add("btn-accion", "btn-editar");
          btnEditar.dataset.id = mov.id; // identificador único
          btnEditar.addEventListener("click", handleEditarMovimiento);

          // btn eliminar (abre modal)
          const btnEliminar = document.createElement("button");
          btnEliminar.textContent = "Eliminar";
          btnEliminar.classList.add("btn-accion", "btn-eliminar");
          btnEliminar.dataset.id = mov.id; // identificador único
          btnEliminar.addEventListener("click", abrirModalEliminar);

          tdAcciones.appendChild(btnEditar);
          tdAcciones.appendChild(btnEliminar);

          tr.appendChild(tdFecha);
          tr.appendChild(tdCategoria);
          tr.appendChild(tdMonto);
          tr.appendChild(tdAcciones);

          lista.appendChild(tr);

          // acumular totales
          if (mov.monto >= 0) ingresos += mov.monto;
          else gastos += Math.abs(mov.monto);
        });
    });
  }

  // actualizar tarjetas de totales
  const saldo = ingresos - gastos;
  saldoEl.textContent = `$${saldo.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  ingresosEl.textContent = `$${ingresos.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  gastosEl.textContent = `$${gastos.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// =====================
// inicializar: cargar desde localStorage (promesa) y renderizar
// =====================
const inicializar = () => {
  // uso then/catch/finally como pediste
  getMovimientos()
    .then(data => {
      movimientos = Array.isArray(data) ? data : [];
    })
    .catch(err => {
      console.error("Error al leer movimientos:", err);
      movimientos = [];
    })
    .finally(() => {
      actualizarTabla();
    });
};

// =====================
// handleSubmit: agregar nuevo movimiento o guardar edición
// - async para poder usar await si se quisiera
// =====================
const handleSubmit = async e => {
  e.preventDefault();

  const fecha = document.getElementById("fecha").value;
  const categoria = categoriaSelect.value;
  const categoriaAclaracion =
    categoria === "Otros" ? categoriaOtrosInput.value.trim() : "";
  const monto = Number(document.getElementById("monto").value);

  if (!fecha || !categoria || isNaN(monto)) {
    alert("Por favor completá todos los campos correctamente");
    return;
  }

  if (editIndex === null) {
    // crear movimiento con ID único
    const mov = {
      id: generarIdUnico(), // <-- ID único generado aquí
      fecha,
      categoria,
      categoriaAclaracion,
      monto,
    };

    movimientos.push(mov);

    saveMovimientos(movimientos)
      .then(() => {
        form.reset();
        categoriaOtrosInput.style.display = "none";
      })
      .catch(err => {
        console.error("Error guardando movimiento:", err);
        alert("No se pudo guardar el movimiento");
      })
      .finally(() => {
        actualizarTabla();
      });
  } else {
    // editar movimiento existente - conservar su id
    const movExistente = movimientos[editIndex];
    if (!movExistente) {
      alert("Movimiento no encontrado para editar");
      return;
    }

    const mov = {
      id: movExistente.id, // mantener el mismo ID al editar
      fecha,
      categoria,
      categoriaAclaracion,
      monto,
    };

    movimientos[editIndex] = mov;

    saveMovimientos(movimientos)
      .then(() => {
        // reset UI edición
        editIndex = null;
        btnSubmit.textContent = "Agregar";
        btnCancelEdit.style.display = "none";
        formTitle.textContent = "Agregar Movimiento";
        form.reset();
        categoriaOtrosInput.style.display = "none";
      })
      .catch(err => {
        console.error("Error guardando edición:", err);
        alert("No se pudo guardar la edición");
      })
      .finally(() => {
        actualizarTabla();
      });
  }
};

// =====================
// handleEditarMovimiento: carga datos en el formulario para editar
// - usa dataset.id para localizar el movimiento por ID
// - arrow function
// =====================
const handleEditarMovimiento = e => {
  const id = e.currentTarget.dataset.id;
  if (!id) {
    alert("ID no encontrado para editar");
    return;
  }

  // localizar por id (robusto contra colisiones)
  const idx = movimientos.findIndex(m => m.id === id);
  if (idx === -1) {
    alert("Movimiento no encontrado para editar");
    return;
  }

  const mov = movimientos[idx];
  document.getElementById("fecha").value = mov.fecha;
  categoriaSelect.value = mov.categoria || "";
  if (mov.categoria === "Otros") {
    categoriaOtrosInput.style.display = "block";
    categoriaOtrosInput.value = mov.categoriaAclaracion || "";
  } else {
    categoriaOtrosInput.style.display = "none";
    categoriaOtrosInput.value = "";
  }
  document.getElementById("monto").value = mov.monto;

  // cambiar estado a edición
  editIndex = idx;
  btnSubmit.textContent = "Guardar cambios";
  btnCancelEdit.style.display = "inline-block";
  formTitle.textContent = "Editar Movimiento";
};

// =====================
// handleCancelarEdicion: cancelar edición
// =====================
const handleCancelarEdicion = () => {
  editIndex = null;
  form.reset();
  btnSubmit.textContent = "Agregar";
  btnCancelEdit.style.display = "none";
  formTitle.textContent = "Agregar Movimiento";
  categoriaOtrosInput.style.display = "none";
};

// =====================
// Modal: abrir modal para confirmar eliminación
// - setea idAEliminar y muestra texto dinámico
// - arrow function
// =====================
const abrirModalEliminar = e => {
  const id = e.currentTarget.dataset.id;
  if (!id) {
    alert("ID no encontrado para eliminar");
    return;
  }

  const mov = movimientos.find(m => m.id === id);
  if (!mov) {
    alert("Movimiento no encontrado para eliminar");
    return;
  }

  // setear id a eliminar (estado temporal)
  idAEliminar = id;

  // texto dinámico informando fecha/categoría/monto
  const montoFormateado = Math.abs(mov.monto).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  modalText.textContent = `¿Estás seguro que querés eliminar el movimiento del ${formatearFecha(
    mov.fecha
  )} (${mov.categoria}) por $${montoFormateado}?`;

  // mostrar modal (aria-hidden false para accesibilidad)
  modal.setAttribute("aria-hidden", "false");
};

// =====================
// Cerrar modal (sin acción)
// - limpia estado idAEliminar
// =====================
const cerrarModal = () => {
  idAEliminar = null;
  modal.setAttribute("aria-hidden", "true");
};

// =====================
// Confirmar eliminación (ejecuta la eliminación)
// - usa Promesa saveMovimientos con then/catch/finally
// =====================
const confirmarEliminar = () => {
  if (!idAEliminar) {
    cerrarModal();
    return;
  }

  // encontrar índice por id (robusto)
  const idx = movimientos.findIndex(m => m.id === idAEliminar);
  if (idx === -1) {
    alert("Movimiento no encontrado para eliminar");
    cerrarModal();
    return;
  }

  // eliminar del array
  movimientos.splice(idx, 1);

  // guardar cambios (promesa)
  saveMovimientos(movimientos)
    .then(() => {
      // opcional: notificar éxito
    })
    .catch(err => {
      console.error("Error al eliminar:", err);
      alert("No se pudo eliminar (error al guardar)");
    })
    .finally(() => {
      cerrarModal();
      actualizarTabla();
    });
};

// =====================
// Mostrar/ocultar campo "Otros" segun select
// =====================
const handleCategoriaChange = e => {
  const val = e.target.value;
  if (val === "Otros") {
    categoriaOtrosInput.style.display = "block";
    categoriaOtrosInput.required = true;
  } else {
    categoriaOtrosInput.style.display = "none";
    categoriaOtrosInput.required = false;
    categoriaOtrosInput.value = "";
  }
};

// =====================
// FILTROS: aplicar y limpiar
// =====================
const handleAplicarFiltro = e => {
  e.preventDefault();
  actualizarTabla();
};

const handleLimpiarFiltro = e => {
  e.preventDefault();
  filtroTexto.value = "";
  filtroCategoria.value = "";
  filtroDesde.value = "";
  filtroHasta.value = "";
  actualizarTabla();
};

// =====================
// Eventos: listeners
// - Todos los listeners son arrow functions o referencian arrow functions
// =====================
form.addEventListener("submit", handleSubmit);
categoriaSelect.addEventListener("change", handleCategoriaChange);
btnCancelEdit.addEventListener("click", handleCancelarEdicion);
btnAplicarFiltro.addEventListener("click", handleAplicarFiltro);
btnLimpiarFiltro.addEventListener("click", handleLimpiarFiltro);

// búsqueda en tiempo real (input)
filtroTexto.addEventListener("input", () => {
  actualizarTabla();
});

// modal: confirmar / cancelar
modalConfirmBtn.addEventListener("click", confirmarEliminar);
modalCancelBtn.addEventListener("click", cerrarModal);

// cerrar modal al clickear backdrop (fondo)
modalBackdrop.addEventListener("click", cerrarModal);

// cerrar modal con ESC (accesibilidad)
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
    cerrarModal();
  }
});

// =====================
// Inicializar app
// =====================
inicializar();

