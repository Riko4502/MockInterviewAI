export interface EnvConfig {
  siteUrl: string;
  appUrl: string;
  authUrl: string;
  registerUrl: string;
  githubUrl: string;
}

export const DEFAULT_SITE_URL = "https://mockinterviewai.com";
export const DEFAULT_APP_URL = "https://app.mockinterviewai.com";
export const DEFAULT_GITHUB_URL = "https://github.com/Riko4502/MockInterviewAI";

/**
 * Validates environment configuration explicitly.
 * Throws diagnostic errors in production mode if required variables contain localhost.
 */
export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): EnvConfig {
  const isProd = env.NODE_ENV === "production";

  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const authUrl = env.NEXT_PUBLIC_AUTH_URL;
  const registerUrl = env.NEXT_PUBLIC_REGISTER_URL;
  const githubUrl = env.NEXT_PUBLIC_GITHUB_URL || DEFAULT_GITHUB_URL;

  if (isProd) {
    if (siteUrl?.includes("localhost")) {
      throw new Error("NEXT_PUBLIC_SITE_URL cannot be localhost in production");
    }
    if (appUrl?.includes("localhost")) {
      throw new Error("NEXT_PUBLIC_APP_URL cannot be localhost in production");
    }
    if (authUrl?.includes("localhost")) {
      throw new Error("NEXT_PUBLIC_AUTH_URL cannot be localhost in production");
    }
    if (registerUrl?.includes("localhost")) {
      throw new Error(
        "NEXT_PUBLIC_REGISTER_URL cannot be localhost in production",
      );
    }
  }

  const resolvedAppUrl = appUrl || DEFAULT_APP_URL;

  return {
    siteUrl: siteUrl || DEFAULT_SITE_URL,
    appUrl: resolvedAppUrl,
    authUrl: authUrl || `${resolvedAppUrl}/login`,
    registerUrl: registerUrl || `${resolvedAppUrl}/register`,
    githubUrl,
  };
}

/**
 * Resolves safe environment configuration without throwing at module import time.
 * In production mode, ignores local development 'localhost' values to ensure clean static builds.
 */
export function getSafeEnvConfig(
  env: Record<string, string | undefined> = process.env,
): EnvConfig {
  const isProd = env.NODE_ENV === "production";

  let siteUrl = env.NEXT_PUBLIC_SITE_URL;
  let appUrl = env.NEXT_PUBLIC_APP_URL;
  let authUrl = env.NEXT_PUBLIC_AUTH_URL;
  let registerUrl = env.NEXT_PUBLIC_REGISTER_URL;
  const githubUrl = env.NEXT_PUBLIC_GITHUB_URL || DEFAULT_GITHUB_URL;

  if (isProd) {
    if (siteUrl?.includes("localhost")) {
      siteUrl = undefined;
    }
    if (appUrl?.includes("localhost")) {
      appUrl = undefined;
    }
    if (authUrl?.includes("localhost")) {
      authUrl = undefined;
    }
    if (registerUrl?.includes("localhost")) {
      registerUrl = undefined;
    }
  }

  const resolvedAppUrl = appUrl || DEFAULT_APP_URL;

  return {
    siteUrl: siteUrl || DEFAULT_SITE_URL,
    appUrl: resolvedAppUrl,
    authUrl: authUrl || `${resolvedAppUrl}/login`,
    registerUrl: registerUrl || `${resolvedAppUrl}/register`,
    githubUrl,
  };
}

export const envConfig: EnvConfig = getSafeEnvConfig();

/**
 * Returns the resolved site URL for static generation and canonical SEO metadata.
 */
export function getSiteUrl(): string {
  return envConfig.siteUrl;
}

/**
 * Strict production site URL resolution for execution paths requiring explicit production config.
 */
export function getProductionSiteUrl(
  env: Record<string, string | undefined> = process.env,
): string {
  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error("NEXT_PUBLIC_SITE_URL is required in production");
  }
  if (siteUrl.includes("localhost")) {
    throw new Error("NEXT_PUBLIC_SITE_URL cannot be localhost in production");
  }
  return siteUrl;
}
