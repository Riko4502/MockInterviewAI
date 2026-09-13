import { envConfig } from "./env";

export interface NavigationConfig {
  appUrl: string;
  authUrl: string;
  registerUrl: string;
  githubUrl: string;
}

export const navigationConfig: NavigationConfig = {
  appUrl: envConfig.appUrl,
  authUrl: envConfig.authUrl,
  registerUrl: envConfig.registerUrl,
  githubUrl: envConfig.githubUrl,
};

export const getAuthUrl = () => navigationConfig.authUrl;
export const getRegisterUrl = () => navigationConfig.registerUrl;
export const getAppUrl = (path = "") => `${navigationConfig.appUrl}${path}`;
