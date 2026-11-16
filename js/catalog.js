// Forslag når du skriver navnet på en ny fristelse. Grove anslag (nov. 2026), kan endres i appen.
//
// Mat med «i stedet for»: kcal og pris er FORSKJELLEN mot en vanlig hjemmelaget middag
// (ca. 550 kcal og 50 kr), fordi du som regel spiser noe annet når du dropper den.
// Alt annet teller fullt, siden det sjelden erstattes av noe.

const MIDDAG = 'vanlig middag';

// [type, emoji, navn, kcal, pris, i stedet for, søkeord]
const ROWS = [
  // Alkohol
  ['alkohol', '🍷', 'Vin, glass 15 cl (hjemme)', 125, 35, '', 'vin rødvin hvitvin rosé glass'],
  ['alkohol', '🍷', 'Vin, glass 15 cl (ute)', 125, 140, '', 'vin rødvin hvitvin rosé glass restaurant bar'],
  ['alkohol', '🍷', 'Vin, flaske (hjemme)', 625, 170, '', 'vin rødvin hvitvin flaske'],
  ['alkohol', '🥂', 'Musserende, glass (ute)', 95, 140, '', 'musserende prosecco cava champagne bobler'],
  ['alkohol', '🍺', 'Øl 0,5 l (ute)', 200, 115, '', 'øl pils halvliter bar'],
  ['alkohol', '🍺', 'Øl 0,33 l (hjemme)', 130, 35, '', 'øl pils boks flaske'],
  ['alkohol', '🍏', 'Cider 0,33 l', 160, 40, '', 'cider sider'],
  ['alkohol', '🍹', 'Drink (ute)', 220, 170, '', 'drink cocktail gin tonic spritz'],

  // Mat, regnet som forskjell
  ['mat', '🧀', 'Mac and cheese, porsjon', 200, 10, MIDDAG, 'mac cheese makaroni ost'],
  ['mat', '🍕', 'Frossenpizza, halv', 100, 0, MIDDAG, 'pizza frossenpizza'],
  ['mat', '🍕', 'Pizza fra restaurant, hel', 550, 250, MIDDAG, 'pizza takeaway restaurant'],
  ['mat', '🍔', 'Burger med pommes frites', 650, 140, MIDDAG, 'burger hamburger pommes frites'],
  ['mat', '🥙', 'Kebab i pita', 250, 100, MIDDAG, 'kebab pita'],
  ['mat', '🌮', 'Taco, fredagsporsjon', 350, 0, MIDDAG, 'taco fredag'],
  ['mat', '🍣', 'Sushi, takeaway', 150, 200, MIDDAG, 'sushi takeaway'],

  // Småmat og snacks, teller fullt
  ['mat', '🌭', 'Pølse i brød', 300, 45, '', 'pølse wiener grill'],
  ['mat', '🍟', 'Pommes frites, porsjon', 400, 55, '', 'pommes frites fries'],
  ['chips', '🥔', 'Potetgull, skål (50 g)', 270, 12, '', 'potetgull chips skål'],
  ['annet', '🥜', 'Salte nøtter, håndfull', 180, 10, '', 'nøtter peanøtter cashew'],
  ['annet', '🍿', 'Popcorn, kino', 450, 80, '', 'popcorn kino'],

  // Bakst og søtt
  ['bakst', '🥐', 'Croissant', 270, 35, '', 'croissant'],
  ['bakst', '🥐', 'Wienerbrød', 400, 45, '', 'wienerbrød skillingsbolle'],
  ['bakst', '🧁', 'Muffins', 400, 40, '', 'muffins muffin'],
  ['annet', '🍩', 'Donut', 300, 35, '', 'donut smultring'],
  ['is', '🍦', 'Is, kule', 110, 40, '', 'is kule iskule gelato'],
  ['is', '🍦', 'Softis', 250, 45, '', 'is softis'],
  ['annet', '🥤', 'Milkshake', 500, 75, '', 'milkshake shake'],
  ['annet', '☕', 'Latte, stor med sirup', 250, 65, '', 'latte kaffe sirup'],
];

export const CATALOG = ROWS.map(([typeId, emoji, name, kcal, price, insteadOf, words]) => ({
  typeId, emoji, name, kcal, price, insteadOf, words: `${name} ${words}`.toLowerCase(),
}));

/** Opptil `max` forslag som passer det du har skrevet (minst 2 tegn). */
export function suggest(text, max = 4) {
  const q = text.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  return CATALOG
    .filter((c) => words.every((w) => c.words.split(/[\s,()]+/).some((x) => x.startsWith(w))))
    .slice(0, max);
}
