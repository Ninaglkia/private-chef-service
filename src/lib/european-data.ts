export interface Country {
  name: string;
  code: string;
  dial_code: string;
  capital: string;
  flag: string;
}

export const EUROPEAN_COUNTRIES: Country[] = [
  // European Union (EU)
  { name: "Austria", code: "AT", dial_code: "+43", capital: "Vienna", flag: "🇦🇹" },
  { name: "Belgium", code: "BE", dial_code: "+32", capital: "Brussels", flag: "🇧🇪" },
  { name: "Bulgaria", code: "BG", dial_code: "+359", capital: "Sofia", flag: "🇧🇬" },
  { name: "Croatia", code: "HR", dial_code: "+385", capital: "Zagreb", flag: "🇭🇷" },
  { name: "Cyprus", code: "CY", dial_code: "+357", capital: "Nicosia", flag: "🇨🇾" },
  { name: "Czech Republic", code: "CZ", dial_code: "+420", capital: "Prague", flag: "🇨🇿" },
  { name: "Denmark", code: "DK", dial_code: "+45", capital: "Copenhagen", flag: "🇩🇰" },
  { name: "Estonia", code: "EE", dial_code: "+372", capital: "Tallinn", flag: "🇪🇪" },
  { name: "Finland", code: "FI", dial_code: "+358", capital: "Helsinki", flag: "🇫🇮" },
  { name: "France", code: "FR", dial_code: "+33", capital: "Paris", flag: "🇫🇷" },
  { name: "Germany", code: "DE", dial_code: "+49", capital: "Berlin", flag: "🇩🇪" },
  { name: "Greece", code: "GR", dial_code: "+30", capital: "Athens", flag: "🇬🇷" },
  { name: "Hungary", code: "HU", dial_code: "+36", capital: "Budapest", flag: "🇭🇺" },
  { name: "Ireland", code: "IE", dial_code: "+353", capital: "Dublin", flag: "🇮🇪" },
  { name: "Italy", code: "IT", dial_code: "+39", capital: "Rome", flag: "🇮🇹" },
  { name: "Latvia", code: "LV", dial_code: "+371", capital: "Riga", flag: "🇱🇻" },
  { name: "Lithuania", code: "LT", dial_code: "+370", capital: "Vilnius", flag: "🇱🇹" },
  { name: "Luxembourg", code: "LU", dial_code: "+352", capital: "Luxembourg City", flag: "🇱🇺" },
  { name: "Malta", code: "MT", dial_code: "+356", capital: "Valletta", flag: "🇲🇹" },
  { name: "Netherlands", code: "NL", dial_code: "+31", capital: "Amsterdam", flag: "🇳🇱" },
  { name: "Poland", code: "PL", dial_code: "+48", capital: "Warsaw", flag: "🇵🇱" },
  { name: "Portugal", code: "PT", dial_code: "+351", capital: "Lisbon", flag: "🇵🇹" },
  { name: "Romania", code: "RO", dial_code: "+40", capital: "Bucharest", flag: "🇷🇴" },
  { name: "Slovakia", code: "SK", dial_code: "+421", capital: "Bratislava", flag: "🇸🇰" },
  { name: "Slovenia", code: "SI", dial_code: "+386", capital: "Ljubljana", flag: "🇸🇮" },
  { name: "Spain", code: "ES", dial_code: "+34", capital: "Madrid", flag: "🇪🇸" },
  { name: "Sweden", code: "SE", dial_code: "+46", capital: "Stockholm", flag: "🇸🇪" },

  // Non-EU European Countries / EFTA / Others
  { name: "Albania", code: "AL", dial_code: "+355", capital: "Tirana", flag: "🇦🇱" },
  { name: "Andorra", code: "AD", dial_code: "+376", capital: "Andorra la Vella", flag: "🇦🇩" },
  { name: "Belarus", code: "BY", dial_code: "+375", capital: "Minsk", flag: "🇧🇾" },
  { name: "Bosnia and Herzegovina", code: "BA", dial_code: "+387", capital: "Sarajevo", flag: "🇧🇦" },
  { name: "Iceland", code: "IS", dial_code: "+354", capital: "Reykjavík", flag: "🇮🇸" },
  { name: "Liechtenstein", code: "LI", dial_code: "+423", capital: "Vaduz", flag: "🇱🇮" },
  { name: "Moldova", code: "MD", dial_code: "+373", capital: "Chișinău", flag: "🇲🇩" },
  { name: "Monaco", code: "MC", dial_code: "+377", capital: "Monaco", flag: "🇲🇨" },
  { name: "Montenegro", code: "ME", dial_code: "+382", capital: "Podgorica", flag: "🇲🇪" },
  { name: "North Macedonia", code: "MK", dial_code: "+389", capital: "Skopje", flag: "🇲🇰" },
  { name: "Norway", code: "NO", dial_code: "+47", capital: "Oslo", flag: "🇳🇴" },
  { name: "Russia", code: "RU", dial_code: "+7", capital: "Moscow", flag: "🇷🇺" },
  { name: "San Marino", code: "SM", dial_code: "+378", capital: "San Marino", flag: "🇸🇲" },
  { name: "Serbia", code: "RS", dial_code: "+381", capital: "Belgrade", flag: "🇷🇸" },
  { name: "Switzerland", code: "CH", dial_code: "+41", capital: "Bern", flag: "🇨🇭" },
  { name: "Ukraine", code: "UA", dial_code: "+380", capital: "Kyiv", flag: "🇺🇦" },
  { name: "United Kingdom", code: "GB", dial_code: "+44", capital: "London", flag: "🇬🇧" },
  { name: "Vatican City", code: "VA", dial_code: "+39", capital: "Vatican City", flag: "🇻🇦" }
].sort((a, b) => a.name.localeCompare(b.name));

export const EXTRA_CITIES = [
  "Milano",
  "Lugano",
  "Como"
];

export const ALL_CAPITALS = Array.from(new Set([
  ...EUROPEAN_COUNTRIES.map(country => country.capital),
  ...EXTRA_CITIES
])).sort();
