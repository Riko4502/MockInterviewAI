import { describe, it, expect } from 'vitest';
import { getAuthUrl, getRegisterUrl, getAppUrl, navigationConfig } from './navigation';

describe('navigationConfig & Auth Links', () => {
  it('should generate valid login URL', () => {
    const authUrl = getAuthUrl();
    expect(authUrl).toContain('/login');
    expect(authUrl.startsWith('http://') || authUrl.startsWith('https://') || authUrl.startsWith('/')).toBe(true);
  });

  it('should generate valid register URL', () => {
    const registerUrl = getRegisterUrl();
    expect(registerUrl).toContain('/register');
    expect(registerUrl.startsWith('http://') || registerUrl.startsWith('https://') || registerUrl.startsWith('/')).toBe(true);
  });

  it('should support dynamic subdomains (e.g. from GitHub Actions / env vars)', () => {
    const customBase = 'https://app.devsync.ai';
    expect(getAuthUrl(customBase)).toBe('https://app.devsync.ai/login');
    expect(getRegisterUrl(customBase)).toBe('https://app.devsync.ai/register');
  });

  it('should clean trailing slashes properly without creating double slashes', () => {
    const dirtyUrl = 'https://auth.mockinterview.com///';
    expect(getAuthUrl(dirtyUrl)).toBe('https://auth.mockinterview.com/login');
    expect(getRegisterUrl(dirtyUrl)).toBe('https://auth.mockinterview.com/register');
  });

  it('should construct application sub-paths correctly', () => {
    expect(getAppUrl('/dashboard', 'https://app.custom.com')).toBe('https://app.custom.com/dashboard');
    expect(getAppUrl('dashboard', 'https://app.custom.com')).toBe('https://app.custom.com/dashboard');
    expect(getAppUrl('/tracks/frontend', 'https://app.custom.com')).toBe('https://app.custom.com/tracks/frontend');
  });

  it('should have valid repository link', () => {
    expect(navigationConfig.githubUrl).toBe('https://github.com/Riko4502/MockInterviewAI');
  });
});
