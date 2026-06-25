/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL del Apps Script Web App (/exec) para sincronizar presets con Google Sheets. */
  readonly VITE_PRESETS_SHEET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
