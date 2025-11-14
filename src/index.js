import React from 'react';
import ReactDOM from 'react-dom/client';

// Importa o CSS principal que carrega o Tailwind
import './index.css';

// Importa o seu componente principal
import App from './App';

// Pega a 'div' com id 'root' do public/index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Renderiza o seu App dentro dela
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);