import { auth, db } from "./firebaseConfig.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.3.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.3.1/firebase-firestore.js";

const form = document.getElementById("loginForm");
const btnLogin = document.getElementById("btnLogin");
const loginError = document.getElementById("loginError");
const loadingLogin = document.getElementById("loadingLogin");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";
  const email = form.email.value.trim();
  const senha = form.senha.value;

  if (!email || !senha) {
    loginError.textContent = "Informe e-mail e senha.";
    return;
  }

  try {
    btnLogin.disabled = true;
    loadingLogin.style.display = "block";

    const cred = await signInWithEmailAndPassword(auth, email, senha);
    const perfilSnap = await getDoc(doc(db, "usuarios", cred.user.uid));
    if (!perfilSnap.exists()) {
      throw new Error("Perfil não encontrado.");
    }

    const perfil = perfilSnap.data();
    const role = (perfil.role || "").toLowerCase();
    localStorage.setItem("usuarioId", cred.user.uid);
    localStorage.setItem("role", role);
    localStorage.setItem("empresaId", perfil.empresaId || "");
    localStorage.setItem("nomeEmpresa", perfil.nomeEmpresa || "");

    // Redireciona conforme o papel
    if (role === "tecnico") {
      window.location.href = "visita.html";
    } else if (role === "admin_empresa" || role === "superadmin") {
      window.location.href = "admin.html";
    } else {
      throw new Error("Papel de usuário inválido.");
    }

  } catch (err) {
    loginError.textContent = "Falha no login: " + err.message;
  } finally {
    btnLogin.disabled = false;
    loadingLogin.style.display = "none";
  }
});

// Se já estiver logado, redireciona automaticamente
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const perfilSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (!perfilSnap.exists()) throw new Error();
      const role = (perfilSnap.data().role || "").toLowerCase();
      if (role === "tecnico") {
        window.location.replace("visita.html");
      } else {
        window.location.replace("admin.html");
      }
    } catch {
      await signOut(auth);
      localStorage.clear();
    }
  }
});
