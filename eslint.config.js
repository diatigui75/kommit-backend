import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/', 'src/repositories/generated/'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Le regex attrape tout chemin relatif (./ ou ../, imbriqué ou non).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\.?/',
              message: "Imports internes : utilise l'alias @/, jamais un chemin relatif (./ ou ../).",
            },
          ],
        },
      ],
    },
  },
)
