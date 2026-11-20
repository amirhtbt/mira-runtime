import { createRoot } from 'react-dom/client';
import { OfflineApp } from './OfflineApp';
import { openOfflineStore } from './offlineStore';
import '../styles.css';
import '../g02-android-navigation.css';
import '../g03-settings.css';
import '../g04-sales.css';
import '../g04-documents.css';
import '../g05-templates.css';
import '../g05-template-theme.css';
import '../g06-export.css';
import '../g07-history.css';
import './offline.css';

const root = createRoot(document.getElementById('root')!);
root.render(<main className="page" role="status">در حال باز کردن آرشیو گوشی…</main>);
void openOfflineStore().then(store => root.render(<OfflineApp store={store} />)).catch(() => {
  root.render(<main className="page" role="alert">آرشیو گوشی باز نشد. برنامه را دوباره باز کنید.</main>);
});
