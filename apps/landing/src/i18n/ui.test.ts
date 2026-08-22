import { describe, it, expect } from 'vitest';
import { ui, languages, useTranslations, getLangFromUrl } from './ui';

describe('i18n Localization & Translation Integrity', () => {
  it('should define both Russian and English languages', () => {
    expect(languages).toHaveProperty('ru', 'Русский');
    expect(languages).toHaveProperty('en', 'English');
  });

  it('should have 100% key parity between English and Russian dictionaries', () => {
    const enKeys = Object.keys(ui.en).sort();
    const ruKeys = Object.keys(ui.ru).sort();

    expect(enKeys).toEqual(ruKeys);
  });

  it('should not have empty translation strings', () => {
    for (const [key, value] of Object.entries(ui.en)) {
      expect(value.trim().length, `Empty English value for key: ${key}`).toBeGreaterThan(0);
    }
    for (const [key, value] of Object.entries(ui.ru)) {
      expect(value.trim().length, `Empty Russian value for key: ${key}`).toBeGreaterThan(0);
    }
  });

  it('should translate keys correctly for active language', () => {
    const tRu = useTranslations('ru');
    const tEn = useTranslations('en');

    expect(tRu('nav.signIn')).toBe('Войти');
    expect(tEn('nav.signIn')).toBe('Sign in');

    expect(tRu('cta.button')).toBe('Начать мок-интервью');
    expect(tEn('cta.button')).toBe('Start Mock Interview');

    expect(tRu('howItWorks.step1Tag')).toContain('ЭТАП 01');
    expect(tEn('howItWorks.step1Tag')).toContain('STEP 01');
  });

  it('should extract correct language from URL', () => {
    const urlEn = new URL('https://devsync.ai/en/dashboard');
    expect(getLangFromUrl(urlEn)).toBe('en');

    const urlRu = new URL('https://devsync.ai/');
    expect(getLangFromUrl(urlRu)).toBe('ru');

    const urlUnknown = new URL('https://devsync.ai/de');
    expect(getLangFromUrl(urlUnknown)).toBe('ru');
  });
});
