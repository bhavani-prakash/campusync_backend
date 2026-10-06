const ADJECTIVES = [
  'Silent', 'Blue', 'Mystery', 'Crypto', 'Quantum', 'Cosmic', 'Shadow',
  'Neon', 'Velvet', 'Lunar', 'Solar', 'Cyber', 'Starlight', 'Hyper',
  'Zenith', 'Echo', 'Wandering', 'Prism', 'Radiant', 'Emerald', 'Aura'
];

const NOUNS = [
  'Phoenix', 'Moon', 'Coder', 'Voyager', 'Falcon', 'Panda', 'Scholar',
  'Orion', 'Spark', 'Knight', 'Comet', 'Nomad', 'Atlas', 'Raven',
  'Pulse', 'Whisper', 'Dragon', 'Spectra', 'Drifter', 'Nova', 'Echo'
];

const generateAnonymousName = () => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(10 + Math.random() * 89); // 2-digit number
  return `${adj}${noun}${num}`;
};

module.exports = {
  generateAnonymousName,
  ADJECTIVES,
  NOUNS
};
