/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_BETA_REQUIRE_INVITE_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

