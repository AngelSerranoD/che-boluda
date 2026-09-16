/**
 * Ché boluda — punto de entrada.
 * Copyright (c) 2026 Ángel Serrano Domínguez. Todos los derechos reservados.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { crearServicio } from './lib/servicio/index.js';
import { escucharGestos } from './lib/audio/motor.js';
import { registrarServiceWorker } from './registrarServiceWorker.js';
import './index.css';

const servicio = crearServicio();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App servicio={servicio} />
  </StrictMode>
);

escucharGestos();
registrarServiceWorker();
