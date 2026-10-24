// App — étape 3 : délègue au routeur centralisé + shell applicatif.
// Les providers globaux (Redux, Persist, Theme, Query, Toast) restent
// dans src/index.js. L'ancien Layout antd est remplacé par AppShell
// (src/app/shell) — voir docs/MIGRATION_PLAN.md étape 3.
import AppRouter from './app/router/AppRouter';

function App() {
  return <AppRouter />;
}

export default App;
