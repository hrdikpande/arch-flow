/**
 * Environment configuration. Missing required values stop the worker at start,
 * so it never runs half-configured.
 */

export interface WorkerConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  appUrl: string;
  sessionPath: string;
  chromiumPath?: string;
  enableWhatsapp: boolean;
  geminiApiKey?: string;
  geminiModel?: string;
  httpPort: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const required = (name: string): string => {
    const value = env[name];
    if (!value || value.trim() === '') throw new Error(`Missing required environment variable ${name}`);
    return value.trim();
  };
  const geminiApiKey = env.GEMINI_API_KEY?.trim() || undefined;
  const geminiModel = env.GEMINI_MODEL?.trim() || undefined;
  return {
    supabaseUrl: required('SUPABASE_URL'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    appUrl: required('APP_URL'),
    sessionPath: env.WA_SESSION_PATH?.trim() || './.wwebjs_auth',
    chromiumPath: env.PUPPETEER_EXECUTABLE_PATH?.trim() || undefined,
    enableWhatsapp: env.WA_ENABLED !== 'false',
    geminiApiKey,
    // Gemini stays off until a model is pinned (TECH-STACK.md, section 6, Phase 8).
    geminiModel: geminiApiKey ? geminiModel : undefined,
    httpPort: Number(env.PORT ?? 8080),
  };
}
