// firebaseConfig.js
// Inicializa o Firebase e exporta Firestore (db) e Authentication (auth)

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDl3MWTjqSf4T6l7Xb2pHozJpnkaMlnPZY",
  authDomain: "relatorio-visita-tecnica2025.firebaseapp.com",
  projectId: "relatorio-visita-tecnica2025",
  storageBucket: "relatorio-visita-tecnica2025.firebasestorage.app",
  messagingSenderId: "823053045465",
  appId: "1:823053045465:web:ccb6c4a0aa1dee303cb8c8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exporta para uso nos outros arquivos
export const db = getFirestore(app);
export const auth = getAuth(app);
