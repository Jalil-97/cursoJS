// =====================
// Referencias al DOM
// =====================
const form = document.getElementById("form-movimiento");
const lista = document.getElementById("lista-movimientos");

const saldoEl = document.getElementById("saldo");
const ingresosEl = document.getElementById("ingresos");
const gastosEl = document.getElementById("gastos");

// =====================
// Cargar movimientos desde localStorage o iniciar array vacío
// =====================
let movimientos = JSON.parse(localStorage.getItem("movimientos")) || [];

// =====================
// Función para actualizar tabla y totales
// =====================
function actualizarTabla() {
  // Limpiar tabla
  lista.innerHTML = "";

  // Resetear totales
  let saldo = 0;
  let ingresos = 0;
  let gastos = 0;

  // Recorrer movimientos
  movimientos.forEach((mov, index) => {
    // Formatear monto con punto para miles y coma para decimales
    const montoFormateado = Math.abs(mov.monto).toLocaleString('es-AR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });

    // Crear fila en la tabla
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${mov.fecha}</td>
      <td>${mov.categoria}</td>
      <td>${mov.monto < 0 ? `<span class="gasto">-${montoFormateado}</span>` : `<span class="ingreso">+${montoFormateado}</span>`}</td>
      <td><button class="eliminar" data-index="${index}">Eliminar</button></td>
    `;
    lista.appendChild(fila);

    // Actualizar totales
    if (mov.monto >= 0) {
      ingresos += mov.monto;
    } else {
      gastos += Math.abs(mov.monto);
    }
  });

  saldo = ingresos - gastos;

  // Mostrar totales formateados
  saldoEl.textContent = `$${saldo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  ingresosEl.textContent = `$${ingresos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  gastosEl.textContent = `$${gastos.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// =====================
// Inicializar tabla al cargar la página
// =====================
actualizarTabla();

// =====================
// Manejar envío del formulario
// =====================
form.addEventListener("submit", function (e) {
  e.preventDefault();

  const fecha = document.getElementById("fecha").value;
  const categoria = document.getElementById("categoria").value;
  const monto = Number(document.getElementById("monto").value);

  if (!fecha || !categoria || isNaN(monto)) {
    alert("Por favor completá todos los campos");
    return;
  }

  // Agregar movimiento al array
  movimientos.push({ fecha, categoria, monto });

  // Guardar en localStorage
  localStorage.setItem("movimientos", JSON.stringify(movimientos));

  // Actualizar tabla y totales
  actualizarTabla();

  // Resetear formulario
  form.reset();
});

// =====================
// Manejar eliminación de movimientos
// =====================
lista.addEventListener("click", function(e) {
  if (e.target.classList.contains("eliminar")) {
    const index = e.target.getAttribute("data-index");

    // Eliminar del array
    movimientos.splice(index, 1);

    // Guardar cambios en localStorage
    localStorage.setItem("movimientos", JSON.stringify(movimientos));

    // Actualizar tabla y totales
    actualizarTabla();
  }
});
