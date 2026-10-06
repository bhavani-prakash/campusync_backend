/**
 * Calculates interest compatibility score between 0 and 100
 * Formula:
 * - Shared interests: up to 60%
 * - Looking-for similarity: up to 20%
 * - Academic department: 10%
 * - Year compatibility: 10%
 */
const calculateCompatibility = (profileA, profileB) => {
  if (!profileA || !profileB) return 50; // default baseline

  let score = 0;

  // 1. Shared Interests (Max 60 points)
  const interestsA = profileA.interests || [];
  const interestsB = profileB.interests || [];
  
  if (interestsA.length > 0 && interestsB.length > 0) {
    const commonInterests = interestsA.filter((tag) => interestsB.includes(tag));
    const maxPossible = Math.max(interestsA.length, interestsB.length);
    const ratio = commonInterests.length / maxPossible;
    score += Math.round(ratio * 60);
  } else {
    score += 15; // baseline interest points
  }

  // 2. Looking For Compatibility (Max 20 points)
  const lookingA = profileA.lookingFor || [];
  const lookingB = profileB.lookingFor || [];

  if (lookingA.length > 0 && lookingB.length > 0) {
    const commonLooking = lookingA.filter((tag) => lookingB.includes(tag));
    if (commonLooking.length > 0) {
      score += 20;
    } else {
      score += 10;
    }
  } else {
    score += 10;
  }

  // 3. Department Similarity (Max 10 points)
  if (profileA.department && profileB.department && profileA.department === profileB.department) {
    score += 10;
  } else {
    score += 5;
  }

  // 4. Year Compatibility (Max 10 points)
  if (profileA.year && profileB.year && profileA.year === profileB.year) {
    score += 10;
  } else {
    score += 5;
  }

  // Clamp score between 0 and 100
  return Math.min(100, Math.max(0, score));
};

module.exports = {
  calculateCompatibility,
};
