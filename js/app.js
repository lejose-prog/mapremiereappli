const { createClient } = supabase;
const client = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key);

const TABLE = "base_de_connaissance";

const grid = document.getElementById("grid");
const tableWrap = document.getElementById("table-wrap");
const tableBody = document.getElementById("table-body");
const viewCardsBtn = document.getElementById("view-cards");
const viewTableBtn = document.getElementById("view-table");
const searchInput = document.getElementById("search");
const aiToggle = document.getElementById("ai-search-toggle");
const indexBanner = document.getElementById("index-banner");
const indexBannerText = document.getElementById("index-banner-text");
const btnIndexNow = document.getElementById("btn-index-now");
const tagFiltersEl = document.getElementById("tag-filters");
const resultCountEl = document.getElementById("result-count");
const stateLoading = document.getElementById("state-loading");
const stateEmpty = document.getElementById("state-empty");
const stateError = document.getElementById("state-error");

const modalBackdrop = document.getElementById("modal-backdrop");
const modalTitle = document.getElementById("modal-title");
const entryForm = document.getElementById("entry-form");
const fieldId = document.getElementById("field-id");
const fieldNom = document.getElementById("field-nom");
const fieldUrl = document.getElementById("field-url");
const fieldTexte = document.getElementById("field-texte");
const fieldNoteAlex = document.getElementById("field-note-alex");
const fieldEtiquettes = document.getElementById("field-etiquettes");
const btnSummarize = document.getElementById("btn-summarize");
const btnDelete = document.getElementById("btn-delete");
const deleteConfirm = document.getElementById("delete-confirm");
const btnDeleteCancel = document.getElementById("btn-delete-cancel");
const btnDeleteConfirm = document.getElementById("btn-delete-confirm");
const toastEl = document.getElementById("toast");

let allRows = [];
let activeTag = null;
let searchTerm = "";
let currentView = localStorage.getItem("bdc-view") === "table" ? "table" : "cards";
let semanticResults = null;
let searchDebounceTimer = null;

function splitTags(etiquettes) {
  if (!etiquettes) return [];
  return etiquettes.split(",").map((t) => t.trim()).filter(Boolean);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.className = "toast" + (isError ? " toast-error" : "");
  toastEl.hidden = false;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toastEl.hidden = true; }, 3000);
}

async function loadRows() {
  stateLoading.hidden = false;
  stateEmpty.hidden = true;
  stateError.hidden = true;
  grid.innerHTML = "";

  const { data, error } = await client
    .from(TABLE)
    .select("id,nom,url,texte,note_alex,etiquettes,created_at")
    .order("created_at", { ascending: false });

  stateLoading.hidden = true;

  if (error) {
    stateError.hidden = false;
    stateError.textContent = "Erreur de chargement : " + error.message;
    return;
  }

  allRows = data;
  renderTagFilters();
  applyFilters();
  checkIndexStatus();
}

async function checkIndexStatus() {
  const { count, error } = await client
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .is("embedding", null);

  if (error || !count) {
    indexBanner.hidden = true;
    return;
  }

  indexBanner.hidden = false;
  indexBannerText.textContent = `${count} ressource${count > 1 ? "s" : ""} pas encore indexée${count > 1 ? "s" : ""} pour la recherche intelligente`;
}

function renderTagFilters() {
  const tagSet = new Set();
  allRows.forEach((row) => splitTags(row.etiquettes).forEach((t) => tagSet.add(t)));
  const tags = Array.from(tagSet).sort((a, b) => a.localeCompare(b, "fr"));

  tagFiltersEl.innerHTML = "";
  const allChip = document.createElement("button");
  allChip.className = "tag-chip" + (activeTag === null ? " active" : "");
  allChip.textContent = "Tous";
  allChip.addEventListener("click", () => { activeTag = null; renderTagFilters(); applyFilters(); });
  tagFiltersEl.appendChild(allChip);

  tags.forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "tag-chip" + (activeTag === tag ? " active" : "");
    chip.textContent = tag;
    chip.addEventListener("click", () => {
      activeTag = activeTag === tag ? null : tag;
      renderTagFilters();
      applyFilters();
    });
    tagFiltersEl.appendChild(chip);
  });
}

function applyFilters() {
  const term = searchTerm.trim().toLowerCase();
  const semanticMode = aiToggle.checked && semanticResults !== null;
  const base = semanticMode ? semanticResults : allRows;

  const filtered = base.filter((row) => {
    if (activeTag && !splitTags(row.etiquettes).includes(activeTag)) return false;
    if (semanticMode) return true;
    if (!term) return true;
    const haystack = [row.nom, row.texte, row.url, row.note_alex, row.etiquettes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  resultCountEl.textContent = `${filtered.length} ressource${filtered.length > 1 ? "s" : ""}` + (semanticMode ? " · recherche intelligente" : "");
  stateEmpty.hidden = filtered.length !== 0;
  renderGrid(filtered);
  renderTable(filtered);
}

async function runSemanticSearch(term) {
  resultCountEl.textContent = "Recherche intelligente en cours…";
  try {
    const embedding = await getEmbedding(term);
    const { data, error } = await client.rpc("match_base_de_connaissance", {
      query_embedding: embedding,
      match_count: 30,
    });
    if (error) throw error;
    semanticResults = data;
  } catch (err) {
    showToast("Recherche intelligente indisponible : " + err.message, true);
    semanticResults = [];
  }
  applyFilters();
}

function setView(view) {
  currentView = view;
  localStorage.setItem("bdc-view", view);
  grid.hidden = view !== "cards";
  tableWrap.hidden = view !== "table";
  viewCardsBtn.classList.toggle("active", view === "cards");
  viewTableBtn.classList.toggle("active", view === "table");
}

viewCardsBtn.addEventListener("click", () => setView("cards"));
viewTableBtn.addEventListener("click", () => setView("table"));

function renderGrid(rows) {
  grid.innerHTML = "";
  if (rows.length === 0) return;

  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "card";

    const tags = splitTags(row.etiquettes);

    card.innerHTML = `
      <div class="card-head">
        <div class="card-title">${escapeHtml(row.nom) || "(sans titre)"}</div>
        <div class="card-actions">
          <button class="btn-icon btn-edit" aria-label="Modifier" title="Modifier">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20L4.7 16.6L16.5 4.8C17.1 4.2 18 4.2 18.6 4.8L19.7 5.9C20.3 6.5 20.3 7.4 19.7 8L7.9 19.8L4 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          </button>
        </div>
      </div>
      ${row.url ? `<a class="card-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.url)}</a>` : ""}
      ${row.texte ? `<div class="card-text">${escapeHtml(row.texte)}</div>` : ""}
      ${row.note_alex ? `<div class="card-note"><b>Note Alex —</b> ${escapeHtml(row.note_alex)}</div>` : ""}
      ${tags.length ? `<div class="card-tags">${tags.map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    `;

    card.querySelector(".btn-edit").addEventListener("click", () => openModal(row));
    grid.appendChild(card);
  });
}

function renderTable(rows) {
  tableBody.innerHTML = "";
  if (rows.length === 0) return;

  rows.forEach((row) => {
    const tags = splitTags(row.etiquettes);
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="col-nom">${escapeHtml(row.nom) || "(sans titre)"}</td>
      <td class="col-url">${row.url ? `<a class="card-link" href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.url)}</a>` : ""}</td>
      <td class="col-texte"><div class="cell-clip">${escapeHtml(row.texte)}</div></td>
      <td class="col-note"><div class="cell-clip">${escapeHtml(row.note_alex)}</div></td>
      <td class="col-tags"><div class="cell-tags">${tags.map((t) => `<span class="card-tag">${escapeHtml(t)}</span>`).join("")}</div></td>
      <td class="col-actions">
        <button class="btn-icon btn-edit" aria-label="Modifier" title="Modifier">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 20L4.7 16.6L16.5 4.8C17.1 4.2 18 4.2 18.6 4.8L19.7 5.9C20.3 6.5 20.3 7.4 19.7 8L7.9 19.8L4 20Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
        </button>
      </td>
    `;

    tr.querySelector(".btn-edit").addEventListener("click", () => openModal(row));
    tableBody.appendChild(tr);
  });
}

function resetDeleteConfirm() {
  deleteConfirm.hidden = true;
  btnDelete.hidden = fieldId.value === "";
}

function openModal(row = null) {
  entryForm.reset();
  deleteConfirm.hidden = true;
  if (row) {
    modalTitle.textContent = "Modifier la ressource";
    fieldId.value = row.id;
    fieldNom.value = row.nom || "";
    fieldUrl.value = row.url || "";
    fieldTexte.value = row.texte || "";
    fieldNoteAlex.value = row.note_alex || "";
    fieldEtiquettes.value = row.etiquettes || "";
    btnDelete.hidden = false;
  } else {
    modalTitle.textContent = "Ajouter une ressource";
    fieldId.value = "";
    btnDelete.hidden = true;
  }
  modalBackdrop.hidden = false;
  fieldNom.focus();
}

function closeModal() {
  modalBackdrop.hidden = true;
}

document.getElementById("btn-add").addEventListener("click", () => openModal());
document.getElementById("btn-close-modal").addEventListener("click", closeModal);
document.getElementById("btn-cancel").addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => { if (e.target === modalBackdrop) closeModal(); });

entryForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    nom: fieldNom.value.trim(),
    url: fieldUrl.value.trim() || null,
    texte: fieldTexte.value.trim() || null,
    note_alex: fieldNoteAlex.value.trim() || null,
    etiquettes: fieldEtiquettes.value.trim() || null,
  };

  const id = fieldId.value;
  const submitBtn = entryForm.querySelector('button[type="submit"]');
  const originalSubmitLabel = submitBtn.textContent;
  submitBtn.disabled = true;

  let indexed = true;
  try {
    submitBtn.textContent = "Indexation…";
    payload.embedding = await getEmbedding(buildEmbeddingText(payload));
  } catch (err) {
    indexed = false;
  }
  submitBtn.textContent = originalSubmitLabel;

  const { error } = id
    ? await client.from(TABLE).update(payload).eq("id", id)
    : await client.from(TABLE).insert([payload]);

  submitBtn.disabled = false;

  if (error) {
    showToast("Erreur : " + error.message, true);
    return;
  }

  const label = id ? "Ressource modifiée" : "Ressource ajoutée";
  showToast(indexed ? label : label + " (indexation IA indisponible, LM Studio démarré ?)");
  closeModal();
  loadRows();
});

const MAX_PAGE_CHARS = 6000;

async function fetchPage(url) {
  const response = await fetch(`/proxy?url=${encodeURIComponent(url)}`);
  const body = await response.text();
  if (!response.ok) throw new Error(body || `statut ${response.status}`);

  const doc = new DOMParser().parseFromString(body, "text/html");
  const title = doc.title?.trim().slice(0, 200) || "";
  doc.querySelectorAll("script, style, noscript, svg, nav, header, footer, iframe, form").forEach((el) => el.remove());
  const text = (doc.body?.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (!text) throw new Error("Aucun contenu texte trouvé sur cette page (probablement générée en JavaScript)");
  return { title, text: text.slice(0, MAX_PAGE_CHARS) };
}

function buildEmbeddingText({ nom, texte, note_alex, etiquettes }) {
  return [nom, texte, note_alex, etiquettes].filter(Boolean).join("\n").slice(0, 4000);
}

async function getEmbedding(text) {
  const { baseUrl, embeddingModel } = window.LMSTUDIO_CONFIG;
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: embeddingModel, input: text }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio (embeddings) a répondu avec le statut ${response.status}`);
  }

  const data = await response.json();
  const embedding = data.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) throw new Error("Réponse d'embedding invalide");
  return embedding;
}

async function summarizeWithLMStudio(text) {
  const { baseUrl, model } = window.LMSTUDIO_CONFIG;
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: "Tu résumes le contenu de pages web en français, en 3 à 5 phrases maximum, de façon concise et fidèle. Réponds uniquement avec le résumé, sans préambule.",
        },
        { role: "user", content: text },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`LM Studio a répondu avec le statut ${response.status}`);
  }

  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error("Réponse vide de LM Studio");
  return summary;
}

btnSummarize.addEventListener("click", async () => {
  let url = fieldUrl.value.trim();
  if (!url) {
    showToast("Renseignez d'abord une URL avant de résumer", true);
    return;
  }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  btnSummarize.disabled = true;
  const originalLabel = btnSummarize.textContent;

  try {
    btnSummarize.textContent = "Récupération de la page…";
    const { text } = await fetchPage(url);

    btnSummarize.textContent = "Résumé en cours…";
    fieldTexte.value = await summarizeWithLMStudio(text);
    showToast("Page résumée par LM Studio");
  } catch (err) {
    showToast("Échec du résumé : " + err.message, true);
  } finally {
    btnSummarize.disabled = false;
    btnSummarize.textContent = originalLabel;
  }
});

btnDelete.addEventListener("click", () => {
  btnDelete.hidden = true;
  deleteConfirm.hidden = false;
});

btnDeleteCancel.addEventListener("click", resetDeleteConfirm);

btnDeleteConfirm.addEventListener("click", async () => {
  const id = fieldId.value;
  if (!id) return;

  btnDeleteConfirm.disabled = true;
  const { error } = await client.from(TABLE).delete().eq("id", id);
  btnDeleteConfirm.disabled = false;

  if (error) {
    showToast("Erreur : " + error.message, true);
    return;
  }
  showToast("Ressource supprimée");
  closeModal();
  loadRows();
});

const ADD_COMMAND_RE = /^\/ajout\s+(\S+)/i;

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  clearTimeout(searchDebounceTimer);

  if (searchTerm.trim().toLowerCase().startsWith("/ajout")) {
    resultCountEl.textContent = "tapez l'URL puis Entrée pour l'ajouter et la résumer";
    return;
  }

  if (!aiToggle.checked) {
    semanticResults = null;
    applyFilters();
    return;
  }

  if (!searchTerm.trim()) {
    semanticResults = null;
    applyFilters();
    return;
  }

  searchDebounceTimer = setTimeout(() => runSemanticSearch(searchTerm), 700);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.keyCode !== 13) return;
  const match = searchInput.value.trim().match(ADD_COMMAND_RE);
  if (!match) return;
  e.preventDefault();
  handleAjoutCommand(match[1]);
});

async function handleAjoutCommand(rawUrl) {
  let url = rawUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;

  searchInput.value = "";
  searchTerm = "";
  searchInput.disabled = true;
  resultCountEl.textContent = `ajout de ${url}…`;

  const payload = { nom: url, url, texte: null, note_alex: null, etiquettes: null };
  let warning = null;

  try {
    const { title, text } = await fetchPage(url);
    if (title) payload.nom = title;
    payload.texte = await summarizeWithLMStudio(text);
  } catch (err) {
    warning = "récupération/résumé impossible (" + err.message + ")";
  }

  try {
    payload.embedding = await getEmbedding(buildEmbeddingText(payload));
  } catch (err) {
    // indexation best-effort, pas bloquante
  }

  const { error } = await client.from(TABLE).insert([payload]);
  searchInput.disabled = false;

  if (error) {
    showToast("Erreur : " + error.message, true);
    applyFilters();
    return;
  }

  showToast(warning ? `Ressource ajoutée (${warning})` : `Ressource ajoutée et résumée : ${payload.nom}`, !!warning);
  loadRows();
}

aiToggle.addEventListener("change", () => {
  searchInput.placeholder = aiToggle.checked
    ? "Rechercher par sens… (IA locale)"
    : "Rechercher un nom, un mot, une URL…";

  if (aiToggle.checked && searchTerm.trim()) {
    runSemanticSearch(searchTerm);
  } else {
    semanticResults = null;
    applyFilters();
  }
});

btnIndexNow.addEventListener("click", async () => {
  btnIndexNow.disabled = true;
  const originalLabel = btnIndexNow.textContent;

  const { data: rows, error } = await client
    .from(TABLE)
    .select("id,nom,texte,note_alex,etiquettes")
    .is("embedding", null);

  if (error) {
    showToast("Erreur : " + error.message, true);
    btnIndexNow.disabled = false;
    return;
  }

  let done = 0;
  for (const row of rows) {
    btnIndexNow.textContent = `Indexation… (${done}/${rows.length})`;
    try {
      const embedding = await getEmbedding(buildEmbeddingText(row));
      const { error: updateError } = await client.from(TABLE).update({ embedding }).eq("id", row.id);
      if (updateError) throw updateError;
      done++;
    } catch (err) {
      showToast(`Indexation interrompue à "${row.nom || row.id}" : ${err.message}`, true);
      break;
    }
  }

  btnIndexNow.textContent = originalLabel;
  btnIndexNow.disabled = false;
  if (done > 0) showToast(`${done} ressource${done > 1 ? "s" : ""} indexée${done > 1 ? "s" : ""}`);
  checkIndexStatus();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

setView(currentView);
loadRows();
