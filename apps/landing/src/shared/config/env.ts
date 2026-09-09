export interface EnvConfig {
  siteUrl: string;
  appUrl: string;
  authUrl: string;
  registerUrl: string;
  githubUrl: string;
}

export function validateEnv(
  env: Record<string, string | undefined> = process.env,
): EnvConfig {
  const isProd = env.NODE_ENV === "production";

  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const authUrl = env.NEXT_PUBLIC_AUTH_URL;
  const registerUrl = env.NEXT_PUBLIC_REGISTER_URL;
  const githubUrl =
    env.NEXT_PUBLIC_GITHUB_URL || "https://github.com/Riko4502/MockInterviewAI";

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

  const resolvedAppUrl = appUrl || "https://app.mockinterviewai.com";

  return {
    siteUrl: siteUrl || "https://mockinterviewai.com",
    appUrl: resolvedAppUrl,
    authUrl: authUrl || `${resolvedAppUrl}/login`,
    registerUrl: registerUrl || `${resolvedAppUrl}/register`,
    githubUrl,
  };
}

export const envConfig: EnvConfig = validateEnv();
