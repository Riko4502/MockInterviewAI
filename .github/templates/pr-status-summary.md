### 📊 Сводка проверок CI (Commit: `{{SHA}}`)

| Сервис | Проверки | Покрытие тестами | Статус |
| :--- | :--- | :---: | :---: |
| 🎨 **Web (Next.js)** | TypeScript, Biome, Vitest, Playwright, Lighthouse | `{{WEB_COV}}` | {{WEB_STATUS}} |
| 🚀 **Landing (Astro)** | Astro Check, Biome, Vitest, Docker Smoke | `{{LANDING_COV}}` | {{LANDING_STATUS}} |
| ⚙️ **API (Nest.js)** | Prisma Validate, Jest Unit Tests, Docker Smoke | `{{API_COV}}` | {{API_STATUS}} |
| ⚡ **Realtime (Go)** | Go Tests, Revive, Govulncheck, Docker Smoke | `{{REALTIME_COV}}` | {{REALTIME_STATUS}} |
| 📚 **Storybook (UI)** | TypeScript, Build Storybook, Interaction-тесты (Vitest + Playwright) | 
  `{{STORYBOOK_COV}}` | {{STORYBOOK_STATUS}} |
| 🛡️ **Security** | TruffleHog (Секреты), Hadolint (Docker) | — | {{SECURITY_STATUS}} |

*Отчет обновлен автоматически системой CI/CD. Сбор покрытия носит информационный характер и не блокирует PR.*
