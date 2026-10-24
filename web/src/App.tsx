// Standalone UI-only default entry. The former engine/CDS-connected app is preserved, unmounted,
// in ConnectedApp.tsx for later backend wiring. This default mounts the controlled presentation
// view (RxGeneUI) via its synthetic demo adapter — no engine, no network, no fetch.
import RxGeneDemo from '@/ui/RxGeneDemo';

function App() {
  return <RxGeneDemo />;
}

export default App;
