// nda.js — the "request access" modal for the projects under nda.
// anything with [data-nda-open] opens it (the button on the canvas's locked
// strip, the line under the board). it loads the agreement from the server, so
// what's signed is exactly what the server will store, and posts the request
// to /api/nda/request. /#request-access opens it on load (the /nda lock page
// links there). the optional "most interested in" boxes are a hint for collin;
// he picks what they can see when he approves.

const dlg = document.getElementById('nda-dialog');
const form = dlg?.querySelector('.nda-form');

if (dlg && form) {
  const sent = dlg.querySelector('.nda-sent');
  const msg = form.querySelector('.nda-msg');
  const textBox = form.querySelector('.nda-text');
  const verEl = form.querySelector('.nda-ver');
  const closedEl = form.querySelector('.nda-closed');
  const send = form.querySelector('.nda-send');
  let terms = null, loading = null, busy = false;

  const say = (text, kind = 'err') => { msg.textContent = text; msg.dataset.kind = kind; };

  function setClosed(closed) {
    closedEl.hidden = !closed;
    send.disabled = closed;
    for (const b of document.querySelectorAll('[data-nda-open]')) {
      if (closed) b.setAttribute('data-closed', ''); else b.removeAttribute('data-closed');
      const lbl = b.querySelector('.lbl');
      if (lbl) lbl.textContent = closed ? "requests aren't open yet" : 'request access';
    }
  }

  function showTerms(t) {
    textBox.replaceChildren(...t.text.split(/\n\n/).map((para, i) => {
      const p = document.createElement(i === 0 ? 'h3' : 'p');
      p.textContent = para;
      return p;
    }));
    verEl.textContent = `· version ${t.version}`;
  }

  function loadTerms() {
    if (terms) return Promise.resolve(terms);
    if (loading) return loading;
    loading = fetch('/api/nda/terms', { cache: 'no-store', headers: { accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((t) => { terms = t; showTerms(t); setClosed(!t.open); return t; })
      .catch(() => {
        textBox.replaceChildren(Object.assign(document.createElement('p'), { className: 'nda-loading', textContent: "the agreement didn't load. check your connection and try again." }));
        send.disabled = true;
        return null;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  function open() {
    if (!dlg.open) dlg.showModal();
    form.hidden = false; sent.hidden = true;
    if (!busy) say('', '');
    loadTerms().then(() => { if (!form.querySelector('[name="name"]').value) form.querySelector('[name="name"]').focus(); });
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest?.('[data-nda-open]');
    if (t) { e.preventDefault(); open(); return; }
    if (e.target.closest?.('[data-nda-close]') && dlg.contains(e.target)) { e.preventDefault(); dlg.close(); }
  });

  // a fixed field clears the last complaint
  form.addEventListener('input', () => { if (msg.dataset.kind === 'err') say('', ''); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(form);
    const v = (k) => String(f.get(k) || '').trim();
    const body = {
      name: v('name'), email: v('email'), company: v('company'), reason: v('reason'),
      interests: f.getAll('interests').map(String),
      signature: v('signature'), agree: f.get('agree') === 'on', website: v('website'),
      nda_version: terms?.version || '',
    };
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ');
    const bad =
      body.name.length < 2 ? ['name', 'please enter your full name.'] :
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) ? ['email', "that email doesn't look right."] :
      body.reason.length < 4 ? ['reason', "say a few words about what you'd like to see and why."] :
      !body.signature ? ['signature', 'type your full name to sign.'] :
      norm(body.signature) !== norm(body.name) ? ['signature', 'the signature has to match your full name.'] :
      !body.agree ? ['agree', 'check "i agree" to sign.'] : null;
    if (bad) { say(bad[1]); form.querySelector(`[name="${bad[0]}"]`)?.focus(); return; }
    if (!terms) { say("the agreement didn't load, so there's nothing to sign yet."); return; }
    busy = true; send.disabled = true; send.textContent = 'sending…'; say('', '');
    try {
      const r = await fetch('/api/nda/request', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) });
      const out = await r.json().catch(() => ({}));
      if (r.ok && out.ok) {
        form.reset();
        form.hidden = true; sent.hidden = false;
        sent.querySelector('.nda-sent-h').focus();
      } else {
        if (r.status === 503) setClosed(true);
        if (r.status === 409) { terms = null; loadTerms(); } // the agreement changed: show the new text
        say(out.error || 'something went wrong. please try again.');
      }
    } catch {
      say("couldn't reach the server. check your connection and try again.");
    } finally {
      busy = false; send.textContent = 'sign and send';
      if (closedEl.hidden && terms) send.disabled = false;
    }
  });

  if (location.hash === '#request-access') {
    addEventListener('load', () => {
      document.querySelector('[data-board]')?.scrollIntoView({ block: 'center' });
      open();
    }, { once: true });
  }
}
