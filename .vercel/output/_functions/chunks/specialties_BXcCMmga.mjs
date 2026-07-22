const SPECIALTIES = ["Nefrologia", "Endocrinologia", "Urologia"];
const SPECIALTY_SLUGS = {
  Nefrologia: "nefrologia",
  Endocrinologia: "endocrinologia",
  Urologia: "urologia"
};
function specialtyFromSlug(slug) {
  return Object.keys(SPECIALTY_SLUGS).find((s) => SPECIALTY_SLUGS[s] === slug);
}

export { SPECIALTIES as S, SPECIALTY_SLUGS as a, specialtyFromSlug as s };
