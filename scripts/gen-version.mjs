/**
 * Пишет public/version.json с уникальным id сборки — по нему клиент понимает,
 * что вышел новый деплой, и предлагает обновиться (без ручной очистки кэша).
 * Запускается перед `vite build`.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const id = process.env.VITE_BUILD_ID || String(Date.now());
mkdirSync('public', { recursive: true });
writeFileSync(
  'public/version.json',
  JSON.stringify({ id, builtAt: new Date().toISOString() }),
);
console.log('[gen-version] version.json →', id);
