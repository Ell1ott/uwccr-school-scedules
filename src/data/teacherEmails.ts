/** School emails matched from emails-staff.json. Keyed by canonical teacher id. */
export const TEACHER_EMAILS: Record<string, string> = {
  adriana: "adriana.rincon@uwccostarica.org",
  "ana-teresa": "ana.alvarado@uwccostarica.org",
  andres: "andres.montero@uwccostarica.org",
  brian: "brian.lupao@uwccostarica.org",
  carolina: "carolina.buitrago@uwccostarica.org",
  chris: "chris.kennedy@uwccostarica.org",
  christine: "christine.breitenbach@uwccostarica.org",
  emiel: "emiel.stegeman@uwccostarica.org",
  erick: "erick.loria@uwccostarica.org",
  ericka: "ericka.martinez@uwccostarica.org",
  heidy: "heidy.chavarria@uwccostarica.org",
  heloise: "heloise.saldanha@uwccostarica.org",
  jaime: "jaime.morales@uwccostarica.org",
  jd: "juan.martinez@uwccostarica.org",
  "jeff-lile": "jeff.lile@uwccostarica.org",
  "jeff-n": "jeff.norris@uwccostarica.org",
  karina: "karina.alvarez@uwccostarica.org",
  karlina: "karlina.cartin@uwccostarica.org",
  melissa: "melissa.maclean@uwccostarica.org",
  nicholas: "nicholas.stone@uwccostarica.org",
  norman: "norman.duran@uwccostarica.org",
  paula: "paula.moran@uwccostarica.org",
  qq: "enrique.fernandez@uwccostarica.org",
  rolando: "rolando.cubero@uwccostarica.org",
  ryan: "ryan.buchanan@uwccostarica.org",
  tiya: "tiyamike.mkanthama@uwccostarica.org",
};

export type UnknownTeacherEmail = {
  name: string;
  note: string;
  candidates?: string[];
};

/** Schedule teachers with no confirmed school email yet. */
export const UNKNOWN_TEACHER_EMAILS: Record<string, UnknownTeacherEmail> = {
  constanza: {
    name: "Constanza",
    note: "Global Politics — no matching staff email",
  },
  florian: {
    name: "Florian",
    note: "ESS / Biology — no matching staff email",
  },
  mauricio: {
    name: "Mauricio",
    note: "English B — Mauricio Belmar vs Mauricio Viales",
    candidates: [
      "mauricio.belmar@uwccostarica.org",
      "mauricio.viales@uwccostarica.org",
    ],
  },
  meli: {
    name: "Meli",
    note: "TOK only — not confirmed as Melissa MacLean",
    candidates: ["melissa.maclean@uwccostarica.org"],
  },
  sofia: {
    name: "Sofía",
    note: "English Lang & Lit — Sofía Jiménez vs Sofía Quirós",
    candidates: [
      "sofia.jimenez@uwccostarica.org",
      "sofia.quiros@uwccostarica.org",
    ],
  },
};

export function emailForTeacherId(id: string): string | null {
  return TEACHER_EMAILS[id] ?? null;
}

export function unknownTeacherEmail(id: string): UnknownTeacherEmail | null {
  return UNKNOWN_TEACHER_EMAILS[id] ?? null;
}
