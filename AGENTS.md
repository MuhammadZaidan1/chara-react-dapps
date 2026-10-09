# AGENTS.md — chara-frontend

## Commands
- `npm run dev` — start dev server (Vite)
- `npm run build` — production build
- `npm run lint` — run ESLint on all files
- `npm run preview` — preview production build

## Project Structure
- React 19 + Vite (JavaScript, no TypeScript)
- Entry: `src/main.jsx` → `src/App.jsx`
- Assets in `src/assets/`, public icons in `public/`
- Smart contract docs/ABIs in `docs/smartcontract/` and `docs/abi/`

## Linting
- ESLint flat config (`eslint.config.js`)
- Rules: `eslint:recommended` + `react-hooks` + `react-refresh`
- Ignores `dist/` directory

## Notes
- No test framework configured
- No TypeScript — typecheck not applicable
- No codegen, migrations, or special env loading