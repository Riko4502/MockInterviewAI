export interface NavigationConfig {
  appUrl: string;
  authUrl: string;
  registerUrl: string;
  githubUrl: string;
}

export const navigationConfig: NavigationConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "https://app.mockinterviewai.com",
  authUrl:
    process.env.NEXT_PUBLIC_AUTH_URL || "https://app.mockinterviewai.com/login",
  registerUrl:
    process.env.NEXT_PUBLIC_REGISTER_URL ||
    "https://app.mockinterviewai.com/register",
  githubUrl:
    process.env.NEXT_PUBLIC_GITHUB_URL ||
    "https://github.com/Riko4502/MockInterviewAI",
};

export const getAuthUrl = () => navigationConfig.authUrl;
export const getRegisterUrl = () => navigationConfig.registerUrl;
export const getAppUrl = (path = "") => `${navigationConfig.appUrl}${path}`;
