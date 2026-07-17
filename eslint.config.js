import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * ESLint flat config (ESLint 9).
 * - TypeScript recommended
 * - Astro recommended + regras de acessibilidade (jsx-a11y) nos templates .astro
 * - jsx-a11y + react-hooks nas ilhas React (.tsx)
 */
export default [
  { ignores: ['dist/', '.astro/', 'node_modules/', '*.config.*'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // O TypeScript já valida nomes/tipos não definidos com mais precisão que a
  // regra base do ESLint (que não enxerga lib globals como HTMLElementTagNameMap
  // dentro do frontmatter .astro). Prática recomendada pelo typescript-eslint.
  { rules: { 'no-undef': 'off' } },

  // Templates .astro
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-recommended'],

  // Ilhas React
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
    },
  },

  // env.d.ts depende de referências triple-slash para tipos ambientes
  // (.astro/types.d.ts e astro/client) — é o padrão oficial do Astro, `import`
  // não cobre esse caso.
  {
    files: ['src/env.d.ts'],
    rules: {
      '@typescript-eslint/triple-slash-reference': 'off',
    },
  },
];
