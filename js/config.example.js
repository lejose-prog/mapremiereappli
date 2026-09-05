// Copiez ce fichier en "config.js" (déjà ignoré par git) et remplissez vos propres valeurs.
// Project Settings → API dans votre dashboard Supabase.
window.SUPABASE_CONFIG = {
  url: "https://VOTRE-PROJET.supabase.co",
  key: "VOTRE_CLE_PUBLISHABLE_OU_ANON",
};

// LM Studio doit tourner en local avec le "Local Server" démarré
// (onglet Developer/Local Server dans LM Studio, CORS activé).
// "model" doit être l'identifiant EXACT d'un modèle chargé dans LM Studio
// (voir http://localhost:1234/v1/models une fois le serveur démarré).
window.LMSTUDIO_CONFIG = {
  baseUrl: "http://localhost:1234/v1",
  model: "mistralai/ministral-3-3b",
};
