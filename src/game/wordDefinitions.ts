const DEFINITIONS: Record<string, string> = {
  acceleration: "a change in speed or direction",
  adaptation: "a trait that helps a living thing survive",
  atmosphere: "the layer of gases around a planet",
  biodiversity: "the variety of life in an area",
  classification: "sorting things into groups by shared traits",
  conclusion: "a decision reached after thinking through evidence",
  democracy: "a system where people share power through voting",
  decomposition: "the breaking down of dead plants or animals",
  ecosystem: "living and nonliving things interacting in one place",
  equilibrium: "a balanced state",
  generalization: "a broad idea based on examples",
  hypothesis: "a testable explanation or prediction",
  inference: "a conclusion based on evidence and reasoning",
  interdependence: "depending on each other",
  juxtapose: "to place things side by side for comparison",
  justification: "a reason that supports a claim or choice",
  labyrinth: "a maze with confusing paths",
  lexicography: "the work of writing or editing dictionaries",
  magnification: "making something appear larger",
  migration: "movement from one place to another",
  mnemonic: "a memory aid",
  neutralization: "a reaction that makes something less acidic or basic",
  perspective: "a point of view",
  photosphere: "the visible surface layer of the sun",
  photosynthesis: "how plants use light to make food",
  probability: "the chance that something will happen",
  quarantine: "separating someone or something to prevent spread",
  quantitative: "described or measured with numbers",
  quizzical: "showing puzzlement or curiosity",
  relationship: "a connection between people, ideas, or things",
  representation: "something that stands for something else",
  rhythmical: "having a regular beat or pattern",
  significant: "important or meaningful",
  specialization: "focusing on one specific job or skill",
  synthesize: "to combine parts into a new whole",
  thermodynamics: "the study of heat, energy, and work",
  transformation: "a major change in form or character",
  visualization: "forming a picture or diagram in the mind",
  vocabulary: "the words a person knows or uses",
  xylophone: "a musical instrument with bars struck by mallets",
  zephyr: "a soft, gentle breeze",
};

const FALLBACK_CHOICES = [
  "a careful way to compare two ideas",
  "a tool used to measure distance",
  "a short story with a lesson",
  "a change in speed or direction",
  "a balanced state",
  "a point of view",
  "movement from one place to another",
  "forming a picture or diagram in the mind",
];

export function quizForWord(word: string) {
  const normalized = word.toLowerCase();
  const correct = DEFINITIONS[normalized] ?? `the meaning of "${word}"`;
  const distractors = FALLBACK_CHOICES.filter((choice) => choice !== correct).slice(0, 2);
  return shuffle([correct, ...distractors]).map((definition) => ({
    definition,
    correct: definition === correct,
  }));
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}
