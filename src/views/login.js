import { sendLoginEmail } from '../store.js';
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
              <button class="btn btn-primary btn-block" type="submit">Recevoir le lien de connexion</button>
            </form>`
          : `<form data-step="sent">
              <p>📬 Un e-mail a été envoyé à <strong>${esc(ui.email)}</strong>.</p>
              <p>Ouvre-le sur cet appareil et clique sur le lien <em>« Log In »</em> pour te connecter.</p>
              <p class="hint">Pas reçu ? Regarde dans les spams, ou attends une minute avant de réessayer.</p>
              <button class="link" type="button" data-back>Changer d'adresse / renvoyer</button>
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
      ui.email = e.target.email.value.trim();
      await sendLoginEmail(ui.email);
      ui.step = 'sent';
    } catch (err) {
      ui.error = err.message.includes('rate') ? 'Trop de tentatives, réessaie dans une minute.' : 'Erreur : ' + err.message;
    }
    rerender();
  });
}
