// Generate proper seeding order for a bracket of size n (power of 2)
export function generateSeedOrder(size) {
  if (size === 1) return [1];
  if (size === 2) return [1, 2];

  const half = generateSeedOrder(size / 2);
  const result = [];
  for (let i = 0; i < half.length; i++) {
    result.push(half[i]);
    result.push(size + 1 - half[i]);
  }
  return result;
}

// Get next power of 2 >= n
export function nextPowerOf2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Get round label
export function getRoundLabel(roundIndex, totalRounds) {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return 'Finals';
  if (remaining === 2) return 'Semifinals';
  if (remaining === 3) return 'Quarterfinals';
  return `Round ${roundIndex + 1}`;
}

// Generate single elimination bracket
export function generateSingleElimination(participants) {
  const count = participants.length;
  const bracketSize = nextPowerOf2(count);
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = generateSeedOrder(bracketSize);

  // Create first round matches
  const rounds = [];
  const firstRoundMatches = [];

  for (let i = 0; i < seedOrder.length; i += 2) {
    const seed1 = seedOrder[i];
    const seed2 = seedOrder[i + 1];
    const p1 = seed1 <= count ? { ...participants[seed1 - 1], seed: seed1 } : null;
    const p2 = seed2 <= count ? { ...participants[seed2 - 1], seed: seed2 } : null;

    const match = {
      id: `W-0-${i / 2}`,
      round: 0,
      position: i / 2,
      team1: p1,
      team2: p2,
      winner: null,
      isBye: !p1 || !p2,
    };

    // Auto-advance byes
    if (match.isBye) {
      match.winner = p1 || p2;
    }

    firstRoundMatches.push(match);
  }

  rounds.push(firstRoundMatches);

  // Create subsequent rounds
  for (let r = 1; r <= totalRounds; r++) {
    const prevRound = rounds[r - 1];
    const currentRound = [];

    // Special: if this is the champion round (1 match), treat differently
    if (r === totalRounds) {
      // Champion display - single match for finals already added
      // Actually the last round with 1 match is the finals
    }

    for (let i = 0; i < prevRound.length; i += 2) {
      const match = {
        id: `W-${r}-${i / 2}`,
        round: r,
        position: i / 2,
        team1: null,
        team2: null,
        winner: null,
        isBye: false,
        feedMatch1: prevRound[i].id,
        feedMatch2: prevRound[i + 1]?.id,
      };

      // Auto-propagate bye winners
      if (prevRound[i].isBye && prevRound[i].winner) {
        match.team1 = prevRound[i].winner;
      }
      if (prevRound[i + 1]?.isBye && prevRound[i + 1].winner) {
        match.team2 = prevRound[i + 1].winner;
      }

      // If both teams filled via byes and it's an early round, check if we should auto-advance
      currentRound.push(match);
    }

    if (currentRound.length > 0) {
      rounds.push(currentRound);
    }
  }

  return { rounds, totalRounds: rounds.length };
}

// Generate double elimination bracket
export function generateDoubleElimination(participants) {
  const { rounds: winnersRounds } = generateSingleElimination(participants);
  const totalWinnerRounds = winnersRounds.length;

  // Losers bracket has roughly 2 * (totalWinnerRounds - 1) - 1 rounds
  // Each winner round (except first) drops losers into losers bracket
  const losersRounds = [];
  const numFirstRoundMatches = winnersRounds[0].length;

  // Losers round 1: losers from winners round 1
  const lr1 = [];
  for (let i = 0; i < numFirstRoundMatches; i += 2) {
    lr1.push({
      id: `L-0-${i / 2}`,
      round: 0,
      position: i / 2,
      team1: null, // loser from W-0-i
      team2: null, // loser from W-0-i+1
      winner: null,
      isBye: false,
      isLosers: true,
      feedFromWinners1: winnersRounds[0][i].id,
      feedFromWinners2: winnersRounds[0][i + 1]?.id,
    });
  }
  losersRounds.push(lr1);

  // Subsequent losers rounds alternate between:
  // - "merge" rounds (receive dropdowns from winners)
  // - "reduce" rounds (just losers bracket matches)
  let currentLosersMatchCount = lr1.length;
  let winnersRoundIdx = 2; // Start feeding from winners round 2

  let losersRoundIdx = 1;
  while (currentLosersMatchCount > 1 || losersRoundIdx < (totalWinnerRounds - 1) * 2 - 1) {
    if (losersRoundIdx % 2 === 1 && winnersRoundIdx < totalWinnerRounds) {
      // Merge round: winners from prev losers round vs dropdowns from winners
      const mergeRound = [];
      for (let i = 0; i < currentLosersMatchCount; i++) {
        mergeRound.push({
          id: `L-${losersRoundIdx}-${i}`,
          round: losersRoundIdx,
          position: i,
          team1: null,
          team2: null,
          winner: null,
          isBye: false,
          isLosers: true,
          feedFromWinnersRound: winnersRoundIdx - 1,
        });
      }
      losersRounds.push(mergeRound);
      winnersRoundIdx++;
    } else {
      // Reduce round
      const reduceRound = [];
      const newCount = Math.ceil(currentLosersMatchCount / 2);
      for (let i = 0; i < newCount; i++) {
        reduceRound.push({
          id: `L-${losersRoundIdx}-${i}`,
          round: losersRoundIdx,
          position: i,
          team1: null,
          team2: null,
          winner: null,
          isBye: false,
          isLosers: true,
        });
      }
      losersRounds.push(reduceRound);
      currentLosersMatchCount = newCount;
    }

    losersRoundIdx++;
    if (losersRoundIdx > 20) break; // Safety
  }

  // Grand finals
  const grandFinals = [{
    id: 'GF-0',
    round: 0,
    position: 0,
    team1: null, // Winner of winners bracket
    team2: null, // Winner of losers bracket
    winner: null,
    isBye: false,
    isGrandFinals: true,
  }];

  return {
    winnersRounds,
    losersRounds,
    grandFinals,
    totalWinnerRounds,
  };
}

// Split a single-elimination bracket into west/east halves for double-sided layout
// West = top half of the draw, East = bottom half, finals in the center
export function splitBracketForDoubleSided(rounds) {
  if (rounds.length < 2) {
    return { west: rounds, east: [], finals: [] };
  }

  // The first round has N matches. Split them in half.
  // West gets matches 0..N/2-1, East gets N/2..N-1
  // Subsequent rounds follow the same split until we reach the finals (1 match)
  const west = [];
  const east = [];
  let finals = [];

  for (let r = 0; r < rounds.length; r++) {
    const matches = rounds[r];
    if (matches.length === 1) {
      // This is the finals match
      finals = matches;
      break;
    }
    const half = Math.ceil(matches.length / 2);
    west.push(matches.slice(0, half));
    east.push(matches.slice(half));
  }

  return { west, east, finals };
}

// Advance a winner in single elimination
export function advanceWinner(rounds, matchId, team) {
  const newRounds = rounds.map(round =>
    round.map(match => ({ ...match }))
  );

  // Find the match
  let matchRound = -1;
  let matchPos = -1;
  for (let r = 0; r < newRounds.length; r++) {
    for (let m = 0; m < newRounds[r].length; m++) {
      if (newRounds[r][m].id === matchId) {
        matchRound = r;
        matchPos = m;
        break;
      }
    }
  }

  if (matchRound === -1) return newRounds;

  // Set winner
  newRounds[matchRound][matchPos].winner = team;

  // Propagate to next round
  const nextRound = matchRound + 1;
  if (nextRound < newRounds.length) {
    const nextMatchPos = Math.floor(matchPos / 2);
    const isTop = matchPos % 2 === 0;

    if (nextMatchPos < newRounds[nextRound].length) {
      if (isTop) {
        newRounds[nextRound][nextMatchPos].team1 = team;
      } else {
        newRounds[nextRound][nextMatchPos].team2 = team;
      }

      // Clear downstream if winner changed
      clearDownstream(newRounds, nextRound, nextMatchPos);
    }
  }

  return newRounds;
}

function clearDownstream(rounds, roundIdx, matchIdx) {
  const match = rounds[roundIdx][matchIdx];
  if (match.winner) {
    // If the current winner is being replaced, clear it
    const nextRound = roundIdx + 1;
    if (nextRound < rounds.length) {
      const nextMatchPos = Math.floor(matchIdx / 2);
      const isTop = matchIdx % 2 === 0;
      if (nextMatchPos < rounds[nextRound].length) {
        if (isTop) {
          rounds[nextRound][nextMatchPos].team1 = null;
        } else {
          rounds[nextRound][nextMatchPos].team2 = null;
        }
        rounds[nextRound][nextMatchPos].winner = null;
        clearDownstream(rounds, nextRound, nextMatchPos);
      }
    }
    match.winner = null;
  }
}
