
const STORAGE_KEY = "manuelito-content-v2";

const initialVideos = [
  "El regreso: un año después",
  "Así era Manuelito cuando nos despedimos",
  "Sus primeras palabras favoritas",
  "Descubriendo los colores",
  "Sus ocurrencias más graciosas",
  "Aprendiendo español e inglés",
  "Jugando con papá",
  "Un momento especial con mamá",
  "Su cumpleaños y cuánto creció",
  "La etapa de las preguntas",
  "Las frases que ya puede decir",
  "Así está Manuelito hoy"
].map((title, index) => ({
  id: crypto.randomUUID(),
  title,
  status: index === 0 ? "published" : "idea",
  notes: "",
  order: index + 1
}));

const defaultRoutine = [
  { id: crypto.randomUUID(), day: 1, hour: 19, minute: 30, title: "Publicar episodio de la serie", type: "Publicación" },
  { id: crypto.randomUUID(), day: 3, hour: 19, minute: 30, title: "Publicar episodio de la serie", type: "Publicación" },
  { id: crypto.randomUUID(), day: 6, hour: 9, minute: 0, title: "Publicar episodio de la serie", type: "Publicación" },
  { id: crypto.randomUUID(), day: 0, hour: 19, minute: 0, title: "Preparar contenido de la semana", type: "Preparación" }
];

function defaultState() {
  const seriesId = crypto.randomUUID();
  return {
    activeSeriesId: seriesId,
    series: [{
      id: seriesId,
      name: "1 año en la vida de Manuelito",
      description: "Un recorrido por los momentos más importantes del año en que el canal estuvo ausente.",
      createdAt: new Date().toISOString(),
      completedAt: null,
      videos: initialVideos
    }],
    routine: defaultRoutine,
    streak: 1,
    notifications: false
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : defaultState();
}
let state = loadState();

const statusLabels = {
  idea: "Idea",
  recorded: "Grabado",
  edited: "Editado",
  ready: "Listo",
  published: "Publicado"
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}
function activeSeries() {
  return state.series.find(s => s.id === state.activeSeriesId) || state.series[0];
}
function nextOccurrence(item, from = new Date()) {
  const d = new Date(from);
  const diff = (item.day - from.getDay() + 7) % 7;
  d.setDate(from.getDate() + diff);
  d.setHours(item.hour, item.minute, 0, 0);
  if (d <= from) d.setDate(d.getDate() + 7);
  return d;
}
function getUpcomingSchedule(count = 4) {
  const now = new Date();
  const events = [];
  state.routine.forEach(item => {
    let date = nextOccurrence(item, now);
    for (let i=0; i<4; i++) {
      events.push({...item, date:new Date(date)});
      date.setDate(date.getDate()+7);
    }
  });
  return events.sort((a,b)=>a.date-b.date).slice(0,count);
}
function formatDate(d) {
  return new Intl.DateTimeFormat("es-PA", {
    weekday:"long", day:"numeric", month:"long", hour:"numeric", minute:"2-digit"
  }).format(d);
}
function render() {
  const series = activeSeries();
  const total = series.videos.length;
  const published = series.videos.filter(v => v.status === "published").length;
  const pending = total - published;
  document.getElementById("availableCount").textContent = total;
  document.getElementById("pendingCount").textContent = pending;
  document.getElementById("publishedCount").textContent = published;
  document.getElementById("streakCount").textContent = state.streak;

  document.getElementById("currentSeriesName").textContent = series.name;
  document.getElementById("seriesDescription").textContent = series.description || "Sin descripción.";
  const pct = total ? Math.round((published/total)*100) : 0;
  document.getElementById("progressBar").style.width = pct + "%";
  document.getElementById("progressText").textContent = `${published} de ${total} publicaciones completadas`;
  const complete = total > 0 && published === total;
  document.getElementById("seriesCompleteActions").classList.toggle("hidden", !complete);

  const nextVideo = series.videos.filter(v => v.status !== "published").sort((a,b)=>a.order-b.order)[0];
  const nextTask = getUpcomingSchedule(20).find(t => t.type.toLowerCase().includes("public")) || getUpcomingSchedule(1)[0];
  document.getElementById("nextTitle").textContent = nextVideo ? nextVideo.title : "Serie completada";
  document.getElementById("nextDate").textContent = nextVideo && nextTask ? formatDate(nextTask.date) : "¡Llegaste al final de esta serie!";
  document.getElementById("nextStatus").textContent = nextVideo ? statusLabels[nextVideo.status] : "Completado";
  document.getElementById("nextStatus").className = "pill " + (nextVideo ? "pending" : "published");

  renderSchedule();
  renderVideos();
  renderSeriesList();
  updateCountdown();
}
function renderSchedule() {
  const list = document.getElementById("scheduleList");
  list.innerHTML = "";
  getUpcomingSchedule(4).forEach(item => {
    const div = document.createElement("div");
    div.className = "schedule-item";
    div.innerHTML = `
      <div class="daybox">
        <strong>${item.date.toLocaleDateString("es-PA",{weekday:"short"}).replace(".","")}</strong>
        <span>${item.date.toLocaleTimeString("es-PA",{hour:"numeric",minute:"2-digit"})}</span>
      </div>
      <div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.type)} · ${item.date.toLocaleDateString("es-PA",{day:"numeric",month:"short"})}</p>
      </div>
      <button class="secondary small">Agregar al calendario</button>
    `;
    div.querySelector("button").onclick = () => downloadICS([item]);
    list.appendChild(div);
  });
}
function renderVideos() {
  const series = activeSeries();
  const filter = document.getElementById("filterSelect").value;
  const list = document.getElementById("videoList");
  list.innerHTML = "";
  series.videos
    .filter(v => filter === "all" || v.status === filter || (filter === "pending" && v.status !== "published"))
    .sort((a,b)=>a.order-b.order)
    .forEach(video => {
      const div = document.createElement("div");
      div.className = "video-item";
      div.innerHTML = `
        <div>
          <h3>${video.order}. ${escapeHtml(video.title)}</h3>
          <p>${statusLabels[video.status]}${video.notes ? " · " + escapeHtml(video.notes) : ""}</p>
        </div>
        <div class="video-actions">
          <select class="status-select">
            ${Object.entries(statusLabels).map(([value,label])=>`<option value="${value}" ${video.status===value?"selected":""}>${label}</option>`).join("")}
          </select>
          <button class="icon-btn edit-btn">Editar</button>
          <button class="icon-btn up-btn">↑</button>
          <button class="icon-btn down-btn">↓</button>
          <button class="icon-btn delete-btn">×</button>
        </div>
      `;
      div.querySelector(".status-select").onchange = e => {
        const wasPublished = video.status === "published";
        video.status = e.target.value;
        if (!wasPublished && video.status === "published") state.streak += 1;
        if (wasPublished && video.status !== "published") state.streak = Math.max(0,state.streak-1);
        saveState();
      };
      div.querySelector(".edit-btn").onclick = () => openVideoDialog(video);
      div.querySelector(".up-btn").onclick = () => moveVideo(video.id,-1);
      div.querySelector(".down-btn").onclick = () => moveVideo(video.id,1);
      div.querySelector(".delete-btn").onclick = () => {
        if (confirm("¿Eliminar este video?")) {
          series.videos = series.videos.filter(v=>v.id!==video.id);
          normalizeOrder(series.videos);
          saveState();
        }
      };
      list.appendChild(div);
    });
}
function normalizeOrder(videos) {
  videos.sort((a,b)=>a.order-b.order).forEach((v,i)=>v.order=i+1);
}
function moveVideo(id, direction) {
  const videos = activeSeries().videos.sort((a,b)=>a.order-b.order);
  const index = videos.findIndex(v=>v.id===id);
  const target = index + direction;
  if (target < 0 || target >= videos.length) return;
  [videos[index].order, videos[target].order] = [videos[target].order, videos[index].order];
  saveState();
}
function renderSeriesList() {
  const list = document.getElementById("seriesList");
  if (!list) return;
  list.innerHTML = "";
  state.series.forEach(series => {
    const published = series.videos.filter(v=>v.status==="published").length;
    const div = document.createElement("div");
    div.className = "series-item " + (series.id===state.activeSeriesId ? "active" : "");
    div.innerHTML = `
      <div>
        <strong>${escapeHtml(series.name)}</strong>
        <p class="muted">${published} de ${series.videos.length} publicados</p>
      </div>
      <button type="button" class="secondary small">${series.id===state.activeSeriesId ? "Actual" : "Activar"}</button>
    `;
    div.querySelector("button").onclick = () => { state.activeSeriesId = series.id; saveState(); };
    list.appendChild(div);
  });
}
function openVideoDialog(video=null) {
  document.getElementById("videoDialogTitle").textContent = video ? "Editar video" : "Agregar video";
  document.getElementById("editingVideoId").value = video?.id || "";
  document.getElementById("videoTitleInput").value = video?.title || "";
  document.getElementById("videoStatusInput").value = video?.status || "idea";
  document.getElementById("videoNotesInput").value = video?.notes || "";
  document.getElementById("videoDialog").showModal();
}
function saveVideo() {
  const series = activeSeries();
  const id = document.getElementById("editingVideoId").value;
  const title = document.getElementById("videoTitleInput").value.trim();
  if (!title) return;
  if (id) {
    const video = series.videos.find(v=>v.id===id);
    video.title = title;
    video.status = document.getElementById("videoStatusInput").value;
    video.notes = document.getElementById("videoNotesInput").value.trim();
  } else {
    series.videos.push({
      id:crypto.randomUUID(),
      title,
      status:document.getElementById("videoStatusInput").value,
      notes:document.getElementById("videoNotesInput").value.trim(),
      order:series.videos.length+1
    });
  }
  saveState();
}
function renderRoutineEditor() {
  const editor = document.getElementById("routineEditor");
  editor.innerHTML = "";
  state.routine.forEach(item => {
    const row = document.createElement("div");
    row.className = "routine-row";
    row.dataset.id = item.id;
    row.innerHTML = `
      <select class="day">
        ${["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map((d,i)=>`<option value="${i}" ${i===item.day?"selected":""}>${d}</option>`).join("")}
      </select>
      <input class="hour" type="number" min="0" max="23" value="${item.hour}">
      <input class="minute" type="number" min="0" max="59" step="5" value="${item.minute}">
      <input class="title wide" value="${escapeHtml(item.title)}">
      <button type="button" class="secondary remove">Eliminar</button>
    `;
    row.querySelector(".remove").onclick = () => row.remove();
    editor.appendChild(row);
  });
}
function collectRoutine() {
  const rows = [...document.querySelectorAll(".routine-row")];
  state.routine = rows.map(row => ({
    id: row.dataset.id || crypto.randomUUID(),
    day: Number(row.querySelector(".day").value),
    hour: Number(row.querySelector(".hour").value),
    minute: Number(row.querySelector(".minute").value),
    title: row.querySelector(".title").value.trim() || "Tarea de contenido",
    type: row.querySelector(".title").value.toLowerCase().includes("public") ? "Publicación" : "Preparación"
  }));
}
function updateCountdown() {
  const next = getUpcomingSchedule(1)[0];
  if (!next) {
    document.getElementById("countdown").textContent = "No hay tareas programadas.";
    return;
  }
  const ms = next.date - new Date();
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  document.getElementById("countdown").textContent = days>0 ?
    `Faltan ${days} días, ${hours} horas y ${mins} minutos` :
    `Faltan ${hours} horas y ${mins} minutos`;
}
function escapeHtml(str="") {
  return String(str).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function downloadICS(items) {
  const pad=n=>String(n).padStart(2,"0");
  const stamp=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  let content="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Manuelito Content//ES\r\n";
  items.forEach(item=>{
    const end=new Date(item.date.getTime()+30*60000);
    content+=`BEGIN:VEVENT\r\nUID:${crypto.randomUUID()}@manuelito-content\r\nDTSTART:${stamp(item.date)}\r\nDTEND:${stamp(end)}\r\nSUMMARY:${item.title}\r\nDESCRIPTION:Agenda de contenido de Manuelito\r\nBEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Recordatorio de contenido\r\nEND:VALARM\r\nEND:VEVENT\r\n`;
  });
  content+="END:VCALENDAR";
  const blob=new Blob([content],{type:"text/calendar"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download="agenda-manuelito.ics";a.click();
  URL.revokeObjectURL(url);
}

document.getElementById("markPublishedBtn").onclick = () => {
  const video = activeSeries().videos.filter(v=>v.status!=="published").sort((a,b)=>a.order-b.order)[0];
  if (!video) return alert("No quedan videos pendientes.");
  video.status = "published";
  state.streak += 1;
  saveState();
};
document.getElementById("notifyBtn").onclick = async () => {
  if (!("Notification" in window)) return alert("Este navegador no permite notificaciones.");
  const permission = await Notification.requestPermission();
  state.notifications = permission==="granted";
  saveState();
  if (permission==="granted") new Notification("Manuelito Content",{body:"Avisos activados. Exporta también la rutina al calendario.",icon:"icon-192.png"});
};
document.getElementById("filterSelect").onchange = renderVideos;
document.getElementById("addVideoBtn").onclick = () => openVideoDialog();
document.getElementById("videoForm").addEventListener("submit", saveVideo);
document.getElementById("seriesMenuBtn").onclick = () => { renderSeriesList(); document.getElementById("seriesDialog").showModal(); };
document.getElementById("newSeriesBtn").onclick = () => document.getElementById("seriesDialog").showModal();
document.getElementById("viewHistoryBtn").onclick = () => document.getElementById("seriesDialog").showModal();
document.getElementById("seriesForm").addEventListener("submit", e => {
  const name = document.getElementById("seriesNameInput").value.trim();
  if (!name) return;
  const id = crypto.randomUUID();
  state.series.push({
    id,
    name,
    description:document.getElementById("seriesDescriptionInput").value.trim(),
    createdAt:new Date().toISOString(),
    completedAt:null,
    videos:[]
  });
  state.activeSeriesId = id;
  document.getElementById("seriesNameInput").value="";
  document.getElementById("seriesDescriptionInput").value="";
  saveState();
});
document.getElementById("editRoutineBtn").onclick = () => {
  renderRoutineEditor();
  document.getElementById("routineDialog").showModal();
};
document.getElementById("addRoutineItemBtn").onclick = () => {
  const editor = document.getElementById("routineEditor");
  const row = document.createElement("div");
  row.className="routine-row";
  row.dataset.id=crypto.randomUUID();
  row.innerHTML=`
    <select class="day">${["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map((d,i)=>`<option value="${i}">${d}</option>`).join("")}</select>
    <input class="hour" type="number" min="0" max="23" value="19">
    <input class="minute" type="number" min="0" max="59" step="5" value="0">
    <input class="title wide" value="Publicar episodio de la serie">
    <button type="button" class="secondary remove">Eliminar</button>`;
  row.querySelector(".remove").onclick=()=>row.remove();
  editor.appendChild(row);
};
document.getElementById("routineForm").addEventListener("submit", () => {
  collectRoutine();
  saveState();
});
document.getElementById("exportCalendarBtn").onclick = () => downloadICS(getUpcomingSchedule(12));

let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault(); deferredPrompt=e;
  document.getElementById("installBtn").classList.remove("hidden");
});
document.getElementById("installBtn").onclick=async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt=null;
  document.getElementById("installBtn").classList.add("hidden");
};
if("serviceWorker" in navigator) navigator.serviceWorker.register("service-worker.js");
setInterval(updateCountdown,60000);
render();
