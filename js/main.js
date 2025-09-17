// =====================
// Referencias al DOM
// =====================
const form = document.getElementById("form-movimiento");
const lista = document.getElementById("lista-movimientos");
const saldoEl = document.getElementById("saldo");
const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");

// Botones de exportación
const btnExportExcel = document.getElementById("btn-export-excel");
const btnExportPdf = document.getElementById("btn-export-pdf");

// Botón cancelar edición
const btnCancelEdit = document.getElementById("btn-cancel-edit");

// =====================
// Estado global
// =====================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];
let editIndex = null; // índice del movimiento en edición

// =====================
// Guardar en localStorage con promesa
// =====================
const guardarMovimientos = () => {
  return new Promise((resolve, reject) => {
    try {
      localStorage.setItem("movimientos", JSON.stringify(movimientos));
      resolve("Movimientos guardados correctamente");
    } catch (error) {
      reject("Error al guardar en localStorage");
    }
  });
};

// =====================
// Actualizar tabla y totales
// =====================
const actualizarTabla = () => {
  lista.innerHTML = "";
  let saldo = 0, ingresos = 0, gastos = 0;

  movimientos.forEach((mov, index) => {
    const montoFormateado = Math.abs(mov.monto).toLocaleString("es-AR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${mov.fecha}</td>
      <td>${mov.tipo}</td>
      <td>${mov.categoria}</td>
      <td>${mov.monto < 0
        ? `<span class="gasto">-$${montoFormateado}</span>`
        : `<span class="ingreso">+$${montoFormateado}</span>`}
      </td>
      <td>
  <button class="btn btn-secondary editar" data-index="${index}">Editar</button>
  <button class="btn btn-danger eliminar" data-index="${index}">Eliminar</button>
      </td>
    `;
    lista.appendChild(fila);

    if (mov.monto >= 0) ingresos += mov.monto;
    else gastos += Math.abs(mov.monto);
  });

  saldo = ingresos - gastos;
  saldoEl.textContent = `$${saldo.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  ingresosEl.textContent = `$${ingresos.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  gastosEl.textContent = `$${gastos.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// =====================
// Inicializar
// =====================
actualizarTabla();

// =====================
// Envío del formulario (Agregar/Editar)
// =====================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fecha = document.getElementById("fecha").value;
  const tipo = document.getElementById("tipo").value;
  let categoria = document.getElementById("categoria").value;
  const montoBase = Number(document.getElementById("monto").value);

  if (!fecha || !tipo || !categoria || isNaN(montoBase)) {
    alert("Por favor completá todos los campos");
    return;
  }

  if (categoria === "Otros") {
    const extra = document.getElementById("categoria-otros").value.trim();
    if (extra) categoria += ` (${extra})`;
  }

  const monto = tipo === "gasto" ? -Math.abs(montoBase) : Math.abs(montoBase);

  if (editIndex !== null) {
    // Editar
    movimientos[editIndex] = { fecha, tipo, categoria, monto };
    editIndex = null;
    btnCancelEdit.style.display = "none";
    document.getElementById("btn-submit").textContent = "Agregar";
  } else {
    // Agregar nuevo
    movimientos.push({ fecha, tipo, categoria, monto });
  }

  await guardarMovimientos()
    .then((msg) => console.log(msg))
    .catch((err) => console.error(err))
    .finally(() => actualizarTabla());

  form.reset();
  document.getElementById("categoria-otros").style.display = "none";
});

// =====================
// Cancelar edición
// =====================
btnCancelEdit.addEventListener("click", () => {
  editIndex = null;
  form.reset();
  btnCancelEdit.style.display = "none";
  document.getElementById("btn-submit").textContent = "Agregar";
});

// =====================
// Manejo de acciones (Editar/Eliminar)
// =====================
lista.addEventListener("click", (e) => {
  const index = e.target.getAttribute("data-index");
  if (e.target.classList.contains("editar")) {
    // Editar
    const mov = movimientos[index];
    document.getElementById("fecha").value = mov.fecha;
    document.getElementById("tipo").value = mov.tipo;
    document.getElementById("categoria").value = mov.categoria.includes("(")
      ? "Otros"
      : mov.categoria;
    if (mov.categoria.startsWith("Otros")) {
      const extra = mov.categoria.match(/\((.*?)\)/);
      if (extra) {
        document.getElementById("categoria-otros").value = extra[1];
        document.getElementById("categoria-otros").style.display = "block";
      }
    }
    document.getElementById("monto").value = Math.abs(mov.monto);

    editIndex = index;
    btnCancelEdit.style.display = "inline-block";
    document.getElementById("btn-submit").textContent = "Guardar cambios";
  }

  if (e.target.classList.contains("eliminar")) {
    const modal = document.getElementById("modal-confirm");
    const btnConfirm = document.getElementById("modal-confirm-btn");
    const btnCancel = document.getElementById("modal-cancel");
    modal.style.display = "flex";

    btnConfirm.onclick = async () => {
      movimientos.splice(index, 1);
      await guardarMovimientos()
        .then(() => actualizarTabla())
        .catch((err) => console.error(err))
        .finally(() => (modal.style.display = "none"));
    };

    btnCancel.onclick = () => {
      modal.style.display = "none";
    };
  }
});

// =====================
// Exportar a Excel
// =====================
btnExportExcel.addEventListener("click", () => {
  new Promise((resolve) => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(movimientos);
    XLSX.utils.book_append_sheet(wb, ws, "Movimientos");

    const totales = [
      { Saldo: saldoEl.textContent },
      { Ingresos: ingresosEl.textContent },
      { Gastos: gastosEl.textContent },
    ];
    const wsTotales = XLSX.utils.json_to_sheet(totales);
    XLSX.utils.book_append_sheet(wb, wsTotales, "Totales");

    resolve(wb);
  })
    .then((wb) => XLSX.writeFile(wb, "mis-movimientos.xlsx"))
    .catch((err) => console.error("Error al exportar Excel:", err))
    .finally(() => console.log("Exportación Excel finalizada"));
});

// =====================
// Exportar a PDF
// =====================
btnExportPdf.addEventListener("click", () => {
  new Promise((resolve) => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text("Mis movimientos", 14, 15);
    doc.autoTable({ html: "#tabla-movimientos", startY: 20 });

    let y = doc.lastAutoTable.finalY + 10;
    doc.text(`Saldo: ${saldoEl.textContent}`, 14, y);
    doc.text(`Ingresos: ${ingresosEl.textContent}`, 14, y + 10);
    doc.text(`Gastos: ${gastosEl.textContent}`, 14, y + 20);

    resolve(doc);
  })
    .then((doc) => doc.save("mis-movimientos.pdf"))
    .catch((err) => console.error("Error al exportar PDF:", err))
    .finally(() => console.log("Exportación PDF finalizada"));
});
