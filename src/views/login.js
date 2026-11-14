import { sendLoginEmail, verifyCode } from '../store.js';
import { esc } from '../utils.js';

const ui = { step: 'email', email: '', error: '' };

export function renderLogin() {
  return `
  <div class="login">
    <div class="login-card">
      <div class="logo">S</div>
      <h1>StuPro</h1>
      <p class="muted">Ton agenda d'examens, devoirs et révisions.</p>
      ${
        ui.step === 'email'
          ? `<form data-step="email">
              <label class="field">
                <span>Adresse e-mail</span>
                <input type="email" name="email" required autocomplete="email" placeholder="toi@exemple.com" value="${esc(ui.email)}" />
              </label>
              <button class="btn btn-primary btn-block" type="submit">Recevoir le code de connexion</button>
            </form>`
          : `<form data-step="code">
              <p>Un e-mail a été envoyé à <strong>${esc(ui.email)}</strong>.<br/>Clique sur le lien, ou entre le code reçu :</p>
              <label class="field">
                <span>Code</span>
                <input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6,10}" required placeholder="123456" />
              </label>
              <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
              <button class="link" type="button" data-back>Changer d'adresse</button>
            </form>`
      }
      ${ui.error ? `<p class="error">${esc(ui.error)}</p>` : ''}
    </div>
  </div>`;
}

export function bindLogin(root, rerender) {
  root.querySelector('[data-back]')?.addEventListener('click', () => {
    ui.step = 'email';
    ui.error = '';
    rerender();
  });
  root.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    ui.error = '';
    try {
      if (ui.step === 'email') {
        ui.email = e.target.email.value.trim();
        await sendLoginEmail(ui.email);
        ui.step = 'code';
      } else {
        await verifyCode(ui.email, e.target.code.value.trim());
        return; // onAuthStateChange relance l'affichage
      }
    } catch (err) {
      ui.error = err.message.includes('rate') ? 'Trop de tentatives, réessaie dans une minute.' : 'Erreur : ' + err.message;
    }
    rerender();
  });
}
