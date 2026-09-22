import { SetMetadata } from "@nestjs/common";

// Browser OAuth navigation uses one-time, browser-bound state at callback.
export const OAUTH_NAVIGATION_KEY = "oauthNavigation";
export const OAuthNavigation = () => SetMetadata(OAUTH_NAVIGATION_KEY, true);
