// Production entry: mounts the real engine/backend-connected adapter for the RxGeneUI
// desktop presentation view. RxGeneDemo (synthetic fixtures, no engine/network) and
// ConnectedApp (the prior engine-connected screen) stay in the tree unmounted, for reference.
import RxGeneConnected from '@/ui/RxGeneConnected';

function App() {
  return <RxGeneConnected />;
}

export default App;
