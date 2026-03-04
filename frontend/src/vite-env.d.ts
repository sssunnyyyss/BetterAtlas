/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_UPTIME_STATUS_URL?: string;
  readonly VITE_UPTIME_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
