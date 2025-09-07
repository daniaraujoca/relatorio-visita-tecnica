// firebaseConfig.js
// Inicializa o Firebase e exporta Firestore (db), Authentication (auth) e firebaseConfig

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";

// Configuração real do seu projeto Firebase
export const firebaseConfig = {
  apiKey: "AIzaSyDl3MWTjqSf4T6l7Xb2pHozJpnkaMlnPZY",
  authDomain: "relatorio-visita-tecnica2025.firebaseapp.com",
  projectId: "relatorio-visita-tecnica2025",
  storageBucket: "relatorio-visita-tecnica2025.firebasestorage.app",
  messagingSenderId: "823053045465",
  appId: "1:823053045465:web:ccb6c4a0aa1dee303cb8c8"
};

// Inicializa o app principal (ou reaproveita se já existir)
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exporta instâncias para uso no projeto
export const db = getFirestore(app);
export const auth = getAuth(app);
