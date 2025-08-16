// Estado global
let banco = [];              // Todas las preguntas cargadas
let seleccion = [];          // Subconjunto del simulacro
let idx = 0;                 // Índice actual
let respuestas = [];         // Índices elegidos por el usuario (o null)
let timerId = null;          // Cronómetro
let tiempoRestante = 0;      // En segundos

// Utilidades
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>document.querySelectorAll(sel);

function shuffle(arr){
  for(let i=arr.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [arr[i],arr[j]]=[arr[j],arr[i]];
  }
  return arr;
}

// Cargar banco de preguntas
fetch('preguntas.json')
  .then(r=>r.json())
  .then(data=>{
    banco = data;
    // Popular categorías si hubieran más
    const cats = [...new Set(banco.map(q=>q.categoria))];
    const sel = $('#categoria');
    sel.innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  });

// Dark mode
$('#darkToggle').addEventListener('click', ()=>{
  document.body.classList.toggle('dark');
  localStorage.setItem('dark', document.body.classList.contains('dark')?'1':'0');
});
if(localStorage.getItem('dark')==='1'){ document.body.classList.add('dark'); }

// Exportar resultados
$('#downloadState').addEventListener('click', (e)=>{
  e.preventDefault();
  const blob = new Blob([JSON.stringify({respuestas, seleccion, fecha:new Date().toISOString()}, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'resultado_preuniquest.json'; a.click();
  URL.revokeObjectURL(url);
});

// Controles
$('#btnComenzar').addEventListener('click', ()=>{
  iniciarSimulacro();
});

$('#btnAnterior').addEventListener('click', ()=>{
  if(idx>0){ idx--; renderPregunta(); }
});
$('#btnSiguiente').addEventListener('click', ()=>{
  if(idx<seleccion.length-1){ idx++; renderPregunta(); }
});
$('#btnFinalizar').addEventListener('click', finalizar);

$('#btnReintentar')?.addEventListener('click', ()=>{
  // Repetir mismo set
  idx = 0;
  respuestas = Array(seleccion.length).fill(null);
  $('#resultado').classList.add('hidden');
  $('#quiz').classList.remove('hidden');
  renderPregunta();
  reiniciarTimer();
});
$('#btnNuevo')?.addEventListener('click', ()=>{
  // Volver a intro
  clearInterval(timerId);
  $('#resultado').classList.add('hidden');
  $('.intro').scrollIntoView({behavior:'smooth'});
  $('.intro').classList.add('pulse');
  setTimeout(()=>$('.intro').classList.remove('pulse'), 600);
});

function iniciarSimulacro(){
  const cat = $('#categoria').value;
  let n = parseInt($('#numPreguntas').value,10);
  n = Math.max(3, Math.min(n, 50));

  const pool = banco.filter(q=>q.categoria===cat);
  if(pool.length===0){
    alert('No hay preguntas para esa categoría.');
    return;
  }
  seleccion = shuffle(pool.slice()).slice(0, n);
  respuestas = Array(n).fill(null);
  idx = 0;

  // UI
  $('#quiz').classList.remove('hidden');
  $('#resultado').classList.add('hidden');
  renderPregunta();

  // Timer
  const mins = Math.max(1, Math.min(180, parseInt($('#minutos').value,10)||10));
  tiempoRestante = mins*60;
  reiniciarTimer();
}

function reiniciarTimer(){
  clearInterval(timerId);
  pintarTimer();
  timerId = setInterval(()=>{
    tiempoRestante--;
    pintarTimer();
    if(tiempoRestante<=0){
      clearInterval(timerId);
      finalizar();
    }
  }, 1000);
}

function pintarTimer(){
  const m = Math.floor(tiempoRestante/60);
  const s = tiempoRestante%60;
  $('#timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function renderPregunta(){
  const q = seleccion[idx];
  $('#enunciado').textContent = q.pregunta;
  $('#contador').textContent = `${idx+1} / ${seleccion.length}`;
  const progreso = ((idx)/Math.max(1,seleccion.length-1))*100;
  $('#progress').style.width = `${progreso}%`;

  const ul = $('#opciones');
  ul.innerHTML='';

  q.opciones.forEach((texto, i)=>{
    const li = document.createElement('li');
    li.textContent = `${String.fromCharCode(65+i)}) ${texto}`;
    li.addEventListener('click', ()=>seleccionar(i));
    // Marcado si ya respondió
    if(respuestas[idx]!==null){
      li.classList.add(i===q.respuesta?'correct':'incorrect');
      if(i===respuestas[idx]) li.classList.add('seleccionada');
    }
    ul.appendChild(li);
  });

  // Explicación
  if(respuestas[idx]!==null){
    $('#explicacion').classList.remove('hidden');
    $('#explicacion').innerHTML = `<strong>Explicación:</strong> ${q.explicacion || '—'}`;
  }else{
    $('#explicacion').classList.add('hidden');
    $('#explicacion').textContent='';
  }

  // Botones
  $('#btnAnterior').disabled = (idx===0);
}

function seleccionar(i){
  if(respuestas[idx]!==null){
    // Evita cambiar después de responder; permitir? comentar para permitir cambios.
    return;
  }
  respuestas[idx]=i;
  // Pinta feedback inmediato
  const q = seleccion[idx];
  $$('#opciones li').forEach((li, k)=>{
    if(k===q.respuesta) li.classList.add('correct');
    if(k!==q.respuesta) li.classList.add('incorrect');
    if(k===i) li.classList.add('seleccionada');
  });
  // Explicación
  $('#explicacion').classList.remove('hidden');
  $('#explicacion').innerHTML = `<strong>Explicación:</strong> ${q.explicacion || '—'}`;
}

function finalizar(){
  clearInterval(timerId);
  // Calcular resultados
  let ok=0, bad=0, neutro=0;
  seleccion.forEach((q, i)=>{
    if(respuestas[i]===null) neutro++;
    else if(respuestas[i]===q.respuesta) ok++;
    else bad++;
  });
  const pct = Math.round(ok*100/seleccion.length);
  $('#resumen').innerHTML = `Obtuviste <strong>${ok}</strong> de <strong>${seleccion.length}</strong> correctas (<strong>${pct}%</strong>).`;
  $('#pillOk').textContent = `${ok} correctas`;
  $('#pillBad').textContent = `${bad} incorrectas`;
  $('#pillNeutro').textContent = `${neutro} sin responder`;

  // Lista de revisión
  const ol = $('#revisiónLista'); ol.innerHTML='';
  seleccion.forEach((q, i)=>{
    const li = document.createElement('li');
    const marcada = respuestas[i];
    const correcta = q.respuesta;
    const estado = marcada===null?'Sin responder':(marcada===correcta?'✔ Correcta':'✘ Incorrecta');
    li.innerHTML = `<strong>${i+1}.</strong> ${q.pregunta}<br>
      <em>Tu respuesta:</em> ${marcada!==null? String.fromCharCode(65+marcada)+') '+q.opciones[marcada] : '—'}<br>
      <em>Correcta:</em> ${String.fromCharCode(65+correcta)}) ${q.opciones[correcta]}<br>
      <em>Explicación:</em> ${q.explicacion || '—'}<br>
      <small class="muted">(${q.categoria} • ${q.anio || 's/f'})</small>`;
    ol.appendChild(li);
  });

  $('#quiz').classList.add('hidden');
  $('#resultado').classList.remove('hidden');
}
