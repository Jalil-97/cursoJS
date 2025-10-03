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

// Mostrar/ocultar aclaración cuando se elige "Otros"
if (categoriaInput && categoriaOtrosInput) {
  categoriaInput.addEventListener("change", () => {
    if (categoriaInput.value.toLowerCase() === "otros") {
      categoriaOtrosInput.style.display = "block";
    } else {
      categoriaOtrosInput.style.display = "none";
      categoriaOtrosInput.value = "";
    }
  });
}

// Estado
let movimientos = []; // array de objetos { fecha, tipo, categoria, monto, descripcion?, id }
let editId = null; // id en edición
let idAEliminar = null; // id pendiente de eliminación (para modal)

/* ---------------------------
   Funciones utilitarias
----------------------------*/
const formatMoney = n => {
  const num = Number(n);
  const formatted = Math.abs(num).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return num < 0 ? `-$${formatted}` : `$${formatted}`;
};

const formatDate = isoDate => {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
};

const tryFetch = async paths => {
  for (const p of paths) {
    try {
      const res = await fetch(p);
      if (res.ok) return res;
    } catch (e) {}
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
      movimientos = data.map(m => ({ ...m, id: Date.now() + Math.random() })); // asegurar id único
      localStorage.setItem("movimientos", JSON.stringify(movimientos));
    } else {
      movimientos = JSON.parse(localStorage.getItem("movimientos"));
    }
  } catch (err) {
    console.error("Carga inicial fallida (data.json):", err);
    movimientos = JSON.parse(localStorage.getItem("movimientos") || "[]");
  } finally {
    actualizarTabla();
    actualizarTotales();
    inicializarGraficos();
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
  lista.innerHTML = "";

  const movimientosOrdenados = [...movimientos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  movimientosOrdenados.forEach(mov => {
    const categoriaTexto = mov.categoria + (mov.categoriaAclaracion ? ` (${mov.categoriaAclaracion})` : "");
    const montoForm = mov.monto < 0
      ? `<span class="gasto">${formatMoney(mov.monto)}</span>`
      : `<span class="ingreso">+${formatMoney(mov.monto)}</span>`;
    const descripcionHtml = mov.descripcion ? `<div class="small muted">${mov.descripcion}</div>` : "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(mov.fecha)}</td>
      <td>${mov.tipo || ""}</td>
      <td>${categoriaTexto}${descripcionHtml}</td>
      <td>${montoForm}</td>
      <td>
        <button class="btn btn-secondary editar" data-id="${mov.id}">Editar</button>
        <button class="btn btn-danger eliminar" data-id="${mov.id}">Eliminar</button>
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
    const tipo = tipoInput ? tipoInput.value : "Ingreso";
    const categoria = categoriaInput ? categoriaInput.value : "Otros";
    const categoriaAclaracion = categoriaOtrosInput ? categoriaOtrosInput.value.trim() : "";
    const montoRaw = montoInput ? parseFloat(montoInput.value) : 0;
    const descripcion = descripcionInput ? descripcionInput.value.trim() : "";

    if (!fecha || !tipo || !categoria || isNaN(montoRaw)) {
      alert("Por favor completá todos los campos correctamente.");
      return;
    }

    let monto = Number(montoRaw);
    if (String(tipo).toLowerCase() === "gasto" && monto > 0) monto = -Math.abs(monto);
    if (String(tipo).toLowerCase() === "ingreso") monto = Math.abs(monto);

    const nuevo = { fecha, tipo, categoria, categoriaAclaracion: categoriaAclaracion || undefined, monto, descripcion: descripcion || undefined };

    if (editId !== null) {
      const idx = movimientos.findIndex(m => m.id === editId);
      if (idx !== -1) {
        movimientos[idx] = { ...nuevo, id: editId };
      }
      editId = null;
      if (btnCancelEdit) btnCancelEdit.style.display = "none";
      const submitBtn = document.getElementById("btn-submit");
      if (submitBtn) submitBtn.textContent = "Agregar";
    } else {
      movimientos.push({ ...nuevo, id: Date.now() + Math.random() });
    }

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
    const id = Number(btn.dataset.id);

    if (btn.classList.contains("editar")) {
      const mov = movimientos.find(m => m.id === id);
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

      editId = mov.id;
      if (btnCancelEdit) btnCancelEdit.style.display = "inline-block";
      const submitBtn = document.getElementById("btn-submit");
      if (submitBtn) submitBtn.textContent = "Guardar cambios";
      return;
    }

    if (btn.classList.contains("eliminar")) {
      if (modal && modalConfirmBtn && modalCancelBtn) {
        idAEliminar = id;
        modal.setAttribute("aria-hidden", "false");
        modal.style.display = "flex";
      } else {
        if (confirm("¿Seguro que querés eliminar este movimiento?")) {
          movimientos = movimientos.filter(m => m.id !== id);
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
      movimientos = movimientos.filter(m => m.id !== idAEliminar);
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
    editId = null;
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

  const ingresos = movimientos.filter(m => String(m.tipo).toLowerCase() === "ingreso").reduce((a, c) => a + c.monto, 0);
  const gastos = movimientos.filter(m => String(m.tipo).toLowerCase() === "gasto").reduce((a, c) => a + Math.abs(c.monto), 0);
  const saldo = ingresos - gastos;
  const wsT = XLSX.utils.json_to_sheet([{ Saldo: saldo }, { Ingresos: ingresos }, { Gastos: gastos }]);
  XLSX.utils.book_append_sheet(wb, wsT, "Totales");

  XLSX.writeFile(wb, "mis-movimientos.xlsx");
};

const exportToPDF = () => {
  const { jsPDF } = window.jspdf || { jsPDF };
  if (!jsPDF) return alert("jsPDF o autoTable no cargados.");
  const doc = new jsPDF();
  doc.text("Mis movimientos", 14, 15);

  const head = [["Fecha", "Tipo", "Categoria", "Descripción", "Monto"]];
  const body = movimientos.map(m => [m.fecha, m.tipo, m.categoria + (m.categoriaAclaracion ? ` (${m.categoriaAclaracion})` : ""), m.descripcion || "", m.monto]);

  doc.autoTable({ head, body, startY: 25 });

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
   GRÁFICOS (Chart.js)
----------------------------*/
let chartTorta = null;
let chartBarras = null;

const inicializarGraficos = () => {
  if (typeof Chart === "undefined") return;

  const elTorta = document.getElementById("graficoTorta");
  if (elTorta) {
    if (chartTorta) chartTorta.destroy();
    const ingresos = movimientos.filter(m => String(m.tipo).toLowerCase() === "ingreso").reduce((a, c) => a + c.monto, 0);
    const gastos = movimientos.filter(m => String(m.tipo).toLowerCase() === "gasto").reduce((a, c) => a + Math.abs(c.monto), 0);

    chartTorta = new Chart(elTorta.getContext("2d"), {
      type: "doughnut",
      data: { labels: ["Ingresos", "Gastos"], datasets: [{ data: [ingresos, gastos], backgroundColor: ["#28a745", "#dc3545"] }] },
      options: { responsive: true, plugins: { legend: { position: "bottom" } } }
    });
  }

  const elBarras = document.getElementById("graficoBarras");
  if (elBarras) {
    if (chartBarras) chartBarras.destroy();

    const agrup = {};
    movimientos.forEach(m => {
      const d = new Date(m.fecha);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
      data: { labels, datasets: [{ label: "Ingresos", data: datosIngresos, backgroundColor: "#28a745" }, { label: "Gastos", data: datosGastos, backgroundColor: "#dc3545" }] },
      options: { responsive: true, plugins: { legend: { position: "top" } } }
    });
  }
};

/* Inicialización */
cargarDatosIniciales();
