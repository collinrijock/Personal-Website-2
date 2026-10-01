# the nda gate

Some of Collin's work on collinrijock.com, from Exowatt and his own projects, is shared only with people who sign a short NDA and whom he approves by hand. Collin decided (2026-10-01) to include employer work here; what goes in the section files is his call. This doc covers how the gate works, what to set on the server, and how to run it day to day.

## sections

The private page has four fixed sections. Collin approves each person for one or more of them, and can change that later.

| id | heading on /nda | what |
|---|---|---|
| `exowatt` | exowatt | work at exowatt |
| `grunts` | grunts | grunts.dev, the agent company with felipe |
| `personal` | personal projects | his own projects |
| `previous` | previous employers | work from earlier jobs |

The list lives in `lib/nda/sections.ts`; `scripts/nda.mjs` keeps a copy of the ids. Each section is one markdown file, `NDA_DATA_DIR/sections/<id>.md`. `/nda` always shows sections in the order above.

## the flow

1. **The canvas.** The "what i've built" section has a locked strip, "things i've made · under nda", with redacted placeholder cards and a **request access** button. There is also a plain text link under the board. Both open the request modal. The agents never sort cards into or out of the strip.
2. **The modal.** It asks for a name, an email, a company (optional), a short note on what they'd like to see and why, and (optionally) which of the four sections they're most interested in. That last one is only a hint for Collin: what they can see is his call. It shows the agreement, which it loads from `GET /api/nda/terms`, so what's signed is exactly the server's text. The person types their full name to sign and checks "i agree". The modal also has a hidden honeypot field.
3. **`POST /api/nda/request`.** This checks that the post comes from the same origin and that the gate is open. It then checks the honeypot, rate limits (5 an hour per IP, 3 a day per email, and one pending request per email), validates the input and length limits, and checks that the signature matches the name and that the agreement version is current.
   - It appends the request to `requests.jsonl` with status `pending`.
   - Interests outside the four ids are refused (400).
   - It emails `NDA_OWNER_EMAIL` all the details (including what they're most interested in), the signed text, a row of approve buttons and a **Deny** button. The Reply-To is the requester.
   - Email can't run JavaScript, so there's one approve link per preset: **approve all**, **exowatt only**, **grunts only**, **personal only**, **previous employers only**, and **choose…**, which starts with whatever they said they're most interested in. Each preset's sections are in its signed token.
4. **`/nda/decide?token=…`.** Each button carries an HMAC-signed token holding the request id, the action, a 14-day expiry and, for approve links, the preset sections. Opening the link only *shows* the request and a confirm button, so link scanners that prefetch it can't decide anything. A request can only be decided once: a second decision gets a 409.
   - **An approve link** shows four toggle chips, ticked from the token and editable, and a **confirm: approve with N sections** button. N updates live in CSS (a counter over the ticked boxes), because the page ships no JavaScript. With nothing ticked, the button goes inert and the page says to pick at least one. A separate **deny instead** button sits under it; it posts a deny token for the same request that the page mints when it renders.
   - **A deny link** shows a **confirm: deny** button.
   - **`POST /api/nda/decide`** verifies the token again and decides the request. An approval needs `sections`: one field per ticked box from the form, or a JSON array. Every value must be one of the four ids, or the post gets a 400. An empty list gets a 422; the form path goes back to the page with "pick at least one section". In both cases nothing is decided. The sections come from the post, not the token: the token only sets the starting ticks. The approved status line stores them: `{"t":"status","status":"approved","sections":["exowatt","personal"],…}`.
   - **On approve**, the requester gets an email with a private link, `/nda/access?token=…`, valid for 90 days. It lists the sections they can see and includes a copy of what they signed.
   - **On deny**, the requester gets a short, polite note unless `NDA_NOTIFY_DENIED=0`.
5. **`/nda/access?token=…`.** This checks the token and that the request is still `approved`. It sets the `nda_access` cookie for 90 days (HttpOnly, Secure, SameSite=Lax, Path=/nda, signed) and redirects to `/nda`.
6. **`/nda`.** This page is server-rendered. It checks the cookie's signature and expiry, and checks that the request is still `approved` in the store. Only then does it read the files for the sections that person was granted and render each under its own heading, in the fixed order, with "shared under nda with {name}" at the top.
   - The grant is read fresh from the request log on every load, so `grant`, `ungrant` and `revoke` apply on the next load.
   - Files for sections they weren't granted are never read, so their content can't reach the client.
   - If a granted section's file is missing or empty, that section says "nothing here yet."
   - Anyone else gets the lock page, and the content never leaves the server.
   - `/nda`, `/nda/*` and `/api/nda/*` send `Cache-Control: private, no-store`, `X-Robots-Tag: noindex` and `Referrer-Policy: no-referrer`. `robots.txt` disallows `/nda`.
   - The pages ship no JavaScript.

Tokens are `base64url(json).base64url(hmac-sha256)`, keyed by `NDA_SECRET` and compared in constant time. The purpose (`decide`, `access` or `cookie`) is inside the signed payload, so one kind of token can't be replayed as another.

## files

| file | what |
|---|---|
| `lib/nda/nda-text.ts` | the agreement (a template: have a lawyer review it), its revision, and `NDA_VERSION` (a hash of the text) |
| `lib/nda/config.ts` | every env var, with its default |
| `lib/nda/flow.ts` | request / decide / access logic |
| `lib/nda/store.ts` | append-only `requests.jsonl`, lock file, saved copy of each signed version |
| `lib/nda/token.ts` | signed tokens |
| `lib/nda/mail.ts`, `lib/nda/emails.ts` | nodemailer transport and the three emails |
| `lib/nda/sections.ts` | the four sections: ids, labels, order, and parsing a posted list |
| `lib/nda/markdown.ts`, `lib/nda/content.ts` | the escaped markdown renderer and the per-section content loader |
| `pages/api/nda/{terms,request,decide}.ts` | the api |
| `pages/nda/{index,decide,access}.tsx` | the pages |
| `scripts/nda.mjs` | the cli |
| `docs/sections.example/<id>.md` | the shape of each section file (placeholders only) |
| `public/js/nda.js`, `public/css/nda.css` | the modal and page styles; the canvas strip is in `public/js/board.js` and `public/css/board.css` |

The front-end source of truth is `personal-sites-2026-09-27/site-e-gradient/`. Copy changed files into `public/` from there.

## env vars

Set these in `~/srv/personal-website/shared/personal-website.env`. The launchd service sources that file before `node server.js`.

| var | default | what |
|---|---|---|
| `NDA_SECRET` | none, **required** | signs every token and cookie. 32+ random bytes. changing it logs everyone out and kills every outstanding link |
| `NDA_OWNER_EMAIL` | `collinrijock@gmail.com` | where requests go |
| `NDA_DATA_DIR` | `~/srv/personal-website/shared/nda` | the request log, saved nda versions, the section files (`sections/`), the test outbox. must be outside `standalone/` (the deploy rsyncs that with `--delete`) |
| `SITE_URL` | `https://collinrijock.com` | used to build the links in emails. no trailing slash |
| `SMTP_HOST` | `smtp.gmail.com` | |
| `SMTP_PORT` | `465` | 465 means implicit TLS. 587 uses STARTTLS |
| `SMTP_USER` | none | the gmail address that sends |
| `SMTP_PASS` | none | a gmail **app password**, not the account password |
| `MAIL_FROM` | `collin rijock <SMTP_USER>` | gmail only allows the account itself or a verified alias |
| `MAIL_TRANSPORT` | unset (smtp when `SMTP_USER` + `SMTP_PASS` are set) | `file` writes `.eml` + `.html` into `NDA_DATA_DIR/outbox/` instead of sending. `off` closes requests |
| `NDA_NOTIFY_DENIED` | on | set to `0` to send nothing on deny |

**When requests are open.** Requests are only open with a secret of 16+ characters **and** working mail (SMTP credentials, or `MAIL_TRANSPORT=file`). Otherwise:

- `POST /api/nda/request` returns **503** "requests aren't open yet." instead of dropping the request.
- The modal and the canvas button say so.

The server log says why (`nda: request refused, closed: …`).

## set it up on the server

Do this once, on the Mac that runs the site.

1. **Create a Gmail app password.** This needs 2-Step Verification on the Google account.
   - Go to <https://myaccount.google.com/apppasswords> and sign in.
   - Name it "collinrijock.com nda" and create it.
   - Copy the 16-character password. Spaces don't matter.
2. **Make the data dir:**
   ```sh
   mkdir -p ~/srv/personal-website/shared/nda && chmod 700 ~/srv/personal-website/shared/nda
   ```
3. **Write the section files.** Start from the examples, then write the real content:
   ```sh
   mkdir -p ~/srv/personal-website/shared/nda/sections   # from a checkout of this repo:
   cp docs/sections.example/*.md ~/srv/personal-website/shared/nda/sections/
   chmod 700 ~/srv/personal-website/shared/nda/sections && chmod 600 ~/srv/personal-website/shared/nda/sections/*.md
   ```
   Delete the comment block at the top of each copy. A section with no file shows "nothing here yet" to the people granted it, so it's fine to fill them in one at a time. `/nda` reads the files on every request, so edits show up without a deploy.

   **The older single file still works.** While there are no section files at all, `NDA_DATA_DIR/projects.md` (or `projects.json`: an array of `{ "title", "summary", "body" (markdown), "tags": [], "links": [{ "label", "href" }] }`) is the `personal` section. Once any section file exists, `projects.md` is ignored. An approval from before sections existed has no list on its status line and counts as `personal` only.
4. **Add the env vars** to `~/srv/personal-website/shared/personal-website.env`:
   ```sh
   NDA_SECRET=<output of: openssl rand -base64 48>
   NDA_OWNER_EMAIL=collinrijock@gmail.com
   NDA_DATA_DIR=/Users/collinrijock/srv/personal-website/shared/nda
   SITE_URL=https://collinrijock.com
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=collinrijock@gmail.com
   SMTP_PASS=<the app password>
   MAIL_FROM="collin rijock <collinrijock@gmail.com>"
   ```
   The service sources this file with a shell, so keep the quotes around any value with spaces or `<>`, like `MAIL_FROM`. Unquoted, the `<` would be read as a redirect.
5. **Restart:**
   ```sh
   launchctl kickstart -k gui/$(id -u)/com.personal-website.web
   ```
   A deploy (push to master) also restarts it.
6. **Smoke test:**
   - `curl -s https://collinrijock.com/api/nda/terms | head -c 80` should show `"open":true`.
   - Send yourself a request from the canvas, approve it from the email, open the link, then revoke it (below).

## day to day

Load the env first, from a checkout of this repo on the server:

```sh
set -a; . ~/srv/personal-website/shared/personal-website.env; set +a
node scripts/nda.mjs list                        # pending + approved, newest first, with sections (--all for everything)
node scripts/nda.mjs show <id>                   # one request and its history, sections included
node scripts/nda.mjs grant <id> grunts previous  # let them see more; applies on their next load
node scripts/nda.mjs ungrant <id> exowatt        # take sections away; applies on their next load
node scripts/nda.mjs revoke <id>                 # ends access now: their cookie and link stop working on the next load
node scripts/nda.mjs approve <id> exowatt grunts # approve from the cli (also re-approves a revoked one); prints a link to send them
node scripts/nda.mjs deny <id>                   # deny from the cli, no email
node scripts/nda.mjs link <id>                   # a fresh 90-day access link for someone already approved
```

- **Sections on the CLI** are the ids `exowatt`, `grunts`, `personal` and `previous`, or `all`. Space or comma separated both work.
- **`approve` with no sections** reuses the last grant (for example when re-approving someone you revoked). For a request that was never approved, it asks you to name them.
- **`grant` and `ungrant`** only work on approved requests. Each appends another `approved` status line carrying the full new list, so the history shows every change. `ungrant` won't leave someone with zero sections; use `revoke` for that.
- **In `list`,** the sections column shows what approved people can see, and, in parentheses, what pending people said they're most interested in.

- `requests.jsonl` is append-only. A request is one line, and every status change is another line, so the history is the file. The CLI and the site share a lock file (`requests.lock`), so they don't race.
- The first time a version of the agreement is signed, its exact text is saved to `NDA_DATA_DIR/nda-versions/<version>.txt`.
- **To change the agreement**, edit `lib/nda/nda-text.ts` and bump `NDA_REVISION`. The hash changes on its own. Anyone with the modal open is asked to reload.
- **If an approval email fails to send**, the decide page says so. Run `node scripts/nda.mjs link <id>` and send the link yourself.
- **To log everyone out**, rotate `NDA_SECRET`. It also kills every outstanding approve, deny and access link.

## test it locally

```sh
bun install && bun run build
mkdir -p /tmp/nda-standalone && rsync -a .next/standalone/ /tmp/nda-standalone/ \
  && rsync -a .next/static/ /tmp/nda-standalone/.next/static/ && rsync -a public/ /tmp/nda-standalone/public/
mkdir -p /tmp/nda-test/sections && for s in exowatt grunts personal previous; do printf "# $s\n\nfake.\n\n## a $s project\n\nnot real.\n" > /tmp/nda-test/sections/$s.md; done
cd /tmp/nda-standalone && PORT=3102 HOSTNAME=127.0.0.1 NODE_ENV=production NDA_SECRET=dummy-test-secret-0123456789abcdef \
  NDA_DATA_DIR=/tmp/nda-test SITE_URL=http://127.0.0.1:3102 NDA_OWNER_EMAIL=owner@example.test MAIL_TRANSPORT=file node server.js
```

Emails land in `/tmp/nda-test/outbox/`. `site-e-gradient/tools/shots-nda.mjs [base] [data dir] [repo]` drives the whole flow with Playwright. It covers:

- the canvas, the modal and its interests chips
- the approve presets and the deny link
- choosing and editing sections, zero and forged section lists, and "deny instead"
- access, with only the granted sections in the HTML
- the lock page, forged and expired tokens, second decisions, and limits
- the CLI, including `grant` / `ungrant`, a missing section file, and the `projects.md` fallback

It writes its own fake section files into `<data dir>/sections/` and `shots/nda-*.png`. Run it against a freshly started server, because the rate limits are in memory and a second run on the same server trips them.

The standalone `server.js` forks, and the child holds the port. To stop it, kill both PIDs (`lsof -tnP -iTCP:3102 -sTCP:LISTEN` gives the child).

## limits worth knowing

- The access link is a bearer link for 90 days: whoever opens it gets the cookie. The agreement forbids sharing it, and you can revoke it at any time.
- The per-IP and per-email rate limits are in memory and reset on restart. The one-pending-request-per-email rule lives in the file and survives restarts.
- The client IP comes from `cf-connecting-ip`, falling back to `x-forwarded-for` and then the socket. That's right as long as the origin is only reachable through Cloudflare.
- `lib/nda/nda-text.ts` is a plain-English template, not legal advice. Have a lawyer read it.
