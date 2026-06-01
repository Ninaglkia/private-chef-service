# Mobile Fix Report — Premium Private Chef Site (390px)

_Audit consolidato 2026-06-01 — 4 reviewer (home, booking-funnel, auth-dashboard, admin-legal)._

## Verdetto mobile

Il sito è strutturalmente sano a 390px: niente horizontal-scroll che rompe il layout, le sezioni hanno quasi ovunque uno step responsive (`py-16 md:py-32`), il calendario è già stato corretto (`w-full sm:w-[400px] max-w-[95vw]`) e l'auth flow è centrato e a singola colonna. Il problema vero, ripetuto su ogni pagina, è il `Header` in stato guest che stipa Login + Sign Up + Book Now + hamburger in una barra da 390px, con pill sotto i 44px e CTA duplicate nel menu. Il secondo tema trasversale sono i tap target sotto i 44px (complete-profile, admin, work-with-us) e padding desktop (`p-8`, `pt-32`, `py-20`) senza mobile step che bruciano spazio verticale. Niente di rotto, ma diversi punti tradiscono il "premium feel" su telefono.

## 🔴 Alta priorità

| Pagina | Problema | Fix (file + classe Tailwind) |
|---|---|---|
| Header (tutte le pagine) | In stato guest la barra mobile stipa 3 pill (Login + Sign Up + Book Now) + hamburger a `gap-2` dentro `px-6` su 390px: pill `text-xs py-1.5` (~30px, sotto i 44px), affollate e a rischio overflow. Inoltre il menu aperto duplica Login/Sign Up e **omette** Book Now. | `src/components/Header.astro` (#mobile-guest-actions ~righe 112-133): tenere nella barra **solo Book Now** come pill primaria, spostare Login/Sign Up nel `#mobile-menu`. Container nav `px-6` → `px-4 sm:px-6`. Pill rimanenti `py-1.5`/`py-2` → `py-2.5` e `text-xs` → `text-sm`. Nel `#mobile-menu` (~riga 166) **aggiungere Book Now** e link `py-2` → `py-3`, riposizionare con `top-full mt-2` invece di `top-20`. |
| Home / Hero | H1 parte da `text-5xl` (48px) senza base mobile: "Premium Private Chef Service" va a 3-4 righe e domina la prima viewport. | `src/pages/index.astro:22` — `text-5xl md:text-6xl lg:text-7xl` → `text-4xl sm:text-5xl md:text-6xl lg:text-7xl` (mantenere `leading-tight`). |
| complete-profile | Ogni elemento interattivo è sotto i 44px: input `py-2.5 text-sm` (~38px, e `text-sm` causa zoom-on-focus iOS), country trigger `h-[42px]`, submit `py-2.5`, opzioni dropdown `py-2`. Pagina nettamente meno touch-friendly di booking.astro. | `src/pages/complete-profile.astro` — input (righe 51,91,105) `px-3 py-2.5 text-sm` → `px-4 py-3 text-base`; trigger (riga 61) `h-[42px]` → `h-12`; submit (riga 116) `py-2.5` → `py-3`; opzioni (riga 75) `py-2` → `py-3`. |
| booking / phone dropdown | Dropdown paese `w-80` (320px) absolute dentro card da ~310px utili a 390px: clipping sul bordo destro / rischio overflow orizzontale. | `src/pages/booking.astro:159` — `w-80` → `w-full sm:w-80` (o `w-[min(20rem,calc(100vw-2.5rem))]`). |
| admin / control-panel | Action button booking `px-3 py-1.5 text-xs` (~28-30px) e status `<select> px-2 py-1.5` (~34px), entrambi sotto i 44px, su azioni distruttive (Cancel/Refund). I due bottoni sono adiacenti a soli `gap-2`. | `src/pages/admin/control-panel.astro:144-161,201` — button `px-3 py-1.5` → `px-4 py-2.5 min-h-[44px] text-xs sm:text-sm`; select `px-2 py-1.5` → `px-3 py-2.5 min-h-[44px]`; row `gap-2` → `gap-3`. |
| work-with-us / form | Form `p-8` fisso senza mobile step su una pagina che è il più lungo scroll: padding sprecato e campi schiacciati a 390px. | `src/pages/work-with-us.astro:51` — `p-8` → `p-5 sm:p-8`. |

## 🟠 Media

| Pagina | Problema | Fix (file + classe Tailwind) |
|---|---|---|
| auth (login, signup, forgot-password, reset-password) | Card `p-8` piatto senza mobile step: con `px-4` esterno il form resta a ~260px utili, cramped e poco premium. | Card (riga 11 in tutte e 4): `p-8` → `p-6 sm:p-8`. |
| auth (login, signup, forgot-password, reset-password) | Input `py-2.5 text-sm` (~38px): sotto i 44px e `text-sm` (14px) provoca lo zoom-on-focus di iOS Safari. | Input (es. `login.astro:33,58`): `py-2.5 text-sm` → `py-3 text-base sm:text-sm`. |
| login, signup | Bottone "Continue with Google" `py-2.5` (~38px), sotto i 44px e disallineato dal submit primario (`py-3`). | `login.astro:91`, `signup.astro:82`: `py-2.5` → `py-3`. |
| Home / Hero stat cards | Container `mt-20` (5rem) senza step + card `p-8` fisse: i 3 card stacked finiscono sotto la fold sprecando verticale. | `src/pages/index.astro:37` `mt-20` → `mt-12 sm:mt-20`, `gap-8` → `gap-4 sm:gap-8`; card (38,42,46) `p-8` → `p-6 sm:p-8`; numero `text-4xl` → `text-3xl sm:text-4xl`. |
| Home / Chef carousel | Frecce prev/next `opacity-0 group-hover:opacity-100`: su touch (no hover) invisibili/inutilizzabili; restano solo i dot `h-1.5` non tappabili. | `src/components/ChefCarousel.astro:55-73` — `opacity-0 group-hover:opacity-100` → `opacity-100 md:opacity-0 md:group-hover:opacity-100`; dot (77-83) wrapper tappabile `py-2 px-1`. |
| Home / Meet Chef Nino | Colonna immagine forza `min-h-[400px]` mentre il carousel è già `aspect-[4/5]` (~488px); il pannello gold ruotato (`rotate-3 scale-105`) può sbordare a destra. | `src/pages/index.astro:112` — `min-h-[400px]` → `min-h-0 md:min-h-[400px]` e aggiungere `overflow-hidden` al wrapper. |
| complete-profile | Dropdown paese `w-72` (288px) absolute dentro card da ~290px utili: clipping. | `src/pages/complete-profile.astro:68` — `w-72` → `w-full sm:w-72` (o `w-[min(18rem,calc(100vw-3rem))]`). |
| complete-profile | Card `p-8` piatto senza mobile step. | `src/pages/complete-profile.astro:37` — `p-8` → `p-6 sm:p-8`. |
| booking / sezioni interne | `price-section p-8`, `quote-notice p-6`, `policy p-6` senza step mentre la card padre è già `p-5 sm:p-8`: padding incoerente che spreca larghezza. | `src/pages/booking.astro:275,287,293` — `p-8` → `p-5 sm:p-8`; `p-6` → `p-5 sm:p-6`. |
| confirmation | Card e next-steps `p-8 (md:p-10)` senza mobile step: ~310px utili, cramped e incoerente con booking. | `src/pages/confirmation.astro:80,268,142,343` — `p-8 md:p-10` → `p-5 sm:p-8 md:p-10`; next-steps `p-8` → `p-5 sm:p-8`. |
| confirmation | Detail row `flex justify-between` con valori lunghi (email completa, date estese) senza gap/wrap: si accavallano o vanno strette contro la label. | `src/pages/confirmation.astro` (righe 84-97, 111-121, 282-302) — row → `flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-4`; valore → `text-right break-words min-w-0` (`break-all` sull'email). |
| dashboard | Card booking `p-6` + wrapper `py-12` fissi: card sovradimensionate nello stack verticale del telefono. | `src/pages/dashboard.astro:222` `p-6` → `p-4 sm:p-6`; `:67` `py-12` → `py-8 sm:py-12`. |
| admin / control-panel | Header `flex justify-between items-center` senza wrap: H1 + "Signed in as: <email lunga> [Owner]" non entrano e si schiacciano. | `src/pages/admin/control-panel.astro:95-101` — wrapper → `flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center`; email `break-words`. |
| admin / control-panel | Row nome+badge `flex items-center gap-3` senza wrap: nome lungo + badge si schiacciano. | `src/pages/admin/control-panel.astro:114-119,180-185` — → `flex flex-wrap items-center gap-2 sm:gap-3`. |
| work-with-us | Container `py-20` (80px) senza step: spreca la prima viewport e aggiunge scroll. | `src/pages/work-with-us.astro:9` — `py-20` → `py-12 sm:py-20`. |
| work-with-us | Input/select/textarea nativi `w-full` senza altezza esplicita: spesso sotto i 44px e look "stock" non premium. | `src/pages/work-with-us.astro:59,67,83,87,94,98,105,109,120` — aggiungere `py-3 min-h-[44px]`; file input `file:py-2` → `file:py-2.5`. |

## 🟢 Rifiniture

| Pagina | Problema | Fix (file + classe Tailwind) |
|---|---|---|
| Home / CTA finale | Sezione "Ready to Get Started?" `py-32` senza step (le altre usano `py-16 md:py-32`): ~256px di padding sprecati. | `src/pages/index.astro:485` — `py-32` → `py-16 md:py-32`; callout `:270` `px-6` → `px-5 sm:px-6`. |
| Home / Footer | Grid a 1 colonna ma `gap-16` (4rem) tra i blocchi stacked: troppo vuoto verticale. | `src/components/Footer.astro:7` — `gap-16` → `gap-10 md:gap-16`; `:6` `py-16` → `py-12 md:py-16`. |
| Home / Pricing cards | `p-8` fisso e `min-h-[6rem]`/`min-h-[5.5rem]` di allineamento desktop che impongono vuoto quando le card sono stacked. | `src/components/PricingCard.astro:48` `p-8` → `p-6 sm:p-8`; `:49,54` → `min-h-0 md:min-h-[6rem]` e `min-h-0 md:min-h-[5.5rem]`. |
| Home / FAQ | Summary `text-lg`: domande lunghe vanno a 2-3 righe strette contro il chevron. | `src/pages/index.astro:366-481` — summary `text-lg` → `text-base sm:text-lg`; aggiungere `gap-3 pr-2` alla row. |
| Home / global | Nessun overflow guard globale: un transform stray potrebbe causare scroll orizzontale. | `src/layouts/Layout.astro:102` — body: aggiungere `overflow-x-hidden`. (Viewport meta già corretto.) |
| booking | `pt-32` + `mb-16` sotto l'heading spingono il package selector sotto la fold. | `src/pages/booking.astro:86,89` — `pt-32` → `pt-24 sm:pt-32`; `mb-16` → `mb-10 sm:mb-16`. |
| booking / calendar | Day cell `py-3` (~40px) leggermente sotto i 44px. | `src/pages/booking.astro:230,239` — usare `flex items-center justify-center aspect-square` per celle quadrate ≥44px. |
| dashboard | Email mobile senza truncation: indirizzo lungo accavalla il bottone Log Out. | `src/pages/dashboard.astro:93` — span: `max-w-[160px] truncate`; parent `:91` `min-w-0`. |
| dashboard | Empty-state CTA "Book Chef Nino" `px-4 py-2` (~36px), l'azione che il nuovo utente tappa per prima. | `src/pages/dashboard.astro:191` — `px-4 py-2 rounded-md` → `px-5 py-3 rounded-lg`. |
| auth | `min-h-screen` ignora la chrome del browser mobile. | `login.astro:9` (+ altre 3): `min-h-screen` → `min-h-[100dvh]`. |
| work-with-us | Copy interamente in italiano su brand premium inglese (es. "Unisciti al nostro Team", "Invia Candidatura"). | `src/pages/work-with-us.astro` (6,11-13,25,41) — tradurre in inglese (content, non layout). |
| work-with-us | H1 `text-4xl` senza scaling mobile. | `src/pages/work-with-us.astro:11` — `text-4xl` → `text-3xl sm:text-4xl`. |
| privacy / terms | `prose-lg` un po' sovradimensionato per copy legale denso su 390px. | `privacy.astro:10`, `terms.astro:10` — `prose-lg` → `prose sm:prose-lg`. |

## Ordine consigliato

Per il massimo guadagno visivo con il minimo sforzo, in quest'ordine:

1. **Header mobile (1 fix, impatta tutte le pagine).** Ridurre la barra guest a solo Book Now + hamburger, spostare Login/Sign Up + Book Now nel `#mobile-menu`, `px-4 sm:px-6` sul container e pill a `py-2.5 text-sm`. È il problema più ripetuto e quello che più tradisce il premium feel: risolverlo migliora ogni schermata in un colpo.
2. **Hero H1** (`text-4xl sm:text-5xl ...`) + **stat cards** (`mt-12 sm:mt-20`, `p-6 sm:p-8`): è la prima viewport della home, il guadagno è immediato e visibile sopra la fold.
3. **Tap target sotto i 44px** sui form interattivi — complete-profile, poi auth (input `py-3 text-base`, Google button `py-3`), poi admin control-panel: è il fix che fa sentire il sito "finito" al tocco e previene lo zoom-on-focus iOS.
4. **Dropdown paese responsive** (`w-full sm:w-80` / `w-full sm:w-72`) su booking e complete-profile: elimina l'unico rischio reale di clipping/overflow orizzontale rimasto.
5. **Sweep padding/spacing** (`p-8`→`p-5/p-6 sm:p-8`, `py-32`→`py-16 md:py-32`, `pt-32`→`pt-24 sm:pt-32`, footer gap, FAQ, work-with-us): rifinitura di ritmo a tappeto, batch unico veloce.
6. **Polish finali**: traduzione work-with-us in inglese, `overflow-x-hidden` di sicurezza, truncation email dashboard, `prose sm:prose-lg` sulle legali.
