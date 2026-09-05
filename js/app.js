const { createClient } = supabase;
const client = createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.key);

const TABLE = "base_de_connaissance";

const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
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
const btnDelete = document.getElementById("btn-delete");
const deleteConfirm = document.getElementById("delete-confirm");
const btnDeleteCancel = document.getElementById("btn-delete-cancel");
const btnDeleteConfirm = document.getElementById("btn-delete-confirm");
const toastEl = document.getElementById("toast");

let allRows = [];
let activeTag = null;
let searchTerm = "";

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
    .select("*")
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

  const filtered = allRows.filter((row) => {
    if (activeTag && !splitTags(row.etiquettes).includes(activeTag)) return false;
    if (!term) return true;
    const haystack = [row.nom, row.texte, row.url, row.note_alex, row.etiquettes]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  resultCountEl.textContent = `${filtered.length} ressource${filtered.length > 1 ? "s" : ""}`;
  renderGrid(filtered);
}

function renderGrid(rows) {
  grid.innerHTML = "";
  stateEmpty.hidden = rows.length !== 0;
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
  submitBtn.disabled = true;

  const { error } = id
    ? await client.from(TABLE).update(payload).eq("id", id)
    : await client.from(TABLE).insert([payload]);

  submitBtn.disabled = false;

  if (error) {
    showToast("Erreur : " + error.message, true);
    return;
  }

  showToast(id ? "Ressource modifiée" : "Ressource ajoutée");
  closeModal();
  loadRows();
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

searchInput.addEventListener("input", (e) => {
  searchTerm = e.target.value;
  applyFilters();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

loadRows();
