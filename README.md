# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

Tudo foi commitado em "Melhorias e correções" (6cd6725). Aqui está o estado atual:

1. Fix de duplicidade do pontomobile_id (3 camadas) — código implementado, migration pendente de aplicar
Está tudo commitado no backend: guard em syncFuncionario (bloqueia nova duplicidade), _buscarEMapear hardened (exclui colisões da importação em vez de misturar batidas), endpoint GET /mobile/conflitos-pontomobile-id + banner de alerta no front (IntegracaoMobilePage). A migration 041_funcionarios_pontomobile_id_unico.sql existe no repo mas ainda não foi aplicada — no banco local o índice ainda é o antigo não-único (idx_func_pontomobile), e os 3 pares de duplicidade ainda estão lá (6031: 658/660, 6048: 587/591, 6674: 509/511). Ou seja: a correção de dados que passei (os 3 UPDATE ... SET pontomobile_id = NULL) ainda não foi executada em produção — sem isso, rodar a migration 041 vai falhar de propósito.

2. Ocorrência HH:MM (OcorrenciaModal.tsx) — concluído e já em produção
Essa correção (campo de quantidade de horas em HH:MM em vez de decimal) e a lógica de crédito/débito somado às horas trabalhadas no dia estão commitadas e deployadas (aparecem em commits como "Correção ocorrência com horas trabalhadas", "Ocorrência em turnos" etc. — inclusive houve trabalho adicional depois, "Banco de Horas", "Correção horas debito", que não acompanhei em detalhe nesta sessão).

3. Próximo passo pendente é seu
Falta rodar em produção os 3 UPDATE que te passei (zerar pontomobile_id de id 660, 587 e 509) e, no próximo deploy, a migration 041 trava o campo como único definitivamente. Quer que eu confira de novo os dados de produção antes, já que um mês se passou desde a análise original?

o fonte do backend esta neste local:
/home/adelson/Documentos/Projetos/NodeJS/sirrus-ponto-backend