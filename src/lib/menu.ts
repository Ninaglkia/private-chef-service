/**
 * "La Carta" — the interactive dish menu (single source of truth).
 *
 * Used by:
 *  - /menu (the tap-to-select gallery)
 *  - /richiesta (resolves selected dish ids → names for the request prefill)
 *  - the future Instagram content kit (name + desc + igCaption + the same 4:5 image)
 *
 * Conventions:
 *  - `id` is a STABLE slug: it lives in sessionStorage/share links and names the
 *    image file (/images/dishes/<id>.jpg). Rename `name` freely; never reuse ids.
 *  - `img` is optional: cards without it render an elegant typographic
 *    placeholder, so the page ships before the AI photos are generated.
 *  - NO per-dish prices anywhere — this is a preference picker; the chef quotes
 *    the event afterwards (pay-later model).
 */

export type CourseId = 'antipasti' | 'primi' | 'secondi' | 'dolci';

export interface Course {
  id: CourseId;
  numeral: string;
  label: string;
  subtitle: string;
}

export interface Dish {
  id: string;
  name: string;
  course: CourseId;
  desc: string;
  img?: string;
  /** Ready-to-post Instagram caption (filled together with the AI photo). */
  igCaption?: string;
}

export const MAX_SELECTION = 8;

export const COURSES: Course[] = [
  { id: 'antipasti', numeral: 'I', label: 'Antipasti', subtitle: 'To begin' },
  { id: 'primi', numeral: 'II', label: 'Primi', subtitle: 'Pasta & risotto' },
  { id: 'secondi', numeral: 'III', label: 'Secondi', subtitle: 'From land & sea' },
  { id: 'dolci', numeral: 'IV', label: 'Dolci', subtitle: 'A sweet ending' },
];

// Seed menu — placeholder dishes in the chef's Mediterranean register. Nino
// will replace names/descriptions with his own dishes; photos follow.
export const DISHES: Dish[] = [
  // I — Antipasti
  { id: 'crudo-ricciola', name: 'Amberjack crudo, citrus & basil oil', course: 'antipasti', desc: 'Raw amberjack, seasonal citrus, cold-pressed basil oil' },
  { id: 'tartare-fassona', name: 'Fassona beef tartare', course: 'antipasti', desc: 'Hand-cut Piedmontese beef, egg yolk cream, capers' },
  { id: 'carpaccio-capesante', name: 'Scallop carpaccio', course: 'antipasti', desc: 'Lake-thin scallops, lemon zest, wild fennel' },
  { id: 'burrata-pomodorini', name: 'Burrata & confit tomatoes', course: 'antipasti', desc: 'Creamy burrata, slow-roasted datterini, basil', img: '/images/dish2.jpg' },
  { id: 'polpo-arrosto', name: 'Roasted octopus, potato cream', course: 'antipasti', desc: 'Charred octopus, smoked potato velvet, olive crumble' },
  // II — Primi
  { id: 'risotto-zafferano', name: 'Saffron risotto, gold leaf', course: 'primi', desc: 'Carnaroli, Milanese saffron, aged Parmigiano' },
  { id: 'tagliatelle-porcini', name: 'Tagliatelle, porcini & thyme', course: 'primi', desc: 'Fresh egg pasta, wild porcini, mountain thyme' },
  { id: 'spaghetti-vongole', name: 'Spaghetti alle vongole', course: 'primi', desc: 'Veraci clams, white wine, parsley oil' },
  { id: 'ravioli-ossobuco', name: 'Ossobuco ravioli', course: 'primi', desc: 'Slow-braised veal filling, gremolata, roasting jus' },
  { id: 'risotto-limone-gamberi', name: 'Lemon risotto, red prawns', course: 'primi', desc: 'Amalfi lemon, raw Mazara prawns, bottarga' },
  // III — Secondi
  { id: 'branzino-crosta', name: 'Sea bass in salt crust', course: 'secondi', desc: 'Whole wild sea bass, herbs, carved at the table', img: '/images/dish1.jpg' },
  { id: 'filetto-rossini', name: 'Beef fillet, Rossini style', course: 'secondi', desc: 'Pan-seared fillet, foie gras, truffle jus' },
  { id: 'agnello-erbe', name: 'Herb-crusted lamb rack', course: 'secondi', desc: 'Lombard lamb, alpine herbs, smoked aubergine' },
  { id: 'pescato-lago', name: 'Lake fish of the day', course: 'secondi', desc: 'From Como’s waters, brown butter & sage' },
  { id: 'guancia-brasata', name: 'Braised veal cheek', course: 'secondi', desc: '36-hour braise, celeriac purée, Nebbiolo reduction' },
  // IV — Dolci
  { id: 'tiramisu-chef', name: 'Tiramisù of the house', course: 'dolci', desc: 'Single-origin cocoa, espresso-soaked savoiardi' },
  { id: 'panna-cotta-vaniglia', name: 'Vanilla panna cotta', course: 'dolci', desc: 'Madagascar vanilla, lake berries' },
  { id: 'sfera-cioccolato', name: 'Chocolate sphere', course: 'dolci', desc: 'Melted at the table with warm salted caramel' },
  { id: 'sorbetto-limone-basilico', name: 'Lemon & basil sorbet', course: 'dolci', desc: 'Palate-cleansing, garden basil, olive oil' },
];

export function dishesByCourse(): Map<CourseId, Dish[]> {
  const map = new Map<CourseId, Dish[]>();
  for (const c of COURSES) map.set(c.id, []);
  for (const d of DISHES) map.get(d.course)?.push(d);
  return map;
}
