# 🚦 COORDINAMENTO MULTI-TERMINALE

> Lavagna condivisa per i 3 terminali Claude Code che lavorano in parallelo sul sito **Nino's Private Chefs**.
> **REGOLA D'ORO:** prima di toccare un file, controlla qui sotto che non lo stia già modificando un altro terminale. Aggiorna la tua riga PRIMA di iniziare e DOPO aver finito.

---

## 👷 Chi sta lavorando su cosa (stato live)

| Terminale | Area assegnata | File in lavorazione adesso | Stato |
|-----------|----------------|----------------------------|-------|
| **T1 — Frontend/UI** | pagine `.astro`, componenti, layout, styling | _(nessuno)_ | 🟢 libero |
| **T2 — Backend/API+DB** | `src/pages/api/`, Supabase, migrations | _(nessuno)_ | 🟢 libero |
| **T3 — Pagamenti/Stripe** | flusso Stripe, payment link, webhook, email | _(nessuno)_ | 🟢 libero |

Legenda stato: 🟢 libero · 🟡 sta lavorando · 🔴 NON toccare (file aperto in scrittura)

---

## 📋 Divisione aree (per evitare collisioni)

- **T1 — Frontend/UI**
  - `src/pages/*.astro` (index, richiesta, login, signup, ecc.)
  - `src/components/`
  - `src/layouts/`
  - styling, copy, immagini

- **T2 — Backend/API + Database**
  - `src/pages/api/` (tranne quelli Stripe → vedi T3)
  - `supabase/migrations/`
  - `src/lib/supabase.ts`
  - RLS, schema, query

- **T3 — Pagamenti/Stripe + Email**
  - tutto ciò che tocca Stripe (payment link, webhook)
  - `src/pages/api/admin/send-payment-link.ts`
  - `src/lib/email.ts`
  - notifiche/email transazionali

⚠️ **File di confine** (li tocca UNO solo alla volta, segnalalo qui): `src/middleware.ts`, `Layout.astro`, `vercel.json`, `astro.config.*`

---

## 🔄 Protocollo Git (IMPORTANTISSIMO)

Per non sovrascriverci a vicenda:

1. **Prima di iniziare:** `git pull --rebase` (prendi il lavoro degli altri)
2. **Commit piccoli e frequenti** con prefisso del terminale: `feat(t1): ...`, `fix(t2): ...`, `chore(t3): ...`
3. **Subito dopo il commit:** `git push` (così gli altri lo vedono)
4. Se `git pull` dà **conflitto** → fermati, scrivilo qui sotto in "Note/Conflitti", non forzare.

---

## 📝 Note / Conflitti / Messaggi tra terminali

> Usa questa sezione come "chat" asincrona: scrivi qui e gli altri leggono al prossimo `git pull` o rilettura file.

- _(es. T2: ho cambiato lo schema bookings, T3 rileggi la tabella prima di toccare i pagamenti)_

---

_Ultimo aggiornamento: 2026-06-03_
