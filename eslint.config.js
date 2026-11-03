import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: { globals: globals.browser },
  },
  // 시뮬레이션 코어는 결정론을 위해 시계·전역 난수·DOM 을 쓰지 않는다 (CLAUDE.md)
  {
    files: ['src/core/**', 'src/tracks/**', 'src/simulation/**', 'src/genetics/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'src/core/rng 의 시드 PRNG 를 쓴다' },
        { object: 'Date', property: 'now', message: '코어는 시뮬레이션 시간만 쓴다' },
        { object: 'performance', property: 'now', message: '코어는 시뮬레이션 시간만 쓴다' },
      ],
      'no-restricted-globals': ['error', 'window', 'document'],
    },
  },
]);
