import { signIn, signUp } from '../store.js';
import { esc } from '../utils.js';

const ui = { mode: 'login', email: '', error: '' }; // mode : 'login' | 'signup'

function frError(err) {
  const m = err.message || '';
  if (/invalid login credentials/i.test(m)) return 'E-mail ou mot de passe incorrect.';
  if (/already registered|already exists/i.test(m)) return 'Un compte existe déjà avec cet e-mail. Connecte-toi.';
  if (/password should be at least/i.test(m)) return 'Le mot de passe doit contenir au moins 6 caractères.';
  if (/rate|too many/i.test(m)) return 'Trop de tentatives, réessaie dans une minute.';
  if (/fetch|network/i.test(m)) return 'Pas de connexion internet.';
  return m;
}

export function renderLogin() {
  const signup = ui.mode === 'signup';
  return `
  <div class="login">
    <div class="login-card">
      <div class="logo">S</div>
      <h1>StuPro</h1>
      <p class="muted">Ton agenda d'examens, devoirs et révisions.</p>
      <form>
        <label class="field">
          <span>Adresse e-mail</span>
          <input type="email" name="email" required autocomplete="email" placeholder="toi@exemple.com" value="${esc(ui.email)}" />
        </label>
        <label class="field">
          <span>Mot de passe</span>
          <input type="password" name="password" required minlength="6"
            autocomplete="${signup ? 'new-password' : 'current-password'}" placeholder="${signup ? '6 caractères minimum' : '••••••'}" />
        </label>
        <button class="btn btn-primary btn-block" type="submit">${signup ? 'Créer mon compte' : 'Se connecter'}</button>
        ${ui.error ? `<p class="error">${esc(ui.error)}</p>` : ''}
        <button class="link" type="button" data-switch>
          ${signup ? "J'ai déjà un compte — me connecter" : 'Pas encore de compte ? En créer un'}
        </button>
      </form>
    </div>
  </div>`;
}

export function bindLogin(root, rerender) {
  root.querySelector('[data-switch]').addEventListener('click', () => {
    ui.mode = ui.mode === 'login' ? 'signup' : 'login';
    ui.email = root.querySelector('[name=email]').value;
    ui.error = '';
    rerender();
  });
  root.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    ui.email = e.target.email.value.trim();
    ui.error = '';
    try {
      await (ui.mode === 'signup' ? signUp : signIn)(ui.email, e.target.password.value);
      return; // onAuthStateChange affiche l'app
    } catch (err) {
      ui.error = frError(err);
    }
    rerender();
  });
}
