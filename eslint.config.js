import { defineConfig } from 'eslint/config';
import { jsdoc } from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';

export default defineConfig([
    {
        name: 'global-ignores',
        ignores: [
            'node_modules/**',
            '.worktrees/**',
            '.artifacts/**',
            'docs/**',
            'assets/**',
            'public/**',
            'web/**',
            'web-mvp/**',
            'dist/**',
            'desktop/target/**',
            '*.mjs',
        ],
    },
    {
        name: 'recommended',
        files: ['**/*.{js,ts}'],
        extends: [js.configs.recommended, tseslint.configs.recommended],
        rules: {
            eqeqeq: ['warn'],
            'no-multi-assign': ['error'],
        },
    },
    {
        name: 'unicorn',
        files: ['**/*.{js,ts}'],
        languageOptions: {
            globals: globals.builtin,
            parser: tseslint.parser,
        },
        plugins: {
            unicorn,
        },
        extends: [
            'unicorn/recommended',
        ],
    },
    {
        name: 'stylistic',
        files: ['**/*.{js,ts}'],
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            '@stylistic/arrow-parens': ['error', 'always', { requireForBlockBody: true }],
            '@stylistic/arrow-spacing': ['error', { after: true, before: true }],
            '@stylistic/block-spacing': ['error', 'always'],
            '@stylistic/brace-style': ['error', '1tbs', { allowSingleLine: true }],
            '@stylistic/comma-dangle': ['error', 'always-multiline'],
            '@stylistic/comma-spacing': ['error', { after: true, before: false }],
            '@stylistic/computed-property-spacing': ['error', 'never', { enforceForClassMembers: true }],
            '@stylistic/dot-location': ['error', 'property'],
            '@stylistic/eol-last': 'error',
            '@stylistic/generator-star-spacing': ['error', { after: true, before: false }],
            '@stylistic/implicit-arrow-linebreak': ['error', 'beside'],
            '@stylistic/indent': ['error', 4, {
                ArrayExpression: 1,
                CallExpression: { arguments: 1 },
                flatTernaryExpressions: false,
                FunctionDeclaration: { body: 1, parameters: 1, returnType: 1 },
                FunctionExpression: { body: 1, parameters: 1, returnType: 1 },
                ignoreComments: false,
                ignoredNodes: [
                    'TSUnionType',
                    'TSIntersectionType',
                ],
                ImportDeclaration: 1,
                MemberExpression: 1,
                ObjectExpression: 1,
                offsetTernaryExpressions: true,
                outerIIFEBody: 1,
                SwitchCase: 1,
                tabLength: 1,
                VariableDeclarator: 1,
            }],
            '@stylistic/indent-binary-ops': ['error', 4],
            '@stylistic/keyword-spacing': ['error', { after: true, before: true }],
            '@stylistic/lines-around-comment': ['error', {
                beforeBlockComment: true,
                afterBlockComment: false,
                beforeLineComment: true,
                afterLineComment: true,
                allowBlockStart: true,
            }],
            '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
            '@stylistic/max-statements-per-line': ['error', { max: 1 }],
            '@stylistic/member-delimiter-style': ['error', {
                multiline: {
                    delimiter: 'semi',
                    requireLast: true,
                },
                multilineDetection: 'brackets',
                overrides: {
                    interface: {
                        multiline: {
                            delimiter: 'semi',
                            requireLast: true,
                        },
                    },
                },
                singleline: {
                    delimiter: 'semi',
                },
            }],
            '@stylistic/multiline-ternary': ['error', 'always-multiline'],
            '@stylistic/new-parens': 'error',
            '@stylistic/no-confusing-arrow': ['warn'],
            '@stylistic/no-extra-parens': ['error', 'functions'],
            '@stylistic/no-extra-semi': ['warn'],
            '@stylistic/no-floating-decimal': 'error',
            '@stylistic/no-mixed-operators': ['error', {
                allowSamePrecedence: true,
                groups: [
                    ['==', '!=', '===', '!==', '>', '>=', '<', '<='],
                    ['&&', '||'],
                    ['in', 'instanceof'],
                ],
            }],
            '@stylistic/no-mixed-spaces-and-tabs': 'error',
            '@stylistic/no-multi-spaces': 'error',
            '@stylistic/no-multiple-empty-lines': ['error', { max: 1, maxBOF: 0, maxEOF: 1 }],
            '@stylistic/no-tabs': 'error',
            '@stylistic/no-trailing-spaces': 'error',
            '@stylistic/no-whitespace-before-property': 'error',
            '@stylistic/operator-linebreak': ['error', 'before'],
            '@stylistic/padded-blocks': ['error', { blocks: 'never', classes: 'never', switches: 'never' }],
            '@stylistic/padding-line-between-statements': ['error',
                { blankLine: 'always', prev: '*', next: 'return' },
                { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
                { blankLine: 'any', prev: ['const', 'let', 'var'], next: ['const', 'let', 'var'] },
                { blankLine: 'always', prev: 'directive', next: '*' },
                { blankLine: 'any', prev: 'directive', next: 'directive' },
            ],
            '@stylistic/quote-props': ['error', 'as-needed'],
            '@stylistic/quotes': ['error', 'single', { allowTemplateLiterals: 'always', avoidEscape: true }],
            '@stylistic/rest-spread-spacing': ['error', 'never'],
            '@stylistic/semi': ['error', 'always'],
            '@stylistic/semi-spacing': ['error', { after: true, before: false }],
            '@stylistic/space-before-blocks': ['error', 'always'],
            '@stylistic/space-before-function-paren': ['error', { anonymous: 'always', asyncArrow: 'always', named: 'never', catch: 'always' }],
            '@stylistic/space-in-parens': ['error', 'never'],
            '@stylistic/space-infix-ops': 'error',
            '@stylistic/space-unary-ops': ['error', { nonwords: false, words: true }],
            '@stylistic/spaced-comment': ['error', 'always', {
                block: {
                    balanced: true,
                    exceptions: ['*'],
                    markers: ['!'],
                },
                line: {
                    exceptions: ['/', '#'],
                    markers: ['/'],
                },
            }],
            '@stylistic/template-curly-spacing': 'error',
            '@stylistic/template-tag-spacing': ['error', 'never'],
            '@stylistic/type-annotation-spacing': ['error', {}],
            '@stylistic/type-generic-spacing': 'error',
            '@stylistic/type-named-tuple-spacing': 'error',
            '@stylistic/wrap-iife': ['error', 'any', { functionPrototypeMethods: true }],
            '@stylistic/yield-star-spacing': ['error', { after: true, before: false }],
        },
    },
    jsdoc({
        config: 'flat/recommended-typescript',
        rules: {
            'jsdoc/check-values': ['error', {
                allowedLicenses: ['MIT', 'ISC'],
            }],
            'jsdoc/tag-lines': ['warn', 'any', {
                startLines: 1,
            }],
        },
        settings: {
            structuredTags: {
                see: {
                    name: 'namepath-referencing',
                    required: ['name'],
                },
            },
        },
    }),
]);
