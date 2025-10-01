
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

// Elementos del DOM
const form = document.getElementById("form-movimiento");
const btnCancelEdit = document.getElementById("btn-cancel-edit");
const lista = document.getElementById("lista-movimientos"); // tbody
const saldoEl = document.getElementById("saldo") || document.getElementById("total-saldo");
const ingresosEl = document.getElementById("ingresos") || document.getElementById("total-ingresos");
const gastosEl = document.getElementById("gastos") || document.getElementById("total-gastos");
const btnExportExcel = document.getElementById("btn-export-excel") || document.getElementById("export-excel");
const btnExportPdf = document.getElementById("btn-export-pdf") || document.getElementById("export-pdf");
const modal = document.getElementById("modal-confirm");
const modalConfirmBtn = document.getElementById("modal-confirm-btn");
const modalCancelBtn = document.getElementById("modal-cancel");

// Form fields 
const fechaInput = document.getElementById("fecha");
const tipoInput = document.getElementById("tipo"); // ingreso / gasto
const categoriaInput = document.getElementById("categoria");
const categoriaOtrosInput = document.getElementById("categoria-otros");
const montoInput = document.getElementById("monto");
const descripcionInput = document.getElementById("descripcion"); // opcional

// Estado
let movimientos = []; // array de objetos { fecha, tipo, categoria, monto, descripcion? }
let editIndex = null; // índice en edición
let idAEliminar = null; // índice pendiente de eliminación (para modal)

/* ---------------------------
   Funciones utilitarias
----------------------------*/
const formatMoney = n =>
  `$${Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const tryFetch = async paths => {
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) return res;
    } catch (e) {
     
    }
  }
  throw new Error("No se pudo cargar data.json desde ninguna ruta probada");
};

/* ---------------------------
   Carga inicial: data.json -> localStorage
----------------------------*/
const cargarDatosIniciales = async () => {
  try {
    const res = await tryFetch(["/cursoJS/data/data.json", "../data/data.json", "/data/data.json", "../data.json"]);
    const data = await res.json();

    if (!localStorage.getItem("movimientos")) {
      movimientos = data;
      localStorage.setItem("movimientos", JSON.stringify(movimientos));
    } else {
      movimientos = JSON.parse(localStorage.getItem("movimientos"));
    }
  } catch (err) {
    console.error("Carga inicial fallida (data.json):", err);
    movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  } finally {
    // siempre refrescamos la UI
    actualizarTabla();
    actualizarTotales();
    inicializarGraficos(); // si estamos en graficos.html, generamos gráficos correctamente
  }
};

/* ---------------------------
   Guardar localmente (promesa)
----------------------------*/
const guardarLocal = () =>
  new Promise((resolve, reject) => {
    try {
      localStorage.setItem("movimientos", JSON.stringify(movimientos));
      resolve();
    } catch (err) {
      reject(err);
    }
  });

/* ---------------------------
   Renderizar tabla
----------------------------*/
const actualizarTabla = () => {
  if (!lista) return; 

  lista.innerHTML = ""; // limpio

  movimientos.forEach((mov, idx) => {
    // categoría puede incluir aclaración si existe
    const categoriaTexto = mov.categoria + (mov.categoriaAclaracion ? ` (${mov.categoriaAclaracion})` : "");
    const montoForm = mov.monto < 0
      ? `<span class="gasto">-${formatMoney(mov.monto)}</span>`
      : `<span class="ingreso">+${formatMoney(mov.monto)}</span>`;

    // Fila, columna 'descripcion' no asumo en tabla; si existió la puse como pequeño debajo de categoría
    const descripcionHtml = mov.descripcion ? `<div class="small muted">${mov.descripcion}</div>` : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${mov.fecha}</td>
      <td>${(mov.tipo || "").toString()}</td>
      <td>${categoriaTexto}${descripcionHtml}</td>
      <td>${montoForm}</td>
      <td>
        <button class="btn btn-secondary editar" data-index="${idx}">Editar</button>
        <button class="btn btn-danger eliminar" data-index="${idx}">Eliminar</button>
      </td>
    `;
    lista.appendChild(tr);
  });


};

/* ---------------------------
   Actualizar totales
----------------------------*/
const actualizarTotales = () => {
  if (!saldoEl && !ingresosEl && !gastosEl) return;

  const ingresos = movimientos
    .filter(m => String(m.tipo).toLowerCase() === "ingreso")
    .reduce((acc, m) => acc + Number(m.monto), 0);

  const gastos = movimientos
    .filter(m => String(m.tipo).toLowerCase() === "gasto")
    .reduce((acc, m) => acc + Math.abs(Number(m.monto)), 0);

  const saldo = ingresos - gastos;

  if (ingresosEl) ingresosEl.textContent = formatMoney(ingresos);
  if (gastosEl) gastosEl.textContent = formatMoney(gastos);
  if (saldoEl) saldoEl.textContent = formatMoney(saldo);
};

/* ---------------------------
   Agregar / Editar (submit del form)
----------------------------*/
if (form) {
  form.addEventListener("submit", async e => {
    e.preventDefault();

   
    const fecha = fechaInput ? fechaInput.value : "";
    const tipo = tipoInput ? tipoInput.value : (typeof movDefaultTipo !== "undefined" ? movDefaultTipo : "Ingreso");
    const categoria = categoriaInput ? categoriaInput.value : "Otros";
    const categoriaAclaracion = categoriaOtrosInput ? categoriaOtrosInput.value.trim() : "";
    const montoRaw = montoInput ? parseFloat(montoInput.value) : 0;
    const descripcion = descripcionInput ? descripcionInput.value.trim() : "";

    if (!fecha || !tipo || !categoria || isNaN(montoRaw)) {
      alert("Por favor completá todos los campos correctamente.");
      return;
    }

    // Ajustar signo según tipo (acepta "Gasto"/"gasto"/"gasto ")
    let monto = Number(montoRaw);
    if (String(tipo).toLowerCase() === "gasto" && monto > 0) monto = -Math.abs(monto);
    if (String(tipo).toLowerCase() === "ingreso") monto = Math.abs(monto);

    const nuevo = {
      fecha,
      tipo,
      categoria,
      categoriaAclaracion: categoriaAclaracion || undefined,
      monto,
      descripcion: descripcion || undefined
    };

    if (editIndex !== null) {
      // editar existente
      movimientos[editIndex] = nuevo;
      editIndex = null;
      if (btnCancelEdit) btnCancelEdit.style.display = "none";
      const submitBtn = document.getElementById("btn-submit");
      if (submitBtn) submitBtn.textContent = "Agregar";
    } else {
      // agregar nuevo
      movimientos.push(nuevo);
    }

    // guardar y actualizar UI
    await guardarLocal()
      .then(() => {
        actualizarTabla();
        actualizarTotales();
        form.reset();
        if (categoriaOtrosInput) categoriaOtrosInput.style.display = "none";
      })
      .catch(err => console.error("Error guardando:", err));
  });
}

/* ---------------------------
   Delegación de eventos en la tabla (Editar / Eliminar)
----------------------------*/
if (lista) {
  lista.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const idx = Number(btn.dataset.index);
    if (btn.classList.contains("editar")) {
      // rellenar form para editar
      const mov = movimientos[idx];
      if (!mov) return alert("Movimiento no encontrado para editar");

      if (fechaInput) fechaInput.value = mov.fecha;
      if (tipoInput) tipoInput.value = mov.tipo || "Ingreso";
      if (categoriaInput) categoriaInput.value = mov.categoria || "";
      if (categoriaOtrosInput) {
        if (mov.categoriaAclaracion) {
          categoriaOtrosInput.style.display = "block";
          categoriaOtrosInput.value = mov.categoriaAclaracion;
        } else {
          categoriaOtrosInput.style.display = "none";
          categoriaOtrosInput.value = "";
        }
      }
      if (montoInput) montoInput.value = Math.abs(mov.monto);
      if (descripcionInput) descripcionInput.value = mov.descripcion || "";

      editIndex = idx;
      if (btnCancelEdit) btnCancelEdit.style.display = "inline-block";
      const submitBtn = document.getElementById("btn-submit");
      if (submitBtn) submitBtn.textContent = "Guardar cambios";
      return;
    }

    if (btn.classList.contains("eliminar")) {
      if (modal && modalConfirmBtn && modalCancelBtn) {
        idAEliminar = idx;
        modal.setAttribute("aria-hidden", "false");
        modal.style.display = "flex";
      } else {
        if (confirm("¿Seguro que querés eliminar este movimiento?")) {
          movimientos.splice(idx, 1);
          guardarLocal()
            .then(() => {
              actualizarTabla();
              actualizarTotales();
            })
            .catch(err => console.error(err));
        }
      }
      return;
    }
  });
}

/* ---------------------------
   Modal: Confirmar eliminación (si existe modal custom)
----------------------------*/
if (modal && modalConfirmBtn && modalCancelBtn) {
  modalConfirmBtn.addEventListener("click", async () => {
    if (typeof idAEliminar === "number") {
      movimientos.splice(idAEliminar, 1);
      idAEliminar = null;
      await guardarLocal()
        .then(() => {
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
          actualizarTabla();
          actualizarTotales();
        })
        .catch(err => console.error("Error eliminando:", err));
    } else {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }
  });

  modalCancelBtn.addEventListener("click", () => {
    idAEliminar = null;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  });

  const backdrop = modal.querySelector(".modal-backdrop");
  if (backdrop) backdrop.addEventListener("click", () => {
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    idAEliminar = null;
  });
}

/* ---------------------------
   Botón cancelar edición (si existe)
----------------------------*/
if (btnCancelEdit) {
  btnCancelEdit.addEventListener("click", () => {
    editIndex = null;
    if (form) form.reset();
    btnCancelEdit.style.display = "none";
    const submitBtn = document.getElementById("btn-submit");
    if (submitBtn) submitBtn.textContent = "Agregar";
    if (categoriaOtrosInput) categoriaOtrosInput.style.display = "none";
  });
}

/* ---------------------------
   Exportar Excel / PDF (IDs flexibles)
----------------------------*/
const exportToExcel = () => {
  if (typeof XLSX === "undefined") {
    return alert("SheetJS (XLSX) no está cargado.");
  }
  // Construyo una copia amigable para Excel
  const rows = movimientos.map(m => ({
    Fecha: m.fecha,
    Tipo: m.tipo,
    Categoria: m.categoria + (m.categoriaAclaracion ? ` (${m.categoriaAclaracion})` : ""),
    Descripcion: m.descripcion || "",
    Monto: m.monto
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Movimientos");

  // Totales en hoja separada
  const ingresos = movimientos.filter(m => String(m.tipo).toLowerCase() === "ingreso").reduce((a, c) => a + c.monto, 0);
  const gastos = movimientos.filter(m => String(m.tipo).toLowerCase() === "gasto").reduce((a, c) => a + Math.abs(c.monto), 0);
  const saldo = ingresos - gastos;
  const wsT = XLSX.utils.json_to_sheet([{ Saldo: saldo }, { Ingresos: ingresos }, { Gastos: gastos }]);
  XLSX.utils.book_append_sheet(wb, wsT, "Totales");

  XLSX.writeFile(wb, "mis-movimientos.xlsx");
};

const exportToPDF = () => {
  if (typeof jspdf === "undefined" && typeof window.jspdf === "undefined") {
    // try direct global
    if (typeof jsPDF === "undefined" && !(window && window.jspdf)) {
      return alert("jsPDF o autoTable no cargados.");
    }
  }
  // uso de la API de jsPDF (compatibilidad con loader)
  const { jsPDF } = window.jspdf || { jsPDF };
  const doc = new jsPDF();
  doc.text("Mis movimientos", 14, 15);

  // construyo tabla simple
  const head = [["Fecha", "Tipo", "Categoria", "Descripción", "Monto"]];
  const body = movimientos.map(m => [
    m.fecha,
    m.tipo,
    m.categoria + (m.categoriaAclaracion ? ` (${m.categoriaAclaracion})` : ""),
    m.descripcion || "",
    m.monto
  ]);

  doc.autoTable({ head, body, startY: 25 });
  // totales
  const ingresos = movimientos.filter(m => String(m.tipo).toLowerCase() === "ingreso").reduce((a, c) => a + c.monto, 0);
  const gastos = movimientos.filter(m => String(m.tipo).toLowerCase() === "gasto").reduce((a, c) => a + Math.abs(c.monto), 0);
  const saldo = ingresos - gastos;

  let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 25;
  doc.text(`Saldo: ${formatMoney(saldo)}`, 14, y);
  doc.text(`Ingresos: ${formatMoney(ingresos)}`, 14, y + 8);
  doc.text(`Gastos: ${formatMoney(gastos)}`, 14, y + 16);

  doc.save("mis-movimientos.pdf");
};

if (btnExportExcel) btnExportExcel.addEventListener("click", exportToExcel);
if (btnExportPdf) btnExportPdf.addEventListener("click", exportToPDF);

/* ---------------------------
   GRÁFICOS (Chart.js) - inicializa/destruye correctamente
----------------------------*/
let chartTorta = null;
let chartBarras = null;

const inicializarGraficos = () => {
  // solo si Chart está cargado y estamos en la page de gráficos
  if (typeof Chart === "undefined") return;

  // torta (Ingresos vs Gastos)
  const elTorta = document.getElementById("graficoTorta");
  if (elTorta) {
    if (chartTorta) chartTorta.destroy();

    const ingresos = movimientos.filter(m => String(m.tipo).toLowerCase() === "ingreso").reduce((a, c) => a + c.monto, 0);
    const gastos = movimientos.filter(m => String(m.tipo).toLowerCase() === "gasto").reduce((a, c) => a + Math.abs(c.monto), 0);

    chartTorta = new Chart(elTorta.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Ingresos", "Gastos"],
        datasets: [{ data: [ingresos, gastos], backgroundColor: ["#28a745", "#dc3545"] }]
      },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }

  // barras por mes
  const elBarras = document.getElementById("graficoBarras");
  if (elBarras) {
    if (chartBarras) chartBarras.destroy();

    const agrup = {};
    movimientos.forEach(m => {
      const d = new Date(m.fecha);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM
      if (!agrup[key]) agrup[key] = { ingresos: 0, gastos: 0 };
      if (String(m.tipo).toLowerCase() === "ingreso") agrup[key].ingresos += m.monto;
      else agrup[key].gastos += Math.abs(m.monto);
    });

    const keys = Object.keys(agrup).sort();
    const labels = keys.map(k => {
      const [y, mm] = k.split("-");
      return new Date(`${y}-${mm}-01`).toLocaleString("es-ES", { month: "short", year: "numeric" });
    });
    const datosIngresos = keys.map(k => agrup[k].ingresos);
    const datosGastos = keys.map(k => agrup[k].gastos);

    chartBarras = new Chart(elBarras.getContext("2d"), {
      type: "bar",
      data: {
        labels, datasets: [
          { label: "Ingresos", data: datosIngresos, backgroundColor: "#28a745" },
          { label: "Gastos", data: datosGastos, backgroundColor: "#dc3545" }
        ]
      },
      options: { responsive: true, plugins: { legend: { position: "top" } } }
    });
  }
};

/* 
   Inicialización: cargar datos y prender la app
-*/
cargarDatosIniciales();
