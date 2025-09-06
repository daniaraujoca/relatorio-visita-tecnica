// firebaseConfig.js
// Inicializa o Firebase e exporta Firestore (db) e Authentication (auth)

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";

// Configuração do seu projeto Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBliSebIXe22a3I_nyp8iy9dUIwOQVzTrw",
  authDomain: "relatorio-visita-tecnica.firebaseapp.com",
  projectId: "relatorio-visita-tecnica",
  storageBucket: "relatorio-visita-tecnica.firebasestorage.app",
  messagingSenderId: "246351178619",
  appId: "1:246351178619:web:93ef3a2bb6473e766aabde",
  measurementId: "G-W3LD87GW5C"
};

// Evita inicializar mais de uma vez
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Exporta para uso nos outros arquivos
export const db = getFirestore(app);
export const auth = getAuth(app);
