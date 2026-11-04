import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { setupPwa } from './pwa/register';
import { watchVisibility } from './stores/data';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Falta el elemento #root');

setupPwa();
watchVisibility();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
