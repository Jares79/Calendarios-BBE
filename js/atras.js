// js/atras.js
// Gesto o botón "atrás" del móvil (Android e iPhone): en vez de salir de la app, cierra lo último que se
// abrió (ventana, hoja de un día, menú de usuario, modo cambio o edición, pantalla de resultados).
// Con la pantalla principal a la vista, "atrás" sigue saliendo de la app como siempre.
//
// Cómo funciona: cada capa abierta tiene una entrada en el historial del navegador. Se vigila qué capas hay
// abiertas y se mantiene el historial al mismo nivel: al abrir una capa se añade una entrada y al cerrarla
// con un botón de la app se quita. Al pulsar atrás, el navegador quita la entrada y aquí se cierra la capa.
(function () {
    let entradas = 0;            // entradas de historial que ha añadido la app
    let esperandoPop = false;    // hemos pedido volver atrás nosotros y esperamos su aviso
    let esperaHasta = 0;
    let pendiente = null;

    // Capas abiertas, de la de abajo a la de arriba, cada una con la función que la cierra
    function capasAbiertas() {
        const capas = [];
        const menu = document.getElementById("panelUsuario");
        if (document.body.classList.contains("vista-resultado")) capas.push(() => cerrarVistaResultado());
        if (typeof modoEdicion !== "undefined" && modoEdicion) capas.push(() => terminarModoEdicion());
        if (typeof modoCambio !== "undefined" && modoCambio) capas.push(() => terminarModoCambio());
        if (menu && menu.style.display !== "none") capas.push(() => cerrarPanelUsuario());
        if (document.getElementById("panelDetalleDia")) capas.push(() => ocultarDetalleDia());
        if (document.getElementById("modalCambio")) capas.push(() => cerrarModal());
        return capas;
    }

    // Deja el historial con tantas entradas como capas abiertas
    function sincronizar() {
        pendiente = null;
        if (esperandoPop) {
            if (Date.now() < esperaHasta) return;   // esperando a que el navegador termine de retroceder
            esperandoPop = false;
        }
        const n = capasAbiertas().length;
        if (n > entradas) {
            for (let i = entradas; i < n; i++) history.pushState({ bbe: i + 1 }, "");
            entradas = n;
        } else if (n < entradas) {
            // Se cerró con un botón de la app: se quitan sus entradas sin cerrar nada más
            const sobran = entradas - n;
            entradas = n;
            esperandoPop = true;
            esperaHasta = Date.now() + 800;
            history.go(-sobran);
        }
    }

    function programar() {
        if (pendiente === null) pendiente = setTimeout(sincronizar, 30);
    }

    window.addEventListener("popstate", () => {
        if (esperandoPop) { esperandoPop = false; return; }   // es el que hemos provocado nosotros
        if (entradas > 0) {
            // Gesto atrás del usuario: una entrada menos y se cierra la capa de arriba
            entradas--;
            const capas = capasAbiertas();
            if (capas.length) {
                try { capas[capas.length - 1](); } catch (e) { console.error(e); }
            }
        }
        sincronizar();
    });

    document.addEventListener("DOMContentLoaded", () => {
        new MutationObserver(programar).observe(document.body, {
            childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"]
        });
        setInterval(programar, 400);   // red de seguridad por si algún cambio no toca el DOM
    });

    // Solo para las pruebas automáticas
    window.estadoAtras = () => ({ entradas, capas: capasAbiertas().length });
})();
