type RequiredEnvKey = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY';

// Valores públicos (anon key + URL) — seguros para commit, protegidos por RLS no Supabase.
// Usados como fallback caso as variáveis de ambiente não estejam disponíveis no build.
const FALLBACKS: Record<RequiredEnvKey, string> = {
  VITE_SUPABASE_URL: 'https://ejxlhstosdrryzrmfsbm.supabase.co',
  VITE_SUPABASE_ANON_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqeGxoc3Rvc2Rycnl6cm1mc2JtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2NjEwMDksImV4cCI6MjA4NTIzNzAwOX0.sMwRQmKi6VRYxsrRKJzWzum6zGM36f2ATqViYjHj-Ik',
};

export function requireEnv(name: RequiredEnvKey): string {
  const fromEnv = import.meta.env[name];
  const value =
    fromEnv && String(fromEnv).trim() !== '' ? String(fromEnv).trim() : FALLBACKS[name];

  if (!value || value.trim() === '') {
    throw new Error(
      `[ClickHero] Variável de ambiente obrigatória ausente: ${name}. ` +
        'Configure-a no .env ou nas variáveis do deploy.',
    );
  }
  return value.trim();
}
