// TEMPLATE. this is a plain-english starting point that collin wrote with an
// agent, not legal advice. have a lawyer review it before relying on it.
//
// the text is versioned two ways: NDA_REVISION is the human label, and
// NDA_VERSION is a hash of the exact text. every signature stores the hash, and
// the first time a version is signed the full text is saved next to the
// requests (NDA_DATA_DIR/nda-versions/<version>.txt), so you can always show
// exactly what someone agreed to. change a single character and the hash
// changes, and anyone with the modal open is asked to reload and read it again.

import { createHash } from "crypto";

export const NDA_REVISION = "2026-10-01";
export const NDA_TITLE = "confidentiality agreement (one-way)";

export const NDA_TEXT = `CONFIDENTIALITY AGREEMENT (ONE-WAY)
Revision ${NDA_REVISION}

This agreement is between Collin Rijock, acting personally ("I" or "me"), and the person who signs it below ("you"). I am not signing on behalf of any employer or company, and nothing here binds one, but the agreement protects their work that I show you just as it protects mine.

1. What's covered. "Confidential information" means the projects and work I show you on the private page at collinrijock.com/nda, including work I have done for employers and companies I have worked with, and anything I tell you or send you about them: project descriptions, screenshots, designs, code, plans, numbers and notes, whether or not it is marked confidential. Which parts of that page you can see depends on the sections I approve for you, and I may add or remove sections at any time; everything I show you is covered, whichever section it is in and whenever I show it.

2. What you agree to. You will use the confidential information only to learn about my work and to talk with me about it. You won't share it, or the private link, with anyone else without my written permission (an email is enough). You will protect it with at least reasonable care, and you won't copy, screenshot, record or download it except as needed for that purpose.

3. No reverse engineering. You won't reverse engineer, decompile, or try to work out the source code, designs or methods behind anything I show you, and you won't use it to build something that competes with it.

4. What isn't covered. This agreement doesn't apply to information that (a) is or becomes public through no fault of yours; (b) you already knew before I shared it, as your records show; (c) you develop independently, without using what I shared; or (d) you receive from someone else who is free to share it.

5. If the law requires it. You may disclose confidential information if a law, court or government authority requires you to. If you're allowed to, tell me first so I can respond, and disclose only what is required.

6. Returning or deleting it. If I ask, you will promptly return or delete any confidential information you have, including copies and notes, and confirm that you have.

7. Term. This agreement lasts two (2) years from the date you sign it, and your duties under it last for that whole period, even if your access ends sooner.

8. No license, no obligation. I keep all rights in my confidential information. Nothing here gives you a license to it or obliges either of us to do any further deal. It is shared as-is, with no promises about it.

9. If it's broken. Sharing confidential information could harm me in ways money can't fix, so if you break this agreement I may ask a court to stop it, in addition to anything else the law allows.

10. Governing law. Florida law governs this agreement. Any dispute will be handled in the state or federal courts in Miami-Dade County, Florida.

11. The whole agreement. This is the entire agreement between us about the confidential information. It can only be changed in writing signed (or typed and agreed electronically) by both of us. If any part of it can't be enforced, the rest still applies.

12. Electronic signature. By typing your full name and checking "i agree", you agree to sign this electronically, and that your typed name is your signature and as binding as a handwritten one, under the U.S. E-SIGN Act and Florida's Uniform Electronic Transaction Act. You agree to receive this agreement and any notices about it by email. A copy will be emailed to you if your request is approved.`;

export const NDA_VERSION = `${NDA_REVISION}.${createHash("sha256").update(NDA_TEXT).digest("hex").slice(0, 12)}`;
