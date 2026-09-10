import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './g02-android-navigation.css';
import './g03-settings.css';
import './g04-sales.css';
import './g04-documents.css';
import './g05-templates.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
