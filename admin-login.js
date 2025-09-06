import { auth, db } from "./firebaseConfig.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

const form = document.getElementById("loginForm");
const btnLogin = document.getElementById("btnLogin");
const btnReset = document.getElementById("btnReset");
const erro = document.getElementById("erro");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  erro.textContent = "";

  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value;

  if (!email || !senha) {
    erro.textContent = "Informe e-mail e senha.";
    return;
  }

  try {
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const cred = await signInWithEmailAndPassword(auth, email, senha);

    // Busca o perfil em /usuarios/{uid}
    const perfilSnap = await getDoc(doc(db, "usuarios", cred.user.uid));
    if (!perfilSnap.exists()) throw new Error("Perfil de usuário não encontrado.");

    const perfil = perfilSnap.data();
    // Armazena contexto
    localStorage.setItem("usuarioId", cred.user.uid);
    localStorage.setItem("role", perfil.role || "");
    localStorage.setItem("empresaId", perfil.empresaId || "");
    localStorage.setItem("nomeEmpresa", perfil.nomeEmpresa || "");

    // Redireciona
    window.location.href = "admin.html";
  } catch (e) {
    erro.textContent = "Falha no login: " + (e.message || "Verifique suas credenciais.");
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = "Entrar";
  }
});

btnReset.addEventListener("click", async () => {
  erro.textContent = "";
  const email = document.getElementById("email").value.trim();
  if (!email) {
    erro.textContent = "Digite seu e-mail para receber o link de redefinição.";
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    alert("Enviamos um e-mail para redefinição de senha.");
  } catch (e) {
    erro.textContent = "Erro ao enviar redefinição: " + (e.message || "");
  }
});

// Se já estiver logado, envia para admin
onAuthStateChanged(auth, (user) => {
  if (user && localStorage.getItem("role")) {
    window.location.href = "admin.html";
  }
});
