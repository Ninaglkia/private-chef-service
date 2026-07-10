// Chef's tasting menus — single source of truth for /menu (la carta) and the
// /richiesta indicative-price estimate. price = indicative EUR per person for
// the MENU; the chef's service fee is a fixed amount per event, on top.
export const CHEF_SERVICE_EUR = 600;
export interface TastingCourse { course: string; it: string; en: string }
export type MealKind = 'breakfast' | 'lunch' | 'dinner' | 'buffet';
export interface TastingMenu { name: string; tag: string; price: number; meal?: MealKind; courses: TastingCourse[] }

export const TASTING_MENUS = [
  {
    name: 'La Colazione',
    tag: 'An Italian morning, unhurried',
    price: 25,
    meal: 'breakfast' as const,
    courses: [
      { course: 'Al risveglio', it: 'Spremute fresche, caffè e cappuccino al momento', en: 'Fresh-squeezed juices, coffee & cappuccino made to order' },
      { course: 'Dal forno', it: 'Cornetti caldi, pane e confetture artigianali', en: 'Warm cornetti, bread & artisan jams' },
      { course: 'Salato', it: 'Uova a modo vostro, guanciale croccante', en: 'Eggs any style, crisp guanciale' },
      { course: 'Frutta', it: 'Frutta di stagione, yogurt e granola della casa', en: 'Seasonal fruit, yogurt & house granola' },
    ],
  },
  {
    name: 'Il Brunch',
    tag: 'Late morning, done the Italian way — a full feast',
    price: 75,
    meal: 'breakfast' as const,
    courses: [
      { course: 'Al risveglio', it: 'Spremute, caffè e mimosa al Franciacorta', en: 'Juices, coffee & Franciacorta mimosa' },
      { course: 'Dal forno', it: 'Cornetti caldi, pane e pasticceria del mattino', en: 'Warm cornetti, bread & morning pastries' },
      { course: 'Salato I', it: 'Uova in camicia, salmone e avocado su pane tostato', en: 'Poached eggs, salmon & avocado on toast' },
      { course: 'Salato II', it: 'Pancakes salati al grana, pomodorini confit', en: 'Savoury parmesan pancakes, confit tomatoes' },
      { course: 'Dolce', it: 'Pancakes allo sciroppo, frutti di bosco', en: 'Pancakes with syrup & berries' },
    ],
  },
  {
    name: "L'Aperitivo Italiano",
    tag: 'Spritz, bites and golden hour — drinks shape the final price',
    price: 28,
    meal: 'buffet' as const,
    courses: [
      { course: 'Nel bicchiere', it: 'Spritz, Franciacorta e analcolici della casa', en: 'Spritz, Franciacorta & house alcohol-free' },
      { course: 'Dal tagliere', it: 'Salumi e formaggi selezionati, giardiniera', en: 'Selected cured meats & cheeses, giardiniera' },
      { course: 'Caldi', it: 'Fritti del momento e focaccia al rosmarino', en: 'Fried bites of the day & rosemary focaccia' },
      { course: 'Fresco', it: 'Crudités, hummus e salse della casa', en: 'Crudités, hummus & house dips' },
    ],
  },
  {
    name: 'Il Pranzo al Lago',
    tag: 'A long lunch with the water in sight',
    price: 75,
    meal: 'lunch' as const,
    courses: [
      { course: 'Aperitivo', it: 'Bollicine e sfizi di benvenuto', en: 'Sparkling wine & welcome bites' },
      { course: 'Antipasto', it: 'Vitello tonnato', en: 'The Piedmont classic — thin-sliced veal, tuna-caper sauce' },
      { course: 'Primo', it: 'Pasta fresca del giorno, verdure di stagione', en: 'Fresh pasta of the day, seasonal vegetables' },
      { course: 'Secondo', it: 'Pescato del giorno, olio al basilico', en: 'Catch of the day, basil oil' },
      { course: 'Dolce', it: 'Sorbetto al limone', en: 'Lemon sorbet' },
    ],
  },
  {
    name: 'La Conviviale',
    tag: 'Honest Italian comfort, done properly',
    price: 50,
    courses: [
      { course: 'Aperitivo', it: 'Prosecco e stuzzichini della casa', en: 'Prosecco & house nibbles' },
      { course: 'Antipasto', it: 'Burrata, pomodorini confit e crostone al basilico', en: 'Burrata, confit tomatoes, basil crostone' },
      { course: 'Primo', it: 'Paccheri al San Marzano e basilico', en: 'Paccheri with San Marzano tomato & basil' },
      { course: 'Secondo', it: 'Pollo ruspante al limone, patate arrosto al rosmarino', en: 'Free-range lemon chicken, rosemary roast potatoes' },
      { course: 'Dolce', it: 'Tiramisù classico', en: 'Classic tiramisù' },
    ],
  },
  {
    name: 'La Firma',
    tag: "The chef's signature",
    price: 95,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Tartare di Angus battuta al coltello, pesca marinata, gel di pomodoro e cialda di grana', en: 'Hand-cut Angus tartare, marinated peach, tomato gel, parmesan wafer' },
      { course: 'Primo', it: 'Tagliolino tirato a mano, vongole veraci, limone e olio al prezzemolo', en: 'Hand-pulled tagliolini, verace clams, lemon & parsley oil' },
      { course: 'Secondo', it: 'Filetto di manzo al burro nocciola, demi-glace e cicoria al forno', en: 'Butter-basted beef fillet, demi-glace, oven-roasted chicory' },
      { course: 'Dolce', it: 'Tiramisù classico e frutta di stagione', en: 'Classic tiramisù & seasonal fruit' },
    ],
  },
  {
    name: 'Il Lago',
    tag: 'A love letter to Lake Como',
    price: 85,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Lavarello in carpione, cipolla rossa in agrodolce e crostone', en: 'Marinated lake whitefish, sweet-and-sour red onion, toasted bread' },
      { course: 'Primo', it: 'Risotto al pesce persico, burro e salvia', en: 'The historic Lake Como risotto — lake perch, butter & sage' },
      { course: 'Secondo', it: 'Filetto di trota, beurre blanc al limone e spinacino', en: 'Lake trout fillet, lemon beurre blanc, baby spinach' },
      { course: 'Dolce', it: 'Miascia comasca e gelato fior di latte', en: "Como's traditional bread-and-fruit cake, fior di latte gelato" },
    ],
  },
  {
    name: "L'Orto",
    tag: 'Summer from the market',
    price: 80,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Fiore di zucca ripieno di ricotta al limone, datterino giallo arrosto e basilico fritto', en: 'Courgette flower, lemon ricotta, roasted yellow datterino, fried basil' },
      { course: 'Primo', it: 'Risotto alle zucchine trombetta, menta e limone candito', en: 'Trombetta courgette risotto, mint & candied lemon' },
      { course: 'Secondo', it: 'Triglia in crosta di pane alle erbe, peperonata dolce', en: 'Red mullet in a herb-bread crust, sweet pepper stew' },
      { course: 'Dolce', it: 'Pesche al Moscato, crumble di mandorle e fior di latte', en: 'Moscato-poached peaches, almond crumble, fior di latte gelato' },
    ],
  },
  {
    name: 'Il Mare',
    tag: 'Raw cuts, fragrance and salt',
    price: 95,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Crudo di ricciola, gazpacho di datterino giallo e Tropea in agrodolce', en: 'Amberjack crudo, yellow-tomato gazpacho, sweet-and-sour Tropea onion' },
      { course: 'Primo', it: "Risotto all'acqua di pomodoro, gambero rosso e basilico", en: 'Tomato-water risotto, raw red prawn & basil' },
      { course: 'Secondo', it: 'Triglia farcita alle olive taggiasche, panzanella croccante', en: 'Red mullet filled with Taggiasca olives, crisp panzanella' },
      { course: 'Dolce', it: 'Sorbetto al limone, meringa e basilico', en: 'Lemon sorbet, meringue & basil' },
    ],
  },
  {
    name: 'Le Lunghe Cotture',
    tag: 'Time as an ingredient',
    price: 90,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Uovo a bassa temperatura, crema di patate affumicata, guanciale e tartufo estivo', en: 'Slow-cooked egg, smoked potato cream, crisp guanciale, summer truffle' },
      { course: 'Primo', it: 'Raviolo ripieno di brasato nel suo fondo ristretto', en: 'Raviolo of slow-braised beef in its own reduced jus' },
      { course: 'Secondo', it: 'Maialino cotto dodici ore, purè al limone e cicoria ripassata', en: 'Twelve-hour suckling pig, lemon potato purée, sautéed chicory' },
      { course: 'Dolce', it: 'Tiramisù classico', en: 'Classic tiramisù — the signature' },
    ],
  },
  {
    name: "La Griglia d'Estate",
    tag: 'Fire and smoke, villa garden style',
    price: 80,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Verdure di stagione alla brace e burrata affumicata', en: 'Flame-grilled seasonal vegetables, smoked burrata' },
      { course: 'Primo', it: 'Paccheri al pomodoro arrosto e basilico', en: 'Paccheri with roasted tomato & basil' },
      { course: 'Secondo', it: 'Costata di manzo alla brace, patate al rosmarino e salse dello chef', en: "Flame-grilled ribeye, rosemary potatoes, chef's sauces" },
      { course: 'Dolce', it: 'Pesca grigliata, gelato e amaretti', en: 'Grilled peach, gelato & amaretti' },
    ],
  },
  {
    name: 'La Romantica',
    tag: 'A table for two',
    price: 110,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta rosé e sfizi di benvenuto', en: 'Franciacorta rosé & welcome bites' },
      { course: 'Antipasto', it: 'Crudo di gambero rosso, stracciatella e limone', en: 'Raw red prawn, stracciatella cheese & lemon' },
      { course: 'Primo', it: 'Tagliolino al tartufo estivo', en: 'Hand-pulled tagliolini with summer truffle' },
      { course: 'Secondo', it: 'Filetto di manzo, demi-glace al vino rosso', en: 'Beef fillet, red-wine demi-glace' },
      { course: 'Dolce', it: 'Cuore fondente al cioccolato e lamponi', en: 'Molten chocolate heart & raspberries' },
    ],
  },
  {
    name: 'Il Gran Gourmet',
    tag: 'Eight courses, fine-dining pace',
    price: 180,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta millesimato e ostrica', en: 'Vintage Franciacorta & oyster' },
      { course: 'Antipasto I', it: 'Scampi crudi, burrata e limone candito', en: 'Raw langoustines, burrata, candied lemon' },
      { course: 'Antipasto II', it: 'Capasanta scottata, crema di topinambur', en: 'Seared scallop, Jerusalem artichoke cream' },
      { course: 'Primo I', it: 'Tagliolino al tartufo di stagione', en: 'Hand-pulled tagliolini, truffle of the season' },
      { course: 'Primo II', it: 'Risotto al gambero rosso e basilico', en: 'Red prawn risotto & basil' },
      { course: 'Intermezzo', it: 'Sorbetto al limone e basilico', en: 'Lemon & basil sorbet' },
      { course: 'Secondo', it: 'Branzino selvaggio in crosta di sale, rotto al tavolo', en: 'Wild sea bass in a salt crust — cracked open at your table' },
      { course: 'Dolce', it: 'Semifreddo al pistacchio di Bronte, lamponi e cioccolato bianco', en: 'Bronte pistachio semifreddo, raspberries, white chocolate' },
    ],
  },
  {
    name: "L'Imperiale",
    tag: 'Ten acts, no compromises',
    price: 400,
    courses: [
      { course: 'Aperitivo', it: 'Champagne e ostrica Gillardeau', en: 'Champagne & Gillardeau oyster' },
      { course: 'Amuse-bouche', it: 'Tartelletta, crema di burrata e caviale Oscietra', en: 'Tartlet, burrata cream, Oscietra caviar' },
      { course: 'Antipasto I', it: 'Crudo di gambero rosso di Mazara, lime e olio al basilico', en: 'Raw Mazara red prawn, lime, basil oil' },
      { course: 'Antipasto II', it: 'Capasanta, beurre blanc allo Champagne', en: 'Scallop, Champagne beurre blanc' },
      { course: 'Primo I', it: 'Tagliolino al tartufo di stagione', en: 'Hand-pulled tagliolini, truffle of the season' },
      { course: 'Primo II', it: "Risotto all'astice blu", en: 'Blue lobster risotto' },
      { course: 'Intermezzo', it: 'Sorbetto al limone e gin', en: 'Lemon & gin sorbet' },
      { course: 'Secondo I', it: 'Rombo selvaggio, beurre blanc e caviale', en: 'Wild turbot, beurre blanc, caviar' },
      { course: 'Secondo II', it: 'Wagyu, demi-glace e tartufo', en: 'Wagyu beef, demi-glace, truffle' },
      { course: 'Dolce', it: 'Millefoglie caramellata, crema alla vaniglia bourbon e lamponi — e piccola pasticceria', en: 'Caramelised millefeuille, bourbon vanilla cream, raspberries — then petits fours' },
    ],
  },
  {
    name: 'La Grande Sera',
    tag: 'The grand tasting — six acts',
    price: 120,
    courses: [
      { course: 'Aperitivo', it: 'Franciacorta e sfizi di benvenuto', en: 'Franciacorta & welcome bites' },
      { course: 'Antipasto', it: 'Tartare di Angus battuta al coltello, pesca marinata e gel di pomodoro', en: 'Hand-cut Angus tartare, marinated peach, tomato gel' },
      { course: 'Primo', it: "Risotto all'acqua di pomodoro, gambero rosso e basilico", en: 'Tomato-water risotto, raw red prawn & basil' },
      { course: 'Intermezzo', it: 'Sorbetto al limone e basilico', en: 'Lemon & basil sorbet, to cleanse the palate' },
      { course: 'Secondo', it: 'Filetto di manzo al burro nocciola, demi-glace e cicoria al forno', en: 'Butter-basted beef fillet, demi-glace, oven-roasted chicory' },
      { course: 'Dolce', it: 'Tiramisù classico e frutta di stagione', en: 'Classic tiramisù & seasonal fruit' },
    ],
  },
].sort((a, b) => a.price - b.price);
