
const TARGET_STORAGE_KEY = "manuelito-content-v2";
const KNOWN_STORAGE_KEYS = [
  "manuelito-content-v1",
  "manuelito-content-v2",
  "manuelito-studio-v1",
  "manuelito-studio",
  "maless-studio",
  "maless-content-v1",
  "maless-content-v2"
];

function parseCandidate(key, raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;

    const series = Array.isArray(data.series) ? data.series : [];
    const videos = series.reduce((n, s) => n + (Array.isArray(s.videos) ? s.videos.length : 0), 0);
    const routine = Array.isArray(data.routine) ? data.routine.length : 0;

    // Recognize likely app data, while avoiding unrelated localStorage JSON.
    if (!series.length && !videos && !routine && data.streak === undefined) return null;

    return {
      key,
      raw,
      data,
      seriesCount: series.length,
      videoCount: videos,
      routineCount: routine,
      score: videos * 100 + series.length * 10 + routine
    };
  } catch {
    return null;
  }
}

function inspectAllStorage() {
  const candidates = [];
  const seen = new Set();

  for (const key of KNOWN_STORAGE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const c = parseCandidate(key, raw);
      if (c) candidates.push(c);
      seen.add(key);
    }
  }

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || seen.has(key)) continue;
    const raw = localStorage.getItem(key);
    const c = parseCandidate(key, raw);
    if (c) candidates.push(c);
  }

  return candidates.sort((a, b) => b.score - a.score);
}

const STORAGE_CANDIDATES = inspectAllStorage();
const TARGET_CANDIDATE = STORAGE_CANDIDATES.find(c => c.key === TARGET_STORAGE_KEY) || null;
const BEST_CANDIDATE = STORAGE_CANDIDATES[0] || null;
let PENDING_RECOVERY = null;

// Prefer richer historical data in memory, but never write automatically.
if (BEST_CANDIDATE && (!TARGET_CANDIDATE || BEST_CANDIDATE.score > TARGET_CANDIDATE.score)) {
  PENDING_RECOVERY = BEST_CANDIDATE;
}

const STORAGE_KEY=TARGET_STORAGE_KEY;
const VERSION=3;
const labels={idea:"Idea",recorded:"Grabado",edited:"Editado",ready:"Listo",published:"Publicado"};

function defaultState(){const id=crypto.randomUUID();return{schemaVersion:VERSION,activeSeriesId:id,series:[{id,name:"1 año en la vida de Manuelito",description:"Un recorrido por los momentos más importantes del año en que el canal estuvo ausente.",videos:[]}],routine:[],streak:0,notifications:false};}
function migrate(s){if(!s||typeof s!=="object")return defaultState();s.schemaVersion=VERSION;s.series=Array.isArray(s.series)?s.series:defaultState().series;s.routine=Array.isArray(s.routine)?s.routine:[];s.streak=Number(s.streak||0);s.series.forEach(x=>{x.videos=Array.isArray(x.videos)?x.videos:[];x.videos.forEach((v,i)=>{v.id=v.id||crypto.randomUUID();v.title=v.title||`Video ${i+1}`;v.status=v.status||"idea";v.notes=v.notes||"";v.order=Number(v.order||i+1);});});s.activeSeriesId=s.activeSeriesId||s.series[0]?.id;return s;}
function load(){
  try{
    if(PENDING_RECOVERY) return migrate(structuredClone(PENDING_RECOVERY.data));
    const x=localStorage.getItem(STORAGE_KEY);
    return x?migrate(JSON.parse(x)):defaultState();
  }catch{
    return defaultState();
  }
}
let state=load();
const $=id=>document.getElementById(id);
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state));render();}
function series(){return state.series.find(x=>x.id===state.activeSeriesId)||state.series[0];}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function normalize(v){v.sort((a,b)=>a.order-b.order).forEach((x,i)=>x.order=i+1);}
function nextDate(item,from=new Date()){const d=new Date(from),diff=(Number(item.day)-from.getDay()+7)%7;d.setDate(from.getDate()+diff);d.setHours(Number(item.hour),Number(item.minute),0,0);if(d<=from)d.setDate(d.getDate()+7);return d;}
function schedule(n=8){const now=new Date(),a=[];state.routine.forEach(i=>{let d=nextDate(i,now);for(let k=0;k<6;k++){a.push({...i,date:new Date(d)});d.setDate(d.getDate()+7);}});return a.sort((x,y)=>x.date-y.date).slice(0,n);}
function fmt(d){return new Intl.DateTimeFormat("es-PA",{weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit"}).format(d);}

function render(){
 const s=series(); if(!s)return; normalize(s.videos);
 const total=s.videos.length,pub=s.videos.filter(v=>v.status==="published").length,pend=total-pub,pct=total?Math.round(pub/total*100):0;
 $("availableCount").textContent=total;$("pendingCount").textContent=pend;$("publishedCount").textContent=pub;$("streakCount").textContent=state.streak;
 $("currentSeriesName").textContent=s.name;$("seriesDescription").textContent=s.description||"Sin descripción.";
 $("progressBar").style.width=pct+"%";$("progressText").textContent=`${pub} / ${total} publicados`;$("remainingText").textContent=`${pend} pendientes`;
 $("progressRing").style.setProperty("--pct",pct);$("ringText").textContent=pct+"%";
 const next=s.videos.find(v=>v.status!=="published"),task=schedule(20).find(t=>(t.type||"").toLowerCase().includes("public"))||schedule(1)[0];
 $("nextTitle").textContent=next?next.title:"Serie completada";$("nextDate").textContent=next&&task?fmt(task.date):"Ya puedes crear una nueva serie.";
 renderTasks();renderSeries();renderVideos();renderCalendar();countdown();
}
function renderTasks(){const e=$("scheduleList");e.innerHTML="";schedule(4).forEach(i=>{const r=document.createElement("div");r.className="task";r.innerHTML=`<div class="taskdate">${i.date.toLocaleDateString("es-PA",{weekday:"short"}).replace(".","")}<span>${i.date.toLocaleTimeString("es-PA",{hour:"numeric",minute:"2-digit"})}</span></div><div><h3>${esc(i.title)}</h3><p>${esc(i.type||"Tarea")}</p></div>`;e.appendChild(r);});if(!state.routine.length)e.innerHTML='<p class="muted">Aún no hay tareas en la rutina.</p>';}
function renderSeries(){const e=$("seriesCards");e.innerHTML="";state.series.forEach(s=>{const pub=s.videos.filter(v=>v.status==="published").length,total=s.videos.length,pct=total?Math.round(pub/total*100):0,c=document.createElement("article");c.className="seriescard "+(s.id===state.activeSeriesId?"active":"");c.innerHTML=`<h3>${esc(s.name)}</h3><p class="meta">${esc(s.description||"Sin descripción")}</p><div class="bar"><div style="width:${pct}%"></div></div><p class="meta">${pub}/${total} publicados</p><div class="rowactions"><button class="activate">${s.id===state.activeSeriesId?"Serie actual":"Activar"}</button></div>`;c.querySelector(".activate").onclick=()=>{state.activeSeriesId=s.id;save();};e.appendChild(c);});}
function renderVideos(){const s=series(),f=$("filterSelect").value,e=$("videoList");e.innerHTML="";s.videos.filter(v=>f==="all"||v.status===f).forEach(v=>{const c=document.createElement("article");c.className="videocard";c.innerHTML=`<h3>${esc(v.title)}</h3><p class="meta">${esc(v.notes||"Sin notas")}</p><div class="rowactions"><select class="status">${Object.entries(labels).map(([k,l])=>`<option value="${k}" ${v.status===k?"selected":""}>${l}</option>`).join("")}</select><button class="edit secondary">Editar</button><button class="delete secondary">Eliminar</button></div>`;c.querySelector(".status").onchange=x=>{const was=v.status==="published";v.status=x.target.value;if(!was&&v.status==="published")state.streak++;if(was&&v.status!=="published")state.streak=Math.max(0,state.streak-1);save();};c.querySelector(".edit").onclick=()=>openVideo(v);c.querySelector(".delete").onclick=()=>{if(confirm("¿Eliminar este video?")){s.videos=s.videos.filter(x=>x.id!==v.id);save();}};e.appendChild(c);});if(!s.videos.length)e.innerHTML='<p class="muted">Esta serie todavía no tiene videos.</p>';}
function renderCalendar(){const e=$("calendarList");e.innerHTML="";schedule(12).forEach(i=>{const c=document.createElement("article");c.className="calendarcard";c.innerHTML=`<div class="calday">${i.date.toLocaleDateString("es-PA",{day:"2-digit"})}<span>${i.date.toLocaleDateString("es-PA",{month:"short"})}</span></div><div><strong>${esc(i.title)}</strong><p class="meta">${fmt(i.date)}</p></div>`;e.appendChild(c);});}
function countdown(){const n=schedule(1)[0],e=$("countdown");if(!n){e.textContent="Configura tu rutina semanal.";return;}const ms=n.date-new Date(),d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000);e.textContent=d?`Faltan ${d} días, ${h} horas y ${m} minutos`:`Faltan ${h} horas y ${m} minutos`;}
function openVideo(v=null){$("videoDialogTitle").textContent=v?"Editar video":"Agregar video";$("editingVideoId").value=v?.id||"";$("videoTitleInput").value=v?.title||"";$("videoStatusInput").value=v?.status||"idea";$("videoNotesInput").value=v?.notes||"";$("videoDialog").showModal();}
function routineEditor(){const e=$("routineEditor");e.innerHTML="";state.routine.forEach(i=>{const r=document.createElement("div");r.className="routine";r.dataset.id=i.id;r.innerHTML=`<select class="day">${["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map((d,k)=>`<option value="${k}" ${k==i.day?"selected":""}>${d}</option>`).join("")}</select><input class="hour" type="number" min="0" max="23" value="${i.hour}"><input class="minute" type="number" min="0" max="59" value="${i.minute}"><input class="title wide" value="${esc(i.title)}"><button type="button" class="secondary remove">Eliminar</button>`;r.querySelector(".remove").onclick=()=>r.remove();e.appendChild(r);});}
function collectRoutine(){state.routine=[...document.querySelectorAll(".routine")].map(r=>({id:r.dataset.id||crypto.randomUUID(),day:Number(r.querySelector(".day").value),hour:Number(r.querySelector(".hour").value),minute:Number(r.querySelector(".minute").value),title:r.querySelector(".title").value.trim()||"Tarea de contenido",type:r.querySelector(".title").value.toLowerCase().includes("public")?"Publicación":"Preparación"}));}
function downloadICS(items){const pad=n=>String(n).padStart(2,"0"),stamp=d=>`${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;let c="BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Manuelito Studio//ES\r\n";items.forEach(i=>{const end=new Date(i.date.getTime()+1800000);c+=`BEGIN:VEVENT\r\nUID:${crypto.randomUUID()}@manuelito-studio\r\nDTSTART:${stamp(i.date)}\r\nDTEND:${stamp(end)}\r\nSUMMARY:${i.title}\r\nBEGIN:VALARM\r\nTRIGGER:-PT30M\r\nACTION:DISPLAY\r\nDESCRIPTION:Recordatorio de contenido\r\nEND:VALARM\r\nEND:VEVENT\r\n`;});c+="END:VCALENDAR";const b=new Blob([c],{type:"text/calendar"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="agenda-manuelito.ics";a.click();URL.revokeObjectURL(u);}

document.querySelectorAll(".bottomnav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".bottomnav button").forEach(x=>x.classList.remove("active"));document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));b.classList.add("active");$(b.dataset.view).classList.add("active");});
$("markPublishedBtn").onclick=()=>{const v=series().videos.find(x=>x.status!=="published");if(!v)return alert("No quedan videos pendientes.");v.status="published";state.streak++;save();};
$("quickIdeaBtn").onclick=()=>{const x=prompt("Escribe la idea:");if(!x)return;series().videos.push({id:crypto.randomUUID(),title:x,status:"idea",notes:"Idea rápida",order:series().videos.length+1});save();};
$("addVideoBtn").onclick=()=>openVideo();
$("videoForm").addEventListener("submit",()=>{const id=$("editingVideoId").value,title=$("videoTitleInput").value.trim(),s=series();if(!title)return;if(id){const v=s.videos.find(x=>x.id===id);v.title=title;v.status=$("videoStatusInput").value;v.notes=$("videoNotesInput").value.trim();}else s.videos.push({id:crypto.randomUUID(),title,status:$("videoStatusInput").value,notes:$("videoNotesInput").value.trim(),order:s.videos.length+1});save();});
$("newSeriesBtn").onclick=()=>$("seriesDialog").showModal();
$("seriesForm").addEventListener("submit",()=>{const name=$("seriesNameInput").value.trim();if(!name)return;const id=crypto.randomUUID();state.series.push({id,name,description:$("seriesDescriptionInput").value.trim(),videos:[]});state.activeSeriesId=id;save();});
$("openSeriesBtn").onclick=()=>document.querySelector('[data-view="seriesView"]').click();$("settingsSeries").onclick=()=>document.querySelector('[data-view="seriesView"]').click();
function openRoutine(){routineEditor();$("routineDialog").showModal();}$("editRoutineBtn").onclick=openRoutine;$("settingsRoutine").onclick=openRoutine;
$("addRoutineItemBtn").onclick=()=>{const e=$("routineEditor"),r=document.createElement("div");r.className="routine";r.dataset.id=crypto.randomUUID();r.innerHTML=`<select class="day">${["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"].map((d,k)=>`<option value="${k}">${d}</option>`).join("")}</select><input class="hour" type="number" value="19"><input class="minute" type="number" value="0"><input class="title wide" value="Publicar episodio"><button type="button" class="secondary remove">Eliminar</button>`;r.querySelector(".remove").onclick=()=>r.remove();e.appendChild(r);};
$("routineForm").addEventListener("submit",()=>{collectRoutine();save();});
$("filterSelect").onchange=renderVideos;$("exportCalendarBtn").onclick=()=>downloadICS(schedule(12));
$("notifyBtn").onclick=async()=>{if(!("Notification" in window))return alert("Este navegador no permite notificaciones.");state.notifications=await Notification.requestPermission()==="granted";save();};
$("backupBtn").onclick=()=>{const b=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download="manuelito-studio-respaldo.json";a.click();URL.revokeObjectURL(u);};
$("restoreInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=migrate(JSON.parse(r.result));save();alert("Respaldo restaurado.");}catch{alert("Archivo inválido.");}};r.readAsText(f);};
let deferredPrompt;window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredPrompt=e;$("installBtn").classList.remove("hidden");});$("installBtn").onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;};

function setupRecoveryPanel(){
  const panel=document.getElementById("recoveryPanel");
  const msg=document.getElementById("recoveryMessage");
  const restoreBtn=document.getElementById("restoreCandidateBtn");
  const downloadBtn=document.getElementById("downloadAllStorageBtn");

  if(PENDING_RECOVERY){
    panel.classList.remove("hidden");
    msg.textContent=`Encontré ${PENDING_RECOVERY.videoCount} videos y ${PENDING_RECOVERY.seriesCount} series en “${PENDING_RECOVERY.key}”. La app los muestra temporalmente, pero todavía no los ha sobrescrito ni movido.`;
    restoreBtn.onclick=()=>{
      const emergency={
        exportedAt:new Date().toISOString(),
        origin:location.origin,
        storage:Object.fromEntries(Array.from({length:localStorage.length},(_,i)=>{
          const k=localStorage.key(i); return [k,localStorage.getItem(k)];
        }))
      };
      const backupBlob=new Blob([JSON.stringify(emergency,null,2)],{type:"application/json"});
      const backupUrl=URL.createObjectURL(backupBlob);
      const a=document.createElement("a");
      a.href=backupUrl;a.download="respaldo-antes-de-recuperar.json";a.click();
      URL.revokeObjectURL(backupUrl);

      localStorage.setItem(TARGET_STORAGE_KEY,JSON.stringify(migrate(structuredClone(PENDING_RECOVERY.data))));
      alert("Información recuperada y respaldo de seguridad descargado.");
      location.reload();
    };
  }

  downloadBtn.onclick=()=>{
    const all={exportedAt:new Date().toISOString(),origin:location.origin,storage:{}};
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      all.storage[k]=localStorage.getItem(k);
    }
    const blob=new Blob([JSON.stringify(all,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="localstorage-completo-manuelito.json";a.click();
    URL.revokeObjectURL(url);
  };
}

if("serviceWorker" in navigator)navigator.serviceWorker.register("service-worker.js");
setupRecoveryPanel();setInterval(countdown,60000);render();