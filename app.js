import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, get, set, update, push, remove
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyChMXx5ZcleAo5oqzPvo1K_Af_wgQkh-LQ",
  authDomain: "listify-16b5d.firebaseapp.com",
  databaseURL: "https://listify-16b5d-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "listify-16b5d",
  storageBucket: "listify-16b5d.appspot.com",
  messagingSenderId: "238610923350",
  appId: "1:238610923350:web:cd5c2c3fb23b5c0afba0f7"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ROOT = "facturas";

const LOGO_SRC = "ICONS/icon-192.png";

let emisor = {};
let clientes = {};      // { id: {nombre,nif,domicilio,cpPoblacion,provincia} }
let ultimoNumero = null;
let numInicio = null;
let lineaSeq = 0;

const eur = (n) => (Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const todayStr = () => {
  const d = new Date();
  return String(d.getDate()).padStart(2,'0') + "/" + String(d.getMonth()+1).padStart(2,'0') + "/" + d.getFullYear();
};

/* ---------------- TABS ---------------- */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'historial') cargarHistorial();
  });
});

/* ---------------- CARGA INICIAL ---------------- */
async function cargarTodo() {
  try {
    const snap = await get(ref(db, ROOT));
    const data = snap.val() || {};
    emisor = data.emisor || {};
    clientes = data.clientes || {};
    ultimoNumero = data.config?.ultimoNumero ?? null;
    numInicio = data.config?.numInicio ?? null;

    rellenarConfigForm();
    pintarClientesRecurrentes();
    pintarSelectClientes();
    proponerSiguienteNumero();
  } catch (err) {
    console.error(err);
    alert('No se han podido cargar los datos de Firebase: ' + err.message);
  }
}
cargarTodo();

/* ---------------- CONFIGURACIÓN: EMISOR ---------------- */
function rellenarConfigForm() {
  document.getElementById('cfgNombre').value = emisor.nombre || '';
  document.getElementById('cfgNif').value = emisor.nif || '';
  document.getElementById('cfgDomicilio').value = emisor.domicilio || '';
  document.getElementById('cfgCpPoblacion').value = emisor.cpPoblacion || '';
  document.getElementById('cfgProvincia').value = emisor.provincia || '';
  document.getElementById('cfgNumInicio').value = numInicio ?? '';
  document.getElementById('txtUltimoNumero').textContent = ultimoNumero
    ? `Última factura emitida: nº ${ultimoNumero}`
    : 'Todavía no se ha emitido ninguna factura';
}

document.getElementById('btnGuardarEmisor').addEventListener('click', async () => {
  const datos = {
    nombre: document.getElementById('cfgNombre').value.trim(),
    nif: document.getElementById('cfgNif').value.trim(),
    domicilio: document.getElementById('cfgDomicilio').value.trim(),
    cpPoblacion: document.getElementById('cfgCpPoblacion').value.trim(),
    provincia: document.getElementById('cfgProvincia').value.trim()
  };
  try {
    await set(ref(db, `${ROOT}/emisor`), datos);
    emisor = datos;
    alert('Datos guardados.');
  } catch (err) {
    console.error(err);
    alert('No se ha podido guardar: ' + err.message);
  }
});

document.getElementById('btnGuardarNumInicio').addEventListener('click', async () => {
  const val = document.getElementById('cfgNumInicio').value.trim();
  try {
    await update(ref(db, `${ROOT}/config`), { numInicio: val });
    numInicio = val;
    proponerSiguienteNumero();
    alert('Número inicial guardado.');
  } catch (err) {
    console.error(err);
    alert('No se ha podido guardar: ' + err.message);
  }
});

/* ---------------- CLIENTES RECURRENTES ---------------- */
function pintarClientesRecurrentes() {
  const cont = document.getElementById('listaClientesRecurrentes');
  const ids = Object.keys(clientes);
  cont.innerHTML = '';
  if (ids.length === 0) {
    cont.innerHTML = '<div class="empty">Sin clientes recurrentes todavía</div>';
  }
  ids.forEach(id => {
    const c = clientes[id];
    const chip = document.createElement('div');
    chip.className = 'cliente-chip';
    chip.innerHTML = `
      <div>
        <div class="nombre">${c.nombre || '(sin nombre)'}</div>
        <div class="info">${c.nif || ''} · ${c.cpPoblacion || ''}</div>
      </div>
      <button class="btn danger small" data-del="${id}" type="button">Eliminar</button>
    `;
    cont.appendChild(chip);
  });
  cont.querySelectorAll('[data-del]').forEach(b => {
    b.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este cliente recurrente?')) return;
      const id = b.dataset.del;
      try {
        await remove(ref(db, `${ROOT}/clientes/${id}`));
        delete clientes[id];
        pintarClientesRecurrentes();
        pintarSelectClientes();
      } catch (err) {
        console.error(err);
        alert('No se ha podido eliminar: ' + err.message);
      }
    });
  });

  document.getElementById('btnMostrarNuevoCliente').style.display =
    ids.length >= 5 ? 'none' : 'inline-block';
}

document.getElementById('btnMostrarNuevoCliente').addEventListener('click', () => {
  document.getElementById('formNuevoCliente').style.display = 'block';
});
document.getElementById('btnCancelarNuevoCliente').addEventListener('click', () => {
  document.getElementById('formNuevoCliente').style.display = 'none';
});
document.getElementById('btnGuardarNuevoCliente').addEventListener('click', async () => {
  if (Object.keys(clientes).length >= 5) { alert('Máximo 5 clientes recurrentes.'); return; }
  const nuevo = {
    nombre: document.getElementById('ncNombre').value.trim(),
    nif: document.getElementById('ncNif').value.trim(),
    domicilio: document.getElementById('ncDomicilio').value.trim(),
    cpPoblacion: document.getElementById('ncCpPoblacion').value.trim(),
    provincia: document.getElementById('ncProvincia').value.trim()
  };
  if (!nuevo.nombre) { alert('Falta el nombre del cliente.'); return; }
  try {
    const r = push(ref(db, `${ROOT}/clientes`));
    await set(r, nuevo);
    clientes[r.key] = nuevo;
    ['ncNombre','ncNif','ncDomicilio','ncCpPoblacion','ncProvincia'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('formNuevoCliente').style.display = 'none';
    pintarClientesRecurrentes();
    pintarSelectClientes();
    alert('Cliente guardado.');
  } catch (err) {
    console.error(err);
    alert('No se ha podido guardar el cliente: ' + err.message);
  }
});

/* ---------------- NUEVA FACTURA: SELECCIÓN CLIENTE ---------------- */
function pintarSelectClientes() {
  const wrap = document.getElementById('selectClienteWrap');
  const sel = document.getElementById('selCliente');
  const ids = Object.keys(clientes);
  wrap.style.display = ids.length > 0 ? 'block' : 'none';
  sel.innerHTML = '<option value="">— Escribir datos manualmente —</option>';
  ids.forEach(id => {
    const c = clientes[id];
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = c.nombre;
    sel.appendChild(opt);
  });
}
document.getElementById('selCliente').addEventListener('change', (e) => {
  const id = e.target.value;
  const c = id ? clientes[id] : { nombre:'', nif:'', domicilio:'', cpPoblacion:'', provincia:'' };
  document.getElementById('cpNombre').value = c.nombre || '';
  document.getElementById('cpNif').value = c.nif || '';
  document.getElementById('cpDomicilio').value = c.domicilio || '';
  document.getElementById('cpCpPoblacion').value = c.cpPoblacion || '';
  document.getElementById('cpProvincia').value = c.provincia || '';
});

/* ---------------- NUMERACIÓN ---------------- */
function proponerSiguienteNumero() {
  let siguiente;
  if (ultimoNumero !== null && ultimoNumero !== undefined && !isNaN(parseInt(ultimoNumero))) {
    siguiente = parseInt(ultimoNumero) + 1;
  } else if (numInicio && !isNaN(parseInt(numInicio))) {
    siguiente = parseInt(numInicio);
  } else {
    siguiente = 1;
  }
  document.getElementById('numFactura').value = siguiente;
}

/* ---------------- FECHA ---------------- */
const chkHoy = document.getElementById('chkHoy');
const fechaInput = document.getElementById('fechaFactura');
function aplicarChkHoy() {
  if (chkHoy.checked) {
    fechaInput.value = todayStr();
    fechaInput.disabled = true;
  } else {
    fechaInput.disabled = false;
  }
}
chkHoy.addEventListener('change', aplicarChkHoy);
aplicarChkHoy();

/* ---------------- LÍNEAS DE FACTURA ---------------- */
const lineasBody = document.getElementById('lineasBody');

function addLinea(datos) {
  const id = 'ln' + (lineaSeq++);
  const card = document.createElement('div');
  card.className = 'linea-card';
  card.dataset.id = id;
  card.innerHTML = `
    <div class="lc-top">
      <div style="flex:1;">
        <label>Unidades</label>
        <input type="number" class="in-cant" value="${datos?.cantidad ?? 1}" min="0" step="1">
      </div>
      <button type="button" class="lc-del" data-del="${id}">✕</button>
    </div>
    <label>Concepto</label>
    <textarea class="in-desc" placeholder="Descripción del concepto">${datos?.descripcion ?? ''}</textarea>
    <div class="lc-bottom">
      <div>
        <label>Precio unitario</label>
        <input type="number" class="in-precio" value="${datos?.precio ?? ''}" min="0" step="0.01">
      </div>
      <div>
        <label>Total (sin IVA)</label>
        <span class="out-total">0,00 €</span>
      </div>
    </div>
  `;
  lineasBody.appendChild(card);
  card.querySelectorAll('input, textarea').forEach(inp => inp.addEventListener('input', recalcular));
  card.querySelector('[data-del]').addEventListener('click', () => { card.remove(); recalcular(); });
  recalcular();
}
document.getElementById('btnAddLinea').addEventListener('click', () => addLinea());

function leerLineas() {
  return Array.from(lineasBody.querySelectorAll('.linea-card')).map(card => {
    const cantidad = parseFloat(card.querySelector('.in-cant').value) || 0;
    const descripcion = card.querySelector('.in-desc').value.trim();
    const precio = parseFloat(card.querySelector('.in-precio').value) || 0;
    return { cantidad, descripcion, precio, total: cantidad * precio };
  });
}

function recalcular() {
  const lineas = leerLineas();
  lineasBody.querySelectorAll('.linea-card').forEach((card, i) => {
    card.querySelector('.out-total').textContent = eur(lineas[i].total);
  });
  const subtotal = lineas.reduce((s,l) => s + l.total, 0);
  const ivaPct = parseFloat(document.getElementById('ivaPct').value) || 0;
  const ivaImporte = subtotal * ivaPct / 100;
  const total = subtotal + ivaImporte;
  document.getElementById('txtSubtotal').textContent = eur(subtotal);
  document.getElementById('txtIva').textContent = eur(ivaImporte);
  document.getElementById('txtTotal').textContent = eur(total);
  return { subtotal, ivaPct, ivaImporte, total };
}
document.getElementById('ivaPct').addEventListener('input', recalcular);
addLinea();

/* ---------------- RECOGER DATOS DE FACTURA ACTUAL ---------------- */
function recogerFacturaActual() {
  const lineas = leerLineas().filter(l => l.descripcion || l.cantidad || l.precio);
  const totales = recalcular();
  return {
    numero: document.getElementById('numFactura').value.trim(),
    fecha: fechaInput.value.trim(),
    cliente: {
      nombre: document.getElementById('cpNombre').value.trim(),
      nif: document.getElementById('cpNif').value.trim(),
      domicilio: document.getElementById('cpDomicilio').value.trim(),
      cpPoblacion: document.getElementById('cpCpPoblacion').value.trim(),
      provincia: document.getElementById('cpProvincia').value.trim()
    },
    lineas,
    subtotal: totales.subtotal,
    ivaPct: totales.ivaPct,
    ivaImporte: totales.ivaImporte,
    total: totales.total,
    emisor: { ...emisor }
  };
}

/* ---------------- RENDER PLANTILLA DE FACTURA (para pantalla / PDF / impresión) ---------------- */
function renderFacturaHTML(f) {
  const filas = f.lineas.map(l => `
    <tr>
      <td>${l.cantidad}</td>
      <td>${l.descripcion}</td>
      <td>${eur(l.precio)}</td>
      <td>${eur(l.total)}</td>
    </tr>
  `).join('');
  return `
    <div class="fp-header">
      <img class="fp-logo" src="${LOGO_SRC}">
      <div class="fp-emisor">
        <div class="nombre">${f.emisor.nombre || ''}</div>
        <div>${f.emisor.domicilio || ''}</div>
        <div>${f.emisor.cpPoblacion || ''}</div>
        <div>${f.emisor.provincia || ''}</div>
        <div>${f.emisor.nif || ''}</div>
      </div>
    </div>
    <hr class="fp-rule">
    <div class="fp-row2">
      <div class="fp-fecha">
        ${f.fecha}
        <div class="fp-numero">Factura ${f.numero}</div>
      </div>
      <div class="fp-cliente">
        <div class="nombre">${f.cliente.nombre || ''}</div>
        <div>${f.cliente.domicilio || ''}</div>
        <div>${f.cliente.cpPoblacion || ''}</div>
        <div>${f.cliente.provincia || ''}</div>
        <div>${f.cliente.nif || ''}</div>
      </div>
    </div>
    <table class="fp-tabla">
      <thead><tr><th>Cantidad</th><th>Descripción</th><th>P. Unidad</th><th>Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="fp-totales">
      <div>Subtotal ${eur(f.subtotal)}</div>
      <div>IVA (${f.ivaPct}%) ${eur(f.ivaImporte)}</div>
      <div><b>TOTAL ${eur(f.total)}</b></div>
    </div>
  `;
}

/* ---------------- PREVIEW / PDF / IMPRESIÓN ---------------- */
const previewWrap = document.getElementById('facturaPreviewWrap');
const previewDiv = document.getElementById('facturaPreview');

function abrirPreview(f) {
  previewDiv.innerHTML = renderFacturaHTML(f);
  previewWrap.style.display = 'block';
  previewWrap.dataset.numero = f.numero;
}
document.getElementById('btnCerrarPreview').addEventListener('click', () => previewWrap.style.display = 'none');

function descargarPdf() {
  const opt = {
    margin: 10,
    filename: `Factura_${previewWrap.dataset.numero || 'sin_numero'}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, backgroundColor: '#fdfcf7', windowWidth: 794 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    pagebreak: { mode: ['avoid-all'] }
  };
  html2pdf().set(opt).from(previewDiv).save();
}
function imprimir() { window.print(); }

document.getElementById('btnPdfFromPreview').addEventListener('click', descargarPdf);
document.getElementById('btnPrintFromPreview').addEventListener('click', imprimir);

document.getElementById('btnPdfPreview').addEventListener('click', () => {
  abrirPreview(recogerFacturaActual());
  descargarPdf();
});
document.getElementById('btnPrintPreview').addEventListener('click', () => {
  abrirPreview(recogerFacturaActual());
  imprimir();
});

/* ---------------- GUARDAR FACTURA ---------------- */
document.getElementById('btnGuardarFactura').addEventListener('click', async () => {
  const f = recogerFacturaActual();
  if (!f.numero) { alert('Falta el número de factura.'); return; }
  if (!f.fecha) { alert('Falta la fecha.'); return; }
  if (!f.cliente.nombre) { alert('Falta el nombre del cliente.'); return; }
  if (f.lineas.length === 0) { alert('Añade al menos un concepto.'); return; }

  try {
    const r = push(ref(db, `${ROOT}/historial`));
    await set(r, f);

    if (!isNaN(parseInt(f.numero))) {
      ultimoNumero = parseInt(f.numero);
      await update(ref(db, `${ROOT}/config`), { ultimoNumero });
    }

    alert('Factura guardada.');
    resetFormularioFactura();
    proponerSiguienteNumero();
  } catch (err) {
    console.error(err);
    alert('No se ha podido guardar la factura: ' + err.message);
  }
});

function resetFormularioFactura() {
  document.getElementById('selCliente').value = '';
  ['cpNombre','cpNif','cpDomicilio','cpCpPoblacion','cpProvincia'].forEach(id => document.getElementById(id).value = '');
  lineasBody.innerHTML = '';
  addLinea();
  document.getElementById('ivaPct').value = 21;
  chkHoy.checked = true;
  aplicarChkHoy();
}

/* ---------------- HISTORIAL ---------------- */
async function cargarHistorial() {
  const cont = document.getElementById('listaHistorial');
  let data;
  try {
    const snap = await get(ref(db, `${ROOT}/historial`));
    data = snap.val() || {};
  } catch (err) {
    console.error(err);
    cont.innerHTML = '<div class="empty">No se ha podido cargar el historial</div>';
    return;
  }
  const ids = Object.keys(data).sort((a,b) => (data[b].numero||0) - (data[a].numero||0) || b.localeCompare(a));
  if (ids.length === 0) {
    cont.innerHTML = '<div class="empty">Aún no hay facturas guardadas</div>';
    return;
  }
  cont.innerHTML = '';
  ids.forEach(id => {
    const f = data[id];
    const item = document.createElement('div');
    item.className = 'historial-item';
    item.innerHTML = `
      <div>
        <div class="num">Factura ${f.numero}</div>
        <div class="meta">${f.fecha || ''} · ${f.cliente?.nombre || ''}</div>
      </div>
      <div class="imp">${eur(f.total)}</div>
    `;
    item.addEventListener('click', () => abrirPreview(f));
    cont.appendChild(item);
  });
}
