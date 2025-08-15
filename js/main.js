alert("Bienvenido al organizador de gastos");

let arrayGastos = [];

const listaDeGastos = ["alimentos", "transporte", "entretenimiento", "deudas", "salud", "otros"]

function registrarGastos() {

    let gastoRegistrado = prompt("A continuación, seleccione el gasto que desea registrar: " + listaDeGastos.join(", "));
    gastoRegistrado = gastoRegistrado.toLowerCase();

    if (!listaDeGastos.includes(gastoRegistrado)) {// si el nombre del gasto no esta incluido dentro de la lista, arroja el alert y cortamos la funcion con return
        alert("Gasto invalido, intente nuevamente");
        return registrarGastos();
    }

    let importe = parseFloat(prompt("Ingrese el monto:"));

    if (isNaN(importe) || importe <= 0) { //si el importe ingresado no es un numero o es menor o igual a cero, arroja el alert y cortamos la funcion con return
        alert("Monto invalido, ingrese un numero mayor a 0");
        return registrarGastos();
    }

    arrayGastos.push({ Categoria: gastoRegistrado, Importe: importe });


    let continuar = prompt("¿Desea ingresar otro gasto? (si/no)").toLowerCase();

    if (continuar === "si") {
        registrarGastos();
    }

    else if (continuar !== "si") {

        // Calcular totales por categoría
        let totalesPorCategoria = {};
        arrayGastos.forEach(gasto => {
            if (!totalesPorCategoria[gasto.Categoria]) {
                totalesPorCategoria[gasto.Categoria] = 0;
            }
            totalesPorCategoria[gasto.Categoria] += gasto.Importe;
        });

        // Calcular total general
        const totalGeneral = arrayGastos.reduce((acum, gasto) => acum + gasto.Importe, 0);

        // Crear mensaje final
        let mensaje = "Usted ha registrado:\n\n";
        for (let categoria in totalesPorCategoria) {
            mensaje += `${categoria}: $${totalesPorCategoria[categoria].toFixed(2)}\n`;
        }
        mensaje += `\nTotal general: $${totalGeneral.toFixed(2)}`;

        alert(mensaje);
    }

}

registrarGastos();






