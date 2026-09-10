/** School staff emails matched from emails-staff.json. Keyed by lowercase email. */
export type StaffMatch = {
  id: string;
  name: string;
  email: string;
};

const STAFF: StaffMatch[] = [
  { id: "adriana", name: "Adriana", email: "adriana.rincon@uwccostarica.org" },
  { id: "ana-teresa", name: "Ana Teresa", email: "ana.alvarado@uwccostarica.org" },
  { id: "andres", name: "Andres", email: "andres.montero@uwccostarica.org" },
  { id: "brian", name: "Brian", email: "brian.lupao@uwccostarica.org" },
  { id: "carolina", name: "Carolina", email: "carolina.buitrago@uwccostarica.org" },
  { id: "chris", name: "Chris", email: "chris.kennedy@uwccostarica.org" },
  { id: "christine", name: "Christine", email: "christine.breitenbach@uwccostarica.org" },
  { id: "emiel", name: "Emiel", email: "emiel.stegeman@uwccostarica.org" },
  { id: "erick", name: "Erick", email: "erick.loria@uwccostarica.org" },
  { id: "ericka", name: "Ericka", email: "ericka.martinez@uwccostarica.org" },
  { id: "heidy", name: "Heidy", email: "heidy.chavarria@uwccostarica.org" },
  { id: "heloise", name: "Heloise", email: "heloise.saldanha@uwccostarica.org" },
  { id: "jaime", name: "Jaime", email: "jaime.morales@uwccostarica.org" },
  { id: "jd", name: "JD", email: "juan.martinez@uwccostarica.org" },
  { id: "jeff-lile", name: "Jeff Lile", email: "jeff.lile@uwccostarica.org" },
  { id: "jeff-n", name: "Jeff N.", email: "jeff.norris@uwccostarica.org" },
  { id: "karina", name: "Karina", email: "karina.alvarez@uwccostarica.org" },
  { id: "karlina", name: "Karlina", email: "karlina.cartin@uwccostarica.org" },
  { id: "melissa", name: "Melissa", email: "melissa.maclean@uwccostarica.org" },
  { id: "nicholas", name: "Nicholas", email: "nicholas.stone@uwccostarica.org" },
  { id: "norman", name: "Norman", email: "norman.duran@uwccostarica.org" },
  { id: "paula", name: "Paula", email: "paula.moran@uwccostarica.org" },
  { id: "qq", name: "QQ", email: "enrique.fernandez@uwccostarica.org" },
  { id: "rolando", name: "Rolando", email: "rolando.cubero@uwccostarica.org" },
  { id: "ryan", name: "Ryan", email: "ryan.buchanan@uwccostarica.org" },
  { id: "tiya", name: "Tiya", email: "tiyamike.mkanthama@uwccostarica.org" },
];

export function staffByEmail(email: string): StaffMatch | null {
  const lower = email.trim().toLowerCase();
  if (!lower) return null;
  return STAFF.find((person) => person.email === lower) ?? null;
}
