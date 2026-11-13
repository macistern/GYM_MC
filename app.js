const config = window.GYM_CONFIG || {};
const hasSupabase = Boolean(config.supabaseUrl && config.supabaseAnonKey);
const client = hasSupabase ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey) : null;
let currentUser = null;
let signInMode = false;
let exercises = [];
let workouts = [];
let routines = [];
let draft = [];
let draftNotes = "";
let editingRoutineId = null;
let catalogFilter = "Todos";
let editingWorkoutId = null;
let currentWorkoutGroup = null;
let pendingDraft = null;
let selectedProgressExercise = null;
let toastTimer = null;
let expandedExerciseHistory = false;
let draftWorkoutDate = null;

const starterExercises = [
  { name: "Pecho plano", muscle_group: "Pecho" },
  { name: "Pecho inclinado", muscle_group: "Pecho" },
  { name: "Pecho plano con mancuerna", muscle_group: "Pecho" },
  { name: "Pecho inclinado con mancuerna", muscle_group: "Pecho" },
  { name: "Apertura", muscle_group: "Pecho" },
  { name: "Fondos", muscle_group: "Pecho" },
  { name: "Sentadilla", muscle_group: "Piernas" },
  { name: "Isquios", muscle_group: "Piernas" },
  { name: "Cuadricep en camilla", muscle_group: "Piernas" },
  { name: "Peso Muerto", muscle_group: "Piernas" },
  { name: "Peso muerto rumano", muscle_group: "Piernas" }
];

const suggestedExercises = [
  ["Pecho", "Press de banca plano con barra", "Press inclinado con barra", "Press plano con mancuernas", "Press inclinado con mancuernas", "Press declinado", "Aperturas con mancuernas", "Aperturas en máquina (Peck Deck)", "Cruces de poleas", "Fondos en paralelas (pecho)", "Flexiones de brazos"],
  ["Espalda", "Dominadas", "Jalón al pecho", "Jalón tras nuca", "Remo con barra", "Remo con mancuerna a una mano", "Remo sentado en polea baja", "Remo en máquina", "Remo T", "Pullover en polea alta", "Peso muerto convencional"],
  ["Bíceps", "Curl con barra recta", "Curl con barra Z", "Curl alternado con mancuernas", "Curl martillo", "Curl concentrado", "Curl predicador (Scott)", "Curl inclinado con mancuernas", "Curl en polea baja", "Curl inverso con barra", "Curl araña (Spider Curl)"],
  ["Tríceps", "Press francés con barra Z", "Press francés con mancuernas", "Extensión de tríceps en polea alta", "Extensión con cuerda", "Extensión por encima de la cabeza", "Patada de tríceps", "Fondos en paralelas", "Fondos en banco", "Press de banca con agarre cerrado", "Extensión unilateral con mancuerna"],
  ["Hombros", "Press militar con barra", "Press militar con mancuernas", "Press Arnold", "Elevaciones laterales", "Elevaciones frontales", "Pájaros (elevaciones posteriores)", "Face Pull", "Reverse Peck Deck", "Remo al mentón", "Press de hombros en máquina"],
  ["Cuádriceps", "Sentadilla con barra", "Sentadilla frontal", "Sentadilla goblet", "Prensa de piernas", "Extensión de cuádriceps en máquina", "Sentadilla hack", "Sentadilla búlgara", "Estocadas hacia adelante", "Estocadas hacia atrás", "Step-ups (subidas al banco)"],
  ["Isquiotibiales", "Peso muerto rumano", "Peso muerto con piernas semirrígidas", "Curl femoral acostado", "Curl femoral sentado", "Curl femoral de pie", "Buenos días con barra", "Curl nórdico"],
  ["Glúteos", "Hip Thrust", "Puente de glúteos", "Sentadilla profunda", "Sentadilla búlgara", "Peso muerto rumano", "Patada de glúteos en polea", "Abducción de cadera en máquina", "Step-ups", "Estocadas largas", "Caminata lateral con banda"],
  ["Gemelos", "Elevaciones de talones de pie", "Elevaciones de talones sentado", "Gemelos en prensa", "Elevaciones de talones a una pierna", "Gemelos en máquina"],
  ["Core", "Crunch abdominal", "Crunch en polea", "Elevaciones de piernas", "Elevaciones de rodillas colgado", "Plancha frontal", "Plancha lateral", "Rueda abdominal", "Crunch inverso", "Dead Bug", "Pallof Press", "Bird Dog"]
].flatMap(([muscle_group, ...names]) => names.map(name => ({ name, muscle_group })));

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const uid = () => crypto.randomUUID();
const localKey = (name) => `fuerza:${currentUser?.id || "guest"}:${name}`;
const formatDate = (value = new Date(), withTime = false) => new Intl.DateTimeFormat("es-AR", withTime ? { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" } : { weekday: "long", day: "numeric", month: "long" }).format(new Date(value));
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const dateInputValue = (value = new Date()) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const pencilIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14.7 5.3 4 4M5 19l3.2-.7L19 7.5a2.8 2.8 0 0 0-4-4L4.2 14.3 3.5 18.5 5 19Z"/></svg>';
const trashIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16m-10 4v5m4-5v5M9 7l1-3h4l1 3m-9 0 1 13h10l1-13"/></svg>';

function setStatus(message = "Guardado en Supabase", isError = false) {
  const status = $("#sync-status");
  status.textContent = hasSupabase ? message : "Modo local";
  status.classList.toggle("error", isError);
}

function updateAuthCopy() {
  $(".auth-card h2").textContent = signInMode ? "Qué bueno verte" : "Creá tu cuenta";
  $(".auth-card .muted").textContent = signInMode ? "Ingresá para continuar tu entrenamiento." : "Usá tu email para guardar tu progreso.";
  $("#auth-form .primary").innerHTML = signInMode ? "Iniciar sesión <span>→</span>" : "Crear cuenta <span>→</span>";
  $(".switch-copy").innerHTML = signInMode ? '¿Todavía no tenés cuenta? <button id="switch-auth" class="text-button" type="button">Creala ahora</button>' : '¿Ya tenés cuenta? <button id="switch-auth" class="text-button" type="button">Iniciá sesión</button>';
  $("#switch-auth").onclick = () => { signInMode = !signInMode; updateAuthCopy(); };
}

async function showApp() {
  $("#auth-view").classList.add("hidden");
  $("#app-view").classList.remove("hidden");
  $("#user-email").textContent = currentUser.email;
  $("#today").textContent = formatDate().toUpperCase();
  await loadData();
}

function showView(name) {
  $("#workouts-view").classList.toggle("hidden", name !== "workouts");
  $("#routines-view").classList.toggle("hidden", name !== "routines");
  $("#exercises-view").classList.toggle("hidden", name !== "exercises");
  $("#progress-view").classList.toggle("hidden", name !== "progress");
  $$(".nav-tab").forEach(button => button.classList.toggle("active", button.dataset.view === name));
}

function draftStorageKey() { return localKey("workout-draft"); }

function updateWorkoutGroupCopy() {
  const button = $("#change-workout-group");
  button.textContent = currentWorkoutGroup ? `Grupo: ${currentWorkoutGroup} · Cambiar` : "Elegí un grupo muscular";
  $("#add-workout-exercise").textContent = "+ Agregar ejercicio";
}

function showSaveToast(message) {
  const toast = $("#save-toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 4500);
}

function persistDraft() {
  if (!currentUser || editingWorkoutId || !draft.length) return;
  localStorage.setItem(draftStorageKey(), JSON.stringify({ draft, notes: draftNotes, group: currentWorkoutGroup, workoutDate: draftWorkoutDate, updatedAt: new Date().toISOString() }));
}

function discardSavedDraft() {
  localStorage.removeItem(draftStorageKey());
  pendingDraft = null;
  $("#resume-draft").classList.add("hidden");
}

function showSavedDraft() {
  try { pendingDraft = JSON.parse(localStorage.getItem(draftStorageKey()) || "null"); } catch (_) { pendingDraft = null; }
  const valid = pendingDraft?.draft?.length;
  $("#resume-draft").classList.toggle("hidden", !valid);
  if (valid) {
    const sets = pendingDraft.draft.reduce((total, item) => total + item.blocks.reduce((sum, block) => sum + (Number(block.count) || 0), 0), 0);
    $("#resume-draft-copy").textContent = `${pendingDraft.group || "Entrenamiento"} · ${pendingDraft.draft.length} ejercicios · ${sets} series planificadas.`;
  }
}

function resumeSavedDraft() {
  if (!pendingDraft?.draft?.length) return;
  editingWorkoutId = null;
  draft = pendingDraft.draft;
  draftNotes = pendingDraft.notes || "";
  currentWorkoutGroup = pendingDraft.group || null;
  $("#draft-mode").textContent = "CONTINUAR ENTRENAMIENTO";
  $("#draft-date").textContent = formatDate(pendingDraft.updatedAt || new Date(), true);
  draftWorkoutDate = pendingDraft.workoutDate || dateInputValue();
  $("#workout-date").value = draftWorkoutDate;
  $("#workout-notes").value = draftNotes;
  $("#save-workout").innerHTML = "Guardar entrenamiento <span>→</span>";
  $("#cancel-workout").textContent = "Salir y guardar borrador";
  $("#workout-error").textContent = "";
  $("#workout-editor").classList.remove("hidden");
  $("#resume-draft").classList.add("hidden");
  updateWorkoutGroupCopy();
  renderDraft();
}

function renderProgress() {
  renderProgressRms();
  const groups = [...new Set(exercises.map(exercise => exercise.muscle_group))].sort((a, b) => a.localeCompare(b));
  const progress = new Map(groups.map(group => [group, { sets: 0, lastDate: null }]));
  workouts.forEach(workout => (workout.workout_sets || []).forEach(set => {
    const group = set.exercises?.muscle_group;
    if (!group) return;
    if (!progress.has(group)) progress.set(group, { sets: 0, lastDate: null });
    const item = progress.get(group);
    item.sets += 1;
    if (!item.lastDate || new Date(workout.created_at) > new Date(item.lastDate)) item.lastDate = workout.created_at;
  }));

  const ordered = [...progress.entries()].sort(([, first], [, second]) => {
    if (!first.lastDate && !second.lastDate) return 0;
    if (!first.lastDate) return -1;
    if (!second.lastDate) return 1;
    return new Date(first.lastDate) - new Date(second.lastDate);
  });
  const suggestion = ordered[0];
  const recommendation = $("#progress-recommendation");
  const list = $("#progress-groups");
  list.innerHTML = "";

  if (!suggestion) {
    recommendation.innerHTML = "<strong>Empezá por tu catálogo</strong><p>Agregá ejercicios para que podamos mostrar tu progreso por grupo muscular.</p>";
    return;
  }
  const [group, groupData] = suggestion;
  if (!groupData.lastDate) recommendation.innerHTML = `<strong>Podrías empezar con ${escapeHtml(group)}</strong><p>Todavía no registraste una sesión de este grupo muscular.</p>`;
  else {
    const days = Math.max(0, Math.floor((Date.now() - new Date(groupData.lastDate).getTime()) / 86400000));
    recommendation.innerHTML = `<strong>Hoy podrías entrenar ${escapeHtml(group)}</strong><p>Es el grupo que hace más tiempo no registrás: ${days === 0 ? "hoy" : `hace ${days} ${days === 1 ? "día" : "días"}`}.</p>`;
  }
  ordered.forEach(([name, data]) => {
    const row = document.createElement("article");
    row.className = "progress-group";
    row.innerHTML = `<div><h3>${escapeHtml(name)}</h3><p>${data.lastDate ? `Última vez: ${formatDate(data.lastDate)}` : "Todavía sin registros"}</p></div><div class="progress-value"><small>SERIES</small>${data.sets}</div><div class="progress-value"><small>ESTADO</small>${name === group ? "Siguiente" : "Al día"}</div><button class="text-button progress-open">Ver ejercicios</button>`;
    $(".progress-open", row).onclick = () => { catalogFilter = name; showView("exercises"); renderCatalog(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    list.append(row);
  });
}

function renderProgressRms() {
  const section = $("#progress-rms-section");
  const list = $("#progress-rms");
  const records = exercises.filter(exercise => exercise.real_rm !== null && exercise.real_rm !== undefined).sort((first, second) => Number(second.real_rm) - Number(first.real_rm));
  section.classList.toggle("hidden", !records.length);
  list.innerHTML = "";
  records.forEach(exercise => {
    const card = document.createElement("button");
    card.className = "progress-rm-card";
    card.innerHTML = `<span><small>${escapeHtml(exercise.muscle_group)}</small><strong>${escapeHtml(exercise.name)}</strong></span><b>${exercise.real_rm}<em> kg</em></b>`;
    card.onclick = () => openExerciseProgress(exercise);
    list.append(card);
  });
}

async function loadData() {
  setStatus("Sincronizando...");
  let syncError = false;
  if (hasSupabase) {
    const [exerciseResult, workoutResult, routineResult] = await Promise.all([
      client.from("exercises").select("id,name,muscle_group,real_rm,real_rm_date,created_at").eq("user_id", currentUser.id).order("name"),
      client.from("workouts").select("id,created_at,notes,workout_sets(id,exercise_id,set_number,weight,reps,completed,exercises(name,muscle_group))").eq("user_id", currentUser.id).order("created_at", { ascending: false }),
      client.from("routines").select("id,name,created_at,routine_items(id,exercise_id,position,blocks,exercises(name,muscle_group))").eq("user_id", currentUser.id).order("created_at", { ascending: false })
    ]);
    if (exerciseResult.error) { setStatus(`Error: ${exerciseResult.error.message}`, true); return; }
    if (workoutResult.error) { setStatus("Falta actualizar la base de datos", true); syncError = true; workouts = []; } else { workouts = workoutResult.data || []; }
    if (routineResult.error) { setStatus("Falta actualizar la base de datos para usar Rutinas", true); syncError = true; routines = []; } else routines = routineResult.data || [];
    exercises = exerciseResult.data || [];
  } else {
    exercises = JSON.parse(localStorage.getItem(localKey("exercises")) || "[]");
    workouts = JSON.parse(localStorage.getItem(localKey("workouts")) || "[]");
    routines = JSON.parse(localStorage.getItem(localKey("routines")) || "[]");
  }
  renderAll();
  showSavedDraft();
  if (!syncError) setStatus();
}

function saveLocal() {
  localStorage.setItem(localKey("exercises"), JSON.stringify(exercises));
  localStorage.setItem(localKey("workouts"), JSON.stringify(workouts));
  localStorage.setItem(localKey("routines"), JSON.stringify(routines));
}

function renderAll() {
  renderCatalog();
  renderWorkouts();
  renderProgress();
  renderRoutines();
}

function renderRoutines() {
  const list = $("#routines-list");
  list.innerHTML = "";
  $("#routines-empty").classList.toggle("hidden", routines.length > 0);
  routines.forEach(routine => {
    const items = routine.routine_items || routine.items || [];
    const card = document.createElement("article");
    card.className = "workout-card";
    card.innerHTML = `<div class="workout-summary"><div><p class="eyebrow">RUTINA</p><h3 class="workout-date">${escapeHtml(routine.name)}</h3><p class="workout-meta">${items.length} ejercicios preparados</p></div><div class="routine-actions"><button class="action-button routine-start">Entrenar <span>→</span></button><button class="icon-button edit-routine" aria-label="Editar rutina ${escapeHtml(routine.name)}" title="Editar rutina">${pencilIcon}</button><button class="icon-button destructive remove-routine" aria-label="Eliminar rutina ${escapeHtml(routine.name)}" title="Eliminar rutina">${trashIcon}</button></div></div>`;
    $(".routine-start", card).onclick = () => startRoutine(routine);
    $(".edit-routine", card).onclick = () => editRoutine(routine);
    $(".remove-routine", card).onclick = () => removeRoutine(routine.id);
    list.append(card);
  });
}

function startRoutine(routine) {
  const items = routine.routine_items || routine.items || [];
  const prepared = items.map(item => ({ exercise: item.exercises || item.exercise, blocks: JSON.parse(JSON.stringify(item.blocks || [])) })).filter(item => item.exercise);
  if (!prepared.length) return;
  draft = prepared;
  draft.forEach(item => item.blocks.forEach(block => { if (block.completed === undefined) block.completed = false; }));
  editingWorkoutId = null; editingRoutineId = null; draftNotes = ""; draftWorkoutDate = dateInputValue(); currentWorkoutGroup = draft[0].exercise.muscle_group;
  $("#draft-mode").textContent = `RUTINA · ${routine.name}`; $("#draft-date").textContent = formatDate(); $("#workout-date").value = draftWorkoutDate; $("#workout-notes").value = "";
  $("#save-workout").innerHTML = "Guardar entrenamiento <span>→</span>"; $("#cancel-workout").textContent = "Salir y guardar borrador"; $("#workout-editor").classList.remove("hidden"); showView("workouts"); updateWorkoutGroupCopy(); renderDraft(); window.scrollTo({ top: 0, behavior: "smooth" });
}

function editRoutine(routine) {
  const items = routine.routine_items || routine.items || [];
  draft = items.map(item => ({ exercise: item.exercises || item.exercise, blocks: JSON.parse(JSON.stringify(item.blocks || [])) })).filter(item => item.exercise);
  if (!draft.length) return;
  editingRoutineId = routine.id; editingWorkoutId = null; draftNotes = ""; draftWorkoutDate = dateInputValue(); currentWorkoutGroup = draft[0].exercise.muscle_group;
  $("#draft-mode").textContent = `EDITAR RUTINA · ${routine.name}`; $("#draft-date").textContent = "Modificá ejercicios y bloques"; $("#workout-date").value = draftWorkoutDate; $("#workout-date").closest("label").classList.add("hidden"); $("#workout-notes").closest("label").classList.add("hidden");
  $("#save-routine").textContent = "Guardar cambios de rutina"; $("#save-workout").classList.add("hidden"); $("#cancel-workout").textContent = "Cancelar edición"; $("#workout-editor").classList.remove("hidden"); showView("workouts"); updateWorkoutGroupCopy(); renderDraft(); window.scrollTo({ top: 0, behavior: "smooth" });
}

async function saveRoutine() {
  if (!draft.length) { $("#workout-error").textContent = "Agregá ejercicios antes de guardar una rutina."; return; }
  const currentRoutine = routines.find(routine => routine.id === editingRoutineId);
  const name = prompt("Nombre de la rutina:", currentRoutine?.name || "");
  if (!name?.trim()) return;
  const items = draft.map((item, position) => ({ exercise_id: item.exercise.id, position, blocks: item.blocks }));
  if (hasSupabase) {
    let routineId = editingRoutineId;
    if (routineId) {
      const { error } = await client.rpc("replace_routine_items", { p_routine_id: routineId, p_name: name.trim(), p_items: items });
      if (error) { $("#workout-error").textContent = error.message.includes("replace_routine_items") ? "Actualizá la base de datos con la última migración para editar rutinas." : error.message; return; }
    } else {
      const { data, error } = await client.from("routines").insert({ user_id: currentUser.id, name: name.trim() }).select().single();
      if (error) { $("#workout-error").textContent = error.message; return; }
      routineId = data.id;
      const { error: itemError } = await client.from("routine_items").insert(items.map(item => ({ ...item, routine_id: routineId })));
      if (itemError) { await client.from("routines").delete().eq("id", routineId); $("#workout-error").textContent = itemError.message; return; }
    }
  } else { const value = { id: editingRoutineId || uid(), name: name.trim(), created_at: new Date().toISOString(), items: draft.map(item => ({ exercise: item.exercise, blocks: JSON.parse(JSON.stringify(item.blocks)) })) }; if (editingRoutineId) routines = routines.map(routine => routine.id === editingRoutineId ? value : routine); else routines.unshift(value); saveLocal(); }
  if (hasSupabase) await loadData(); else renderRoutines();
  editingRoutineId = null; $("#workout-editor").classList.add("hidden"); $("#save-workout").classList.remove("hidden"); $("#save-routine").textContent = "Guardar como rutina"; $("#workout-date").closest("label").classList.remove("hidden"); $("#workout-notes").closest("label").classList.remove("hidden"); showSaveToast("Rutina guardada");
}

async function removeRoutine(id) {
  if (!confirm("¿Eliminar esta rutina?")) return;
  if (hasSupabase) { const { error } = await client.from("routines").delete().eq("id", id); if (error) { alert(error.message); return; } } else { routines = routines.filter(routine => routine.id !== id); saveLocal(); }
  if (hasSupabase) await loadData(); else renderRoutines();
}

function renderCatalog() {
  const list = $("#catalog-list");
  const filters = $("#catalog-filters");
  const groups = [...new Set(exercises.map(exercise => exercise.muscle_group))].sort((a, b) => a.localeCompare(b));
  if (!groups.includes(catalogFilter) && catalogFilter !== "Todos") catalogFilter = "Todos";

  filters.innerHTML = "";
  ["Todos", ...groups].forEach(group => {
    const button = document.createElement("button");
    button.className = `catalog-filter${catalogFilter === group ? " active" : ""}`;
    button.textContent = group;
    button.onclick = () => { catalogFilter = group; renderCatalog(); };
    filters.append(button);
  });

  const visibleExercises = catalogFilter === "Todos" ? exercises : exercises.filter(exercise => exercise.muscle_group === catalogFilter);
  list.innerHTML = "";
  $("#catalog-empty").classList.toggle("hidden", visibleExercises.length > 0);
  $("#catalog-empty h3").textContent = exercises.length ? `No tenés ejercicios de ${catalogFilter}` : "No tenés ejercicios";
  $("#catalog-empty p").textContent = exercises.length ? "Probá con otro grupo muscular o agregá un ejercicio nuevo." : "Agregá el primero para poder registrar un entrenamiento.";

  groups.filter(group => catalogFilter === "Todos" || group === catalogFilter).forEach(group => {
    const groupExercises = exercises.filter(exercise => exercise.muscle_group === group);
    const section = document.createElement("section");
    section.className = "exercise-group";
    section.innerHTML = `<div class="exercise-group-head"><h3>${escapeHtml(group)}</h3><span>${groupExercises.length} ${groupExercises.length === 1 ? "ejercicio" : "ejercicios"}</span></div>`;
    groupExercises.forEach(exercise => {
      const row = document.createElement("article");
      row.className = "exercise-row";
      row.innerHTML = `<h4>${escapeHtml(exercise.name)}</h4><div class="exercise-row-actions"><button class="quiet-action exercise-progress-button">Ver progreso</button><button class="icon-button destructive remove-catalog-exercise" aria-label="Eliminar ${escapeHtml(exercise.name)}" title="Eliminar ejercicio">${trashIcon}</button></div>`;
      $(".exercise-progress-button", row).onclick = () => openExerciseProgress(exercise);
      $(".remove-catalog-exercise", row).onclick = () => removeExercise(exercise.id);
      section.append(row);
    });
    list.append(section);
  });
}

function openExerciseProgress(exercise) {
  selectedProgressExercise = exercise;
  expandedExerciseHistory = false;
  $("#progress-exercise-muscle").textContent = exercise.muscle_group;
  $("#progress-exercise-name").textContent = exercise.name;
  $("#real-rm-value").textContent = exercise.real_rm === null || exercise.real_rm === undefined ? "Sin registrar" : `${exercise.real_rm} kg`;
  $("#real-rm-date").textContent = exercise.real_rm_date ? `Registrado manualmente el ${formatDate(`${exercise.real_rm_date}T12:00:00`)}` : "Cargalo sólo si realizaste una repetición máxima real.";
  $("#edit-rm-button").textContent = exercise.real_rm === null || exercise.real_rm === undefined ? "Registrar RM real" : "Actualizar RM real";
  $("#real-rm-form").classList.add("hidden");
  $("#real-rm-input").value = exercise.real_rm ?? "";
  $("#real-rm-date-input").value = exercise.real_rm_date || new Date().toISOString().slice(0, 10);
  renderExerciseHistory();
  const modal = $("#exercise-progress-modal");
  if (!modal.open) modal.showModal();
}

function renderExerciseHistory() {
  if (!selectedProgressExercise) return;
  const history = $("#exercise-progress-history");
  const exerciseWorkouts = workouts.map(workout => ({ workout, sets: (workout.workout_sets || []).filter(set => set.exercise_id === selectedProgressExercise.id) })).filter(item => item.sets.length);
  history.innerHTML = "";
  if (!exerciseWorkouts.length) history.innerHTML = '<p class="muted">Todavía no registraste series para este ejercicio.</p>';
  const visibleSessions = expandedExerciseHistory ? exerciseWorkouts : exerciseWorkouts.slice(0, 3);
  visibleSessions.forEach(({ workout, sets }) => {
    const day = document.createElement("article");
    day.className = "exercise-progress-day";
    day.innerHTML = `<h3>${formatDate(workout.created_at, true)}</h3>${sets.sort((a, b) => a.set_number - b.set_number).map(set => `<span class="exercise-progress-set">${set.set_number}. ${set.weight} kg × ${set.reps}</span>`).join("")}`;
    history.append(day);
  });
  if (exerciseWorkouts.length > 3) {
    const more = document.createElement("button");
    more.className = "text-button history-more";
    more.textContent = expandedExerciseHistory ? "Ver sólo las últimas 3 sesiones" : `Ver ${exerciseWorkouts.length - 3} sesiones anteriores`;
    more.onclick = () => { expandedExerciseHistory = !expandedExerciseHistory; renderExerciseHistory(); };
    history.append(more);
  }
}

async function saveRealRm(event) {
  event.preventDefault();
  if (!selectedProgressExercise) return;
  const value = $("#real-rm-input").value;
  const date = $("#real-rm-date-input").value;
  if (value === "" || Number(value) < 0) return;
  const update = { real_rm: Number(value), real_rm_date: date || null };
  if (hasSupabase) {
    const { error } = await client.from("exercises").update(update).eq("id", selectedProgressExercise.id);
    if (error) { alert("No se pudo guardar el RM. Verificá que hayas ejecutado la migración de Supabase."); return; }
  }
  Object.assign(selectedProgressExercise, update);
  const current = exercises.find(exercise => exercise.id === selectedProgressExercise.id);
  if (current) Object.assign(current, update);
  if (!hasSupabase) saveLocal();
  renderCatalog();
  $("#real-rm-form").classList.add("hidden");
  $("#edit-rm-button").focus();
  openExerciseProgress(selectedProgressExercise);
  showSaveToast("RM real guardado");
}

function renderWorkouts() {
  const list = $("#workouts-list");
  list.innerHTML = "";
  $("#workouts-empty").classList.toggle("hidden", workouts.length > 0);
  workouts.forEach(workout => {
    const sets = workout.workout_sets || [];
    const exerciseGroups = Object.values(sets.reduce((groups, set) => {
      const key = set.exercise_id;
      if (!groups[key]) groups[key] = { name: set.exercises?.name || "Ejercicio", sets: [] };
      groups[key].sets.push(set);
      return groups;
    }, {}));
    const totalReps = sets.reduce((sum, set) => sum + Number(set.reps), 0);
    const card = document.createElement("article");
    card.className = "workout-card";
    card.innerHTML = `<div class="workout-summary"><div><h3 class="workout-date">${formatDate(workout.created_at, true)}</h3><p class="workout-meta">${exerciseGroups.length} ejercicios · ${sets.length} series · ${totalReps} reps</p>${workout.notes ? `<p class="workout-note">${escapeHtml(workout.notes)}</p>` : ""}</div><div class="workout-card-actions"><button class="icon-button edit-workout" aria-label="Editar entrenamiento del ${formatDate(workout.created_at)}" title="Editar entrenamiento">${pencilIcon}</button><button class="icon-button destructive delete-workout" aria-label="Eliminar entrenamiento del ${formatDate(workout.created_at)}" title="Eliminar entrenamiento">${trashIcon}</button></div></div><div class="workout-details"></div>`;
    $(".edit-workout", card).onclick = () => editWorkout(workout);
    $(".delete-workout", card).onclick = () => deleteWorkout(workout);
    const details = $(".workout-details", card);
    exerciseGroups.forEach(group => {
      const row = document.createElement("div");
      row.className = "history-exercise";
      row.innerHTML = `<h4>${escapeHtml(group.name)}</h4>${group.sets.sort((a,b) => a.set_number - b.set_number).map(set => `<span class="history-set">${set.set_number}. ${set.weight} kg × ${set.reps}</span>`).join("")}`;
      details.append(row);
    });
    list.append(card);
  });
}

async function deleteWorkout(workout) {
  const label = formatDate(workout.created_at, true);
  if (!confirm(`¿Eliminar el entrenamiento del ${label}? Esta acción no se puede deshacer.`)) return;
  if (hasSupabase) {
    const { error } = await client.from("workouts").delete().eq("id", workout.id);
    if (error) { setStatus("No se pudo eliminar", true); alert(error.message); return; }
    await loadData();
  } else {
    workouts = workouts.filter(item => item.id !== workout.id);
    saveLocal();
    renderAll();
  }
  showSaveToast("Entrenamiento eliminado");
}

function startWorkout() {
  if (pendingDraft?.draft?.length) { $("#draft-choice-modal").showModal(); return; }
  openFreshWorkout();
}

function openFreshWorkout() {
  editingWorkoutId = null;
  editingRoutineId = null;
  draft = [];
  draftNotes = "";
  currentWorkoutGroup = null;
  draftWorkoutDate = dateInputValue();
  $("#draft-mode").textContent = "NUEVO ENTRENAMIENTO";
  $("#draft-date").textContent = formatDate(new Date(), true);
  $("#workout-date").value = draftWorkoutDate;
  $("#workout-notes").value = "";
  $("#workout-date").closest("label").classList.remove("hidden");
  $("#workout-notes").closest("label").classList.remove("hidden");
  $("#save-workout").classList.remove("hidden");
  $("#save-routine").textContent = "Guardar como rutina";
  $("#save-workout").innerHTML = "Guardar entrenamiento <span>→</span>";
  $("#workout-error").textContent = "";
  $("#workout-editor").classList.remove("hidden");
  updateWorkoutGroupCopy();
  renderDraft();
  chooseMuscle();
}

function editWorkout(workout) {
  editingWorkoutId = workout.id;
  const groups = new Map();
  (workout.workout_sets || []).slice().sort((a, b) => a.set_number - b.set_number).forEach(set => {
    if (!groups.has(set.exercise_id)) groups.set(set.exercise_id, { exercise: { id: set.exercise_id, name: set.exercises?.name || "Ejercicio", muscle_group: set.exercises?.muscle_group || "Otro" }, blocks: [] });
    const item = groups.get(set.exercise_id);
    const lastBlock = item.blocks[item.blocks.length - 1];
    if (lastBlock && lastBlock.weight === Number(set.weight) && lastBlock.reps === Number(set.reps) && lastBlock.completed === (set.completed !== false)) lastBlock.count += 1;
    else item.blocks.push({ count: 1, weight: Number(set.weight), reps: Number(set.reps), completed: set.completed !== false });
  });
  draft = [...groups.values()];
  currentWorkoutGroup = draft[0]?.exercise?.muscle_group || null;
  draftWorkoutDate = dateInputValue(workout.created_at);
  draftNotes = workout.notes || "";
  $("#draft-mode").textContent = "EDITAR ENTRENAMIENTO";
  $("#draft-date").textContent = formatDate(workout.created_at, true);
  $("#workout-date").value = draftWorkoutDate;
  $("#workout-notes").value = draftNotes;
  $("#save-workout").innerHTML = "Guardar cambios <span>→</span>";
  $("#cancel-workout").textContent = "Cancelar edición";
  $("#workout-error").textContent = "";
  $("#workout-editor").classList.remove("hidden");
  updateWorkoutGroupCopy();
  renderDraft();
  $("#workout-editor").scrollIntoView({ behavior: "smooth", block: "start" });
}

function chooseMuscle() {
  const options = $("#muscle-options");
  const groups = [...new Set(exercises.map(exercise => exercise.muscle_group))].sort((a, b) => a.localeCompare(b));
  if (!groups.length) { $("#exercise-modal").showModal(); return; }
  options.innerHTML = "";
  groups.forEach(group => {
    const count = exercises.filter(exercise => exercise.muscle_group === group).length;
    const button = document.createElement("button");
    button.className = "exercise-option";
    button.innerHTML = `${escapeHtml(group)}<small>${count} ${count === 1 ? "ejercicio" : "ejercicios"}</small>`;
    button.onclick = () => { currentWorkoutGroup = group; $("#choose-muscle-modal").close(); updateWorkoutGroupCopy(); chooseExercise(); };
    options.append(button);
  });
  if (!options.children.length) options.innerHTML = '<p class="muted">Primero agregá ejercicios a tu catálogo.</p>';
  $("#choose-muscle-modal").showModal();
}

function expandDraftSets() {
  return draft.flatMap(item => {
    let setNumber = 0;
    return item.blocks.flatMap(block => Array.from({ length: Number(block.count) }, () => ({ exercise_id: item.exercise.id, set_number: ++setNumber, weight: Number(block.weight), reps: Number(block.reps), completed: true, exercises: { name: item.exercise.name, muscle_group: item.exercise.muscle_group } })));
  });
}

function getLastExerciseValues(exerciseId) {
  for (const workout of workouts) { const set = (workout.workout_sets || []).filter(item => item.exercise_id === exerciseId && item.completed !== false).sort((a, b) => b.set_number - a.set_number)[0]; if (set) return set; }
  return null;
}

function chooseExercise(allowAllGroups = false) {
  if (!exercises.length) { $("#exercise-modal").showModal(); return; }
  const options = $("#exercise-options");
  options.innerHTML = "";
  exercises.filter(exercise => (allowAllGroups || !currentWorkoutGroup || exercise.muscle_group === currentWorkoutGroup) && !draft.some(item => item.exercise.id === exercise.id)).forEach(exercise => {
    const button = document.createElement("button");
    button.className = "exercise-option";
    button.innerHTML = `${escapeHtml(exercise.name)}<small>${escapeHtml(exercise.muscle_group)}</small>`;
    button.onclick = () => { const last = getLastExerciseValues(exercise.id); draft.push({ exercise, blocks: [{ count: 1, weight: last?.weight ?? "", reps: last?.reps ?? "", completed: false }] }); $("#choose-exercise-modal").close(); renderDraft(); };
    options.append(button);
  });
  if (!options.children.length) options.innerHTML = `<p class="muted">No hay más ejercicios disponibles${!allowAllGroups && currentWorkoutGroup ? ` en ${escapeHtml(currentWorkoutGroup)}` : ""}.</p>`;
  $("#choose-exercise-modal").showModal();
}

function renderDraft() {
  const container = $("#draft-exercises");
  container.innerHTML = "";
  draft.forEach((item, exerciseIndex) => {
    const node = $("#draft-exercise-template").content.cloneNode(true);
    const card = $(".draft-card", node);
    $(".muscle", node).textContent = item.exercise.muscle_group;
    $("h3", node).textContent = item.exercise.name;
    $(".remove-draft-exercise", node).onclick = () => { draft.splice(exerciseIndex, 1); renderDraft(); persistDraft(); };
    const totalSets = item.blocks.reduce((sum, block) => sum + (Number(block.count) || 0), 0);
    $(".draft-series-total", node).textContent = `${totalSets} ${totalSets === 1 ? "serie planificada" : "series planificadas"}`;
    $(".add-draft-block", node).onclick = () => { const previous = item.blocks.at(-1); item.blocks.push(previous ? { ...previous, completed: false } : { count: 1, weight: "", reps: "", completed: false }); renderDraft(); persistDraft(); };
    const blockList = $(".draft-block-list", node);
    item.blocks.forEach((block, blockIndex) => {
      const row = document.createElement("div");
      row.className = "draft-block-row";
      row.innerHTML = `<input type="number" min="1" step="1" inputmode="numeric" placeholder="1" value="${block.count}" aria-label="Cantidad de series del bloque ${blockIndex + 1}"><input type="number" min="1" step="1" inputmode="numeric" placeholder="0" value="${block.reps}" aria-label="Repeticiones del bloque ${blockIndex + 1}"><input type="number" min="0" step="0.5" inputmode="decimal" placeholder="0" value="${block.weight}" aria-label="Peso del bloque ${blockIndex + 1}"><button class="remove-draft-block" aria-label="Eliminar bloque">×</button>`;
      const [countInput, repsInput, weightInput] = $$("input", row);
      const clearInvalid = input => input.classList.remove("invalid");
      countInput.oninput = () => { block.count = countInput.value; clearInvalid(countInput); updateDraftTotal(item, card); persistDraft(); };
      repsInput.oninput = () => { block.reps = repsInput.value; clearInvalid(repsInput); persistDraft(); };
      weightInput.oninput = () => { block.weight = weightInput.value; clearInvalid(weightInput); persistDraft(); };
      $(".remove-draft-block", row).onclick = () => { if (item.blocks.length > 1) { item.blocks.splice(blockIndex, 1); renderDraft(); persistDraft(); } };
      blockList.append(row);
    });
    container.append(node);
  });
  persistDraft();
}

function updateDraftTotal(item, node) {
  const totalSets = item.blocks.reduce((sum, block) => sum + (Number(block.count) || 0), 0);
  $(".draft-series-total", node).textContent = `${totalSets} ${totalSets === 1 ? "serie planificada" : "series planificadas"}`;
}

async function saveWorkout() {
  const errorNode = $("#workout-error");
  errorNode.textContent = "";
  if (!draft.length) { errorNode.textContent = "Agregá al menos un ejercicio."; return; }
  let firstInvalid = null;
  $$(".draft-block-row").forEach((row, rowIndex) => {
    const item = draft.flatMap(entry => entry.blocks).at(rowIndex);
    const inputs = $$("input", row);
    const invalidFields = [item.count === "" || !Number.isInteger(Number(item.count)) || Number(item.count) < 1, item.reps === "" || Number(item.reps) < 1, item.weight === "" || Number(item.weight) < 0];
    inputs.forEach((input, index) => { input.classList.toggle("invalid", invalidFields[index]); if (invalidFields[index] && !firstInvalid) firstInvalid = input; });
  });
  if (firstInvalid) { errorNode.textContent = "Revisá los campos marcados en rojo antes de guardar."; firstInvalid.focus(); return; }
  $("#save-workout").disabled = true;
  setStatus("Guardando...");
  const expandedSets = expandDraftSets();
  const savedExerciseCount = draft.length;
  const wasEditing = Boolean(editingWorkoutId);
  draftNotes = $("#workout-notes").value.trim();
  const workoutTimestamp = new Date(`${draftWorkoutDate || dateInputValue()}T12:00:00`).toISOString();
  if (hasSupabase) {
    let workoutId = editingWorkoutId;
    const isEditing = Boolean(editingWorkoutId);
    if (!editingWorkoutId) {
      const workoutResult = await client.from("workouts").insert({ user_id: currentUser.id, created_at: workoutTimestamp, notes: draftNotes || null }).select().single();
      if (workoutResult.error) { errorNode.textContent = workoutResult.error.message; setStatus("Error al guardar", true); $("#save-workout").disabled = false; return; }
      workoutId = workoutResult.data.id;
    }
    const rows = expandedSets.map(set => ({ workout_id: workoutId, exercise_id: set.exercise_id, set_number: set.set_number, weight: set.weight, reps: set.reps, completed: set.completed }));
    const setsResult = await client.rpc("replace_workout_sets", { p_workout_id: workoutId, p_sets: rows.map(({ exercise_id, set_number, weight, reps, completed }) => ({ exercise_id, set_number, weight, reps, completed })), p_created_at: workoutTimestamp, p_notes: draftNotes || null });
    if (setsResult.error) {
      if (!isEditing) await client.from("workouts").delete().eq("id", workoutId);
      errorNode.textContent = setsResult.error.message.includes("replace_workout_sets") ? "Actualizá la base de datos con la nueva migración para guardar entrenamientos." : setsResult.error.message;
      setStatus("Error al guardar", true);
      $("#save-workout").disabled = false;
      return;
    }
  } else {
    const createdAt = workoutTimestamp;
    const workoutSets = expandedSets.map(set => ({ ...set, id: uid() }));
    if (editingWorkoutId) {
      const workoutIndex = workouts.findIndex(workout => workout.id === editingWorkoutId);
      workouts[workoutIndex] = { ...workouts[workoutIndex], created_at: createdAt, notes: draftNotes, workout_sets: workoutSets };
    } else workouts.unshift({ id: uid(), created_at: createdAt, notes: draftNotes, workout_sets: workoutSets });
    saveLocal();
  }
  $("#save-workout").disabled = false;
  $("#workout-editor").classList.add("hidden");
  draft = [];
  editingWorkoutId = null;
  discardSavedDraft();
  if (hasSupabase) await loadData(); else renderAll();
  setStatus();
  showSaveToast(wasEditing ? `Cambios guardados · ${savedExerciseCount} ejercicios · ${expandedSets.length} series` : `Entrenamiento guardado · ${savedExerciseCount} ejercicios · ${expandedSets.length} series`);
}

async function addExercise(name, muscleGroup) {
  const errorNode = $("#exercise-error");
  errorNode.textContent = "";
  let exercise = { id: uid(), name, muscle_group: muscleGroup, created_at: new Date().toISOString() };
  if (hasSupabase) {
    const { data, error } = await client.from("exercises").insert({ user_id: currentUser.id, name, muscle_group: muscleGroup }).select().single();
    if (error) { errorNode.textContent = error.message; return false; }
    exercise = data;
  }
  exercises.push(exercise);
  exercises.sort((a, b) => a.name.localeCompare(b.name));
  if (!hasSupabase) saveLocal();
  renderCatalog();
  return true;
}

function normalizedExerciseName(name) { return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }

async function loadSuggestedExercises() {
  const existing = new Set(exercises.map(exercise => normalizedExerciseName(exercise.name)));
  const missing = suggestedExercises.filter(exercise => !existing.has(normalizedExerciseName(exercise.name)));
  if (!missing.length) { showSaveToast("Ya tenés todos los ejercicios sugeridos"); return; }
  $("#load-suggested-exercises").disabled = true;
  if (hasSupabase) {
    const { data, error } = await client.from("exercises").insert(missing.map(exercise => ({ ...exercise, user_id: currentUser.id }))).select();
    if (error) { alert(error.message); $("#load-suggested-exercises").disabled = false; return; }
    exercises.push(...(data || []));
  } else {
    exercises.push(...missing.map(exercise => ({ ...exercise, id: uid(), created_at: new Date().toISOString() })));
    saveLocal();
  }
  exercises.sort((first, second) => first.name.localeCompare(second.name));
  renderAll();
  $("#load-suggested-exercises").disabled = false;
  showSaveToast(`${missing.length} ejercicios agregados`);
}

async function removeExercise(id) {
  if (!confirm("¿Eliminar este ejercicio del catálogo? Los entrenamientos anteriores se conservarán.")) return;
  if (hasSupabase) {
    const { error } = await client.from("exercises").delete().eq("id", id);
    if (error) { alert("No se puede eliminar porque ya está usado en un entrenamiento."); return; }
  }
  exercises = exercises.filter(exercise => exercise.id !== id);
  if (!hasSupabase) saveLocal();
  renderCatalog();
}

async function resetToStarterTemplate() {
  const confirmed = confirm("Esto elimina todos tus entrenamientos y ejercicios actuales. Después crea la plantilla de Pecho y Piernas. ¿Querés continuar?");
  if (!confirmed) return;

  setStatus("Reiniciando...");
  if (hasSupabase) {
    const routinesResult = await client.from("routines").delete().eq("user_id", currentUser.id);
    if (routinesResult.error) { setStatus(`Error: ${routinesResult.error.message}`, true); return; }
    const workoutsResult = await client.from("workouts").delete().eq("user_id", currentUser.id);
    if (workoutsResult.error) { setStatus(`Error: ${workoutsResult.error.message}`, true); return; }
    const exercisesResult = await client.from("exercises").delete().eq("user_id", currentUser.id);
    if (exercisesResult.error) { setStatus(`Error: ${exercisesResult.error.message}`, true); return; }
    const insertResult = await client.from("exercises").insert(starterExercises.map(exercise => ({ ...exercise, user_id: currentUser.id }))).select();
    if (insertResult.error) { setStatus(`Error: ${insertResult.error.message}`, true); return; }
    exercises = insertResult.data || [];
    workouts = [];
    routines = [];
  } else {
    workouts = [];
    routines = [];
    exercises = starterExercises.map(exercise => ({ ...exercise, id: uid(), created_at: new Date().toISOString() }));
    saveLocal();
  }

  draft = [];
  discardSavedDraft();
  $("#workout-editor").classList.add("hidden");
  renderAll();
  setStatus("Plantilla lista");
}

updateAuthCopy();
$("#auth-form").onsubmit = async event => {
  event.preventDefault();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  const message = $("#auth-message");
  message.textContent = "";
  if (hasSupabase) {
    const result = signInMode ? await client.auth.signInWithPassword({ email, password }) : await client.auth.signUp({ email, password });
    if (result.error) { message.textContent = result.error.message; return; }
    if (!result.data.session) { message.textContent = "Revisá tu email para confirmar la cuenta."; return; }
    currentUser = result.data.user;
  } else {
    currentUser = { id: email.toLowerCase(), email };
    localStorage.setItem("fuerza:session", JSON.stringify(currentUser));
  }
  await showApp();
};

$$(".nav-tab").forEach(button => button.onclick = () => showView(button.dataset.view));
$("#new-workout").onclick = startWorkout;
$$(".start-workout").forEach(button => button.onclick = startWorkout);
$("#cancel-workout").onclick = () => {
  const keepsDraft = !editingWorkoutId && !editingRoutineId && draft.length;
  if (keepsDraft) persistDraft();
  draft = [];
  editingWorkoutId = null;
  editingRoutineId = null;
  currentWorkoutGroup = null;
  $("#workout-editor").classList.add("hidden");
  $("#save-workout").classList.remove("hidden");
  $("#save-routine").textContent = "Guardar como rutina";
  $("#workout-date").closest("label").classList.remove("hidden");
  $("#workout-notes").closest("label").classList.remove("hidden");
  if (keepsDraft) { showSavedDraft(); showSaveToast("Borrador guardado para continuar después"); }
};
$("#add-workout-exercise").onclick = chooseMuscle;
$("#save-routine").onclick = saveRoutine;
$("#change-workout-group").onclick = chooseMuscle;
$("#workout-date").onchange = event => { draftWorkoutDate = event.target.value; $("#draft-date").textContent = formatDate(`${draftWorkoutDate}T12:00:00`); persistDraft(); };
$("#workout-notes").oninput = event => { draftNotes = event.target.value; persistDraft(); };
$("#save-workout").onclick = saveWorkout;
$("#new-exercise").onclick = () => $("#exercise-modal").showModal();
$("#load-suggested-exercises").onclick = loadSuggestedExercises;
$("#reset-template").onclick = resetToStarterTemplate;
$("#resume-draft-button").onclick = resumeSavedDraft;
$("#discard-draft").onclick = () => { if (confirm("¿Descartar este borrador? No vas a poder recuperarlo.")) discardSavedDraft(); };
$("#real-rm-form").onsubmit = saveRealRm;
$("#edit-rm-button").onclick = () => { $("#real-rm-form").classList.remove("hidden"); $("#real-rm-input").focus(); };
$("#continue-draft-choice").onclick = () => { $("#draft-choice-modal").close(); resumeSavedDraft(); };
$("#start-fresh-choice").onclick = () => { discardSavedDraft(); $("#draft-choice-modal").close(); openFreshWorkout(); };
$(".open-exercise-modal").onclick = () => $("#exercise-modal").showModal();
$("#create-exercise-from-workout").onclick = () => { $("#choose-exercise-modal").close(); $("#exercise-modal").showModal(); };
$$('[data-close]').forEach(button => button.onclick = () => $(`#${button.dataset.close}`).close());
$("#exercise-form").onsubmit = async event => { event.preventDefault(); const saved = await addExercise($("#exercise-name").value.trim(), $("#muscle-group").value); if (saved) { event.target.reset(); $("#exercise-modal").close(); if (!$("#workout-editor").classList.contains("hidden")) chooseExercise(); } };
$("#logout").onclick = async () => { if (hasSupabase) await client.auth.signOut(); else localStorage.removeItem("fuerza:session"); currentUser = null; $("#app-view").classList.add("hidden"); $("#auth-view").classList.remove("hidden"); };

(async () => {
  if (hasSupabase) {
    const { data: { session } } = await client.auth.getSession();
    if (session) { currentUser = session.user; await showApp(); }
  } else {
    const saved = localStorage.getItem("fuerza:session");
    if (saved) { currentUser = JSON.parse(saved); await showApp(); }
  }
})();

window.addEventListener("offline", () => setStatus("Sin conexión · borrador local", true));
window.addEventListener("online", () => { setStatus("Conexión recuperada"); showSaveToast("Volviste a estar conectado"); });
