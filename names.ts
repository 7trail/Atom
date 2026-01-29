
export const AGENT_NAMES = [
  // Planets & Celestial
  "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Neptune", "Pluto", "Titan", "Europa", "Io", "Callisto", "Ganymede", "Sirius", "Vega", "Rigel", "Andromeda", "Orion", "Nova", "Nebula", "Astra", "Luna", "Sol", "Comet", "Quasar", "Pulsar",
  
  // Gods & Goddesses
  "Zeus", "Hera", "Poseidon", "Demeter", "Ares", "Athena", "Apollo", "Artemis", "Hephaestus", "Aphrodite", "Hermes", "Dionysus", "Hades", "Persephone", "Odin", "Thor", "Loki", "Freya", "Frigg", "Baldur", "Tyr", "Heimdall", "Ra", "Anubis", "Isis", "Osiris", "Horus", "Bastet", "Thoth", "Shiva", "Vishnu", "Kali", "Ganesh", "Amaterasu", "Susanoo", "Tsukuyomi",
  
  // Human (Classic & Modern)
  "Alice", "Bob", "Charlie", "David", "Eve", "Frank", "Grace", "Heidi", "Ivan", "Judy", "Kevin", "Liam", "Mia", "Noah", "Olivia", "Priya", "Quinn", "Rohan", "Sophia", "Thomas", "Uma", "Victor", "Wendy", "Xavier", "Yara", "Zack",
  
  // Exotic / Sci-Fi / Cyberpunk
  "Cipher", "Echo", "Glitch", "Vector", "Zenith", "Apex", "Flux", "Jinx", "Kael", "Lyra", "Morpheus", "Neo", "Trinity", "Oracle", "Pax", "Rook", "Seraph", "Vortex", "Wraith", "Xenon", "Ypsilon", "Zero", "Blade", "Chrome", "Datastream", "Enigma",
  
  // Non-Binary / Neutral
  "Alex", "Jordan", "Casey", "Riley", "Taylor", "Morgan", "Reese", "Cameron", "Jamie", "Avery", "Skyler", "Dakota", "Rowan", "Sage", "River", "Phoenix", "Ash", "Blair", "Ellis", "Finley", "Harper", "Indigo", "Kai", "Lane", "Marlowe"
];

export const getRandomName = (): string => {
  const randomIndex = Math.floor(Math.random() * AGENT_NAMES.length);
  return AGENT_NAMES[randomIndex];
};
