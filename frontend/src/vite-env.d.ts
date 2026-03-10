/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_UPTIME_STATUS_URL?: string;
  readonly VITE_UPTIME_LABEL?: string;
  readonly VITE_SOCIAL_X_URL?: string;
  readonly VITE_SOCIAL_GITHUB_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
