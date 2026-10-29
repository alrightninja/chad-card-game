const { shuffle } = require("./cardRegistry");

function applyAbility(state, source, target, ability) {
  if (!ability || !ability.keyword) return state;
  const handler = AbilityHandlers[ability.keyword];
  if (!handler) {
    state.log.push(`No handler for ability: ${ability.keyword}`);
    return state;
  }
  return handler(state, source, target, ability.value);
}

function sideOf(state, who) {
  return who === "player" ? state.player : state.opponent;
}

function getOwner(state, unit) {
  const zones = ["active", "bench", "hand", "discard"];
  for (const zone of zones) {
    if ((state.player[zone] || []).includes(unit)) return "player";
    if ((state.opponent[zone] || []).includes(unit)) return "opponent";
  }
  return state.turnPlayer;
}

function getOpponent(player) {
  return player === "player" ? "opponent" : "player";
}

function pushSecret(state, seat, text) {
  if (!state.secretLog) state.secretLog = { player: [], opponent: [] };
  if (!state.secretLog[seat]) state.secretLog[seat] = [];
  state.secretLog[seat].push(text);
}

function enemySide(state, source) {
  return sideOf(state, getOpponent(getOwner(state, source)));
}

function friendSide(state, source) {
  return sideOf(state, getOwner(state, source));
}

function drawCard(state, owner, count = 1) {
  const playerState = sideOf(state, owner);
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    const card = playerState.deck.shift();
    if (!card) break;
    playerState.hand.push(card);
    drawn += 1;
  }
  return drawn;
}

function discardRandom(hand, n, pile) {
  let moved = 0;
  for (let i = 0; i < n && hand.length; i++) {
    const idx = Math.floor(Math.random() * hand.length);
    pile.push(hand.splice(idx, 1)[0]);
    moved += 1;
  }
  return moved;
}

function healUnit(unit, value) {
  const printed = unit.printedPower ?? unit.power ?? 0;
  const before = unit.power || 0;
  unit.power = Math.min(printed, before + value);
  return unit.power - before;
}

const AbilityHandlers = {
  PowerUp: (state, source, target, value) => {
    source.tempPower = (source.tempPower || 0) + value;
    state.log.push(`${source.name} gains +${value} Power.`);
    return state;
  },

  PowerDown: (state, source, target, value) => {
    if (target) {
      target.tempPower = (target.tempPower || 0) - value;
      state.log.push(`${target.name} loses ${value} Power.`);
    }
    return state;
  },

  Draw: (state, source, target, value) => {
    const owner = getOwner(state, source);
    const n = drawCard(state, owner, value);
    state.log.push(`${source.name} draws ${n}.`);
    return state;
  },

  Spike: (state, source, target, value) => {
    if (target) {
      target.tempPower = (target.tempPower || 0) - value;
      state.log.push(`${target.name} takes ${value} Spike damage.`);
    }
    return state;
  },

  CoinFlipKO: (state, source, target) => {
    const result = state.resolveCoinFlip();
    state.log.push(`${source.name} flips a coin… ${result ? "Heads!" : "Tails."}`);
    if (result && target) {
      target.tempPower = -9999;
      state.log.push(`${source.name}'s CoinFlipKO triggers! ${target.name} is KO'd.`);
    }
    return state;
  },

  CoinFlipDiscard: (state, source, target, value) => {
    const result = state.resolveCoinFlip();
    state.log.push(`${source.name} flips a coin… ${result ? "Heads!" : "Tails."}`);
    if (result) {
      const enemy = enemySide(state, source);
      const n = discardRandom(enemy.hand, value, enemy.discard);
      state.log.push(`Opponent discards ${n} (CoinFlipDiscard).`);
    }
    return state;
  },

  CoinFlipRestoreOrSkip: (state, source, target, value) => {
    const result = state.resolveCoinFlip();
    state.log.push(`${source.name} flips a coin… ${result ? "Heads!" : "Tails."}`);
    if (result) {
      source.tempPower = (source.tempPower || 0) + value;
      state.log.push(`${source.name} restores +${value} Power!`);
    } else {
      const enemy = getOpponent(getOwner(state, source));
      state.skipTurn = enemy;
      state.log.push(`${enemy} skips their next turn.`);
    }
    return state;
  },

  KORevenge: (state, source, target) => {
    if (target) {
      target.tempPower = -9999;
      state.log.push(`${source.name}'s KORevenge triggers!`);
    }
    return state;
  },

  Promote: (state, source, target, value) => {
    const mine = friendSide(state, source);
    if (mine.bench.length > 0) {
      const promoted = mine.bench[0];
      promoted.tempPower = (promoted.tempPower || 0) + value;
      state.log.push(`${promoted.name} gains +${value} Power from Promote.`);
    }
    return state;
  },

  Mill: (state, source, target, value) => {
    const enemy = enemySide(state, source);
    let n = 0;
    for (let i = 0; i < value; i++) {
      const card = enemy.deck.shift();
      if (!card) break;
      enemy.discard.push(card);
      n += 1;
    }
    state.log.push(`Opponent mills ${n} cards.`);
    return state;
  },

  SkipTurn: (state, source) => {
    state.skipTurn = getOpponent(getOwner(state, source));
    state.log.push(`${state.skipTurn} will skip their next turn.`);
    return state;
  },

  Silence: (state, source, target, value) => {
    const enemy = enemySide(state, source);
    enemy.silencedTurns = value;
    state.log.push(`Opponent is silenced for ${value} turn(s).`);
    return state;
  },

  ArmorUp: (state, source, target, value) => {
    source.armor = (source.armor || 0) + value;
    state.log.push(`${source.name} gains ${value} Armor.`);
    return state;
  },

  Shielded: (state, source, target, value) => {
    source.armor = (source.armor || 0) + value;
    state.log.push(`${source.name} is Shielded (${value} less damage).`);
    return state;
  },

  DebuffAll: (state, source, target, value) => {
    const enemy = enemySide(state, source);
    [...enemy.active, ...enemy.bench].forEach((unit) => {
      unit.tempPower = (unit.tempPower || 0) - value;
    });
    state.log.push(`All opposing Units lose ${value} Power.`);
    return state;
  },

  BenchBuff: (state, source, target, value) => {
    friendSide(state, source).bench.forEach((unit) => {
      unit.tempPower = (unit.tempPower || 0) + value;
    });
    state.log.push(`Benched allies gain +${value} Power.`);
    return state;
  },

  Rooted: (state, source) => {
    source.rooted = true;
    state.log.push(`${source.name} is Rooted.`);
    return state;
  },

  RetreatFree: (state, source) => {
    source.retreatFree = true;
    return state;
  },

  Unblockable: (state, source) => {
    source.unblockable = true;
    state.log.push(`${source.name} is Unblockable.`);
    return state;
  },

  MultiAttack: (state, source, target, value) => {
    source.multiAttack = value;
    source.baseMultiAttack = value;
    state.log.push(`${source.name} may attack ${value} times.`);
    return state;
  },

  TraitCopy: (state, source, target) => {
    if (target?.trait) {
      source.originalTrait = source.originalTrait || source.trait;
      source.trait = target.trait;
      state.log.push(`${source.name} copies ${target.trait}.`);
    }
    return state;
  },

  TraitSteal: (state, source, target) => {
    if (target?.trait) {
      source.originalTrait = source.originalTrait || source.trait;
      source.trait = target.trait;
      state.log.push(`${source.name} steals ${target.trait}.`);
    }
    return state;
  },

  ReverseWeakness: (state, source) => {
    source.reverseWeakness = true;
    state.log.push(`${source.name} reverses trait weakness.`);
    return state;
  },

  Stun: (state, source, target) => {
    if (target) {
      target.stunned = true;
      state.log.push(`${target.name} is Stunned and cannot attack next turn.`);
    }
    return state;
  },

  Peek: (state, source) => {
    const owner = getOwner(state, source);
    const top = friendSide(state, source).deck[0];
    state.log.push(`${source.name} peeks at the top of their deck.`);
    pushSecret(
      state,
      owner,
      top ? `${source.name} peeks: ${top.name}.` : `${source.name} peeks at an empty deck.`
    );
    return state;
  },

  Scry: (state, source) => {
    const owner = getOwner(state, source);
    const mine = friendSide(state, source);
    const top = mine.deck[0];
    if (!top) {
      state.log.push(`${source.name} checks the top of their deck.`);
      pushSecret(state, owner, `${source.name} looks at an empty deck.`);
      return state;
    }
    const bury = (top.power || 0) < 28;
    if (bury) {
      mine.deck.shift();
      mine.deck.push(top);
      state.log.push(`${source.name} checks the top of their deck.`);
      pushSecret(state, owner, `${source.name} sees ${top.name} and puts it on the bottom.`);
    } else {
      state.log.push(`${source.name} checks the top of their deck.`);
      pushSecret(state, owner, `${source.name} sees ${top.name} and leaves it on top.`);
    }
    return state;
  },

  PowerShield: (state, source, target, value) => {
    source.shield = (source.shield || 0) + value;
    state.log.push(`${source.name} gains ${value} Power Shield.`);
    return state;
  },

  ChaosSwing: (state, source, target, value) => {
    const delta = Math.floor(Math.random() * (value * 2 + 1)) - value;
    source.tempPower = (source.tempPower || 0) + delta;
    state.log.push(`${source.name} Chaos Swing: ${delta >= 0 ? "+" : ""}${delta} Power.`);
    return state;
  },

  Heal: (state, source, target, value) => {
    const healed = healUnit(source, value);
    state.log.push(`${source.name} heals ${healed} Power.`);
    return state;
  },

  Restore: (state, source, target, value) => {
    const mine = friendSide(state, source);
    [...mine.active, ...mine.bench].forEach((unit) => healUnit(unit, value));
    state.log.push(`${source.name} restores ${value} Power to friendly units.`);
    return state;
  },

  Recycle: (state, source, target, value) => {
    const mine = friendSide(state, source);
    const take = mine.discard.splice(0, value);
    mine.deck.push(...take);
    mine.deck = shuffle(mine.deck);
    state.log.push(`${source.name} recycles ${take.length} from discard into the deck.`);
    return state;
  },

  ForceSwap: (state, source, target) => {
    const enemy = enemySide(state, source);
    if (!target || !enemy.bench.length) {
      state.log.push("ForceSwap fizzles (no Bench unit to swap in).");
      return state;
    }
    const idx = enemy.active.indexOf(target);
    const b = Math.floor(Math.random() * enemy.bench.length);
    if (idx < 0) return state;
    const incoming = enemy.bench[b];
    enemy.bench[b] = target;
    enemy.active[idx] = incoming;
    state.log.push(`ForceSwap: ${incoming.name} replaces ${target.name}.`);
    return state;
  },

  CancelBattle: (state, source) => {
    state.cancelNextBattle = true;
    state.log.push(`${source.name} will cancel the next battle this turn.`);
    return state;
  },

  CancelTrait: (state, source, target) => {
    if (target) {
      target.originalTrait = target.originalTrait || target.trait;
      target.trait = null;
      state.log.push(`${target.name}'s trait is cancelled.`);
    }
    return state;
  },

  SilenceTrait: (state, source, target) => {
    if (target) {
      target.originalTrait = target.originalTrait || target.trait;
      target.trait = null;
      state.log.push(`${target.name}'s trait is silenced.`);
    }
    return state;
  },

  BottomDeck: (state, source) => {
    const mine = friendSide(state, source);
    if (!mine.hand.length) return state;
    const card = mine.hand.pop();
    mine.deck.push(card);
    state.log.push(`${source.name} puts ${card.name} on the bottom of the deck.`);
    return state;
  },

  ChoiceDrawOrDiscard: (state, source) => {
    const n = drawCard(state, getOwner(state, source), 1);
    state.log.push(`${source.name} chooses to draw (${n}).`);
    return state;
  },

  CostReduce: (state, source) => {
    const n = drawCard(state, getOwner(state, source), 1);
    state.log.push(`${source.name}: no play cost in this ruleset — draws ${n} instead.`);
    return state;
  },

  DiscardRandom: (state, source, target, value) => {
    const enemy = enemySide(state, source);
    const n = discardRandom(enemy.hand, value || 1, enemy.discard);
    state.log.push(`Opponent discards ${n} at random.`);
    return state;
  },

  DrawThenDiscard: (state, source, target, value) => {
    const owner = getOwner(state, source);
    drawCard(state, owner, value || 1);
    const mine = friendSide(state, source);
    discardRandom(mine.hand, 1, mine.discard);
    state.log.push(`${source.name} draws ${value}, then discards 1.`);
    return state;
  },

  DrawThenPlay: (state, source, target, value) => {
    const n = drawCard(state, getOwner(state, source), value || 1);
    state.log.push(`${source.name} draws ${n}. You may play another unit this Main Phase.`);
    return state;
  },

  AbilityCopy: (state, source, target) => {
    if (target?.ability) {
      source.ability = { ...target.ability };
      source.abilityKeyword = target.abilityKeyword;
      state.log.push(`${source.name} copies ${target.name}'s ability this turn.`);
    }
    return state;
  },

  KOThreshold: (state, source, target, value) => {
    if (target && (target.power || 0) <= value) {
      target.tempPower = -9999;
      state.log.push(`${source.name} meets KO Threshold — ${target.name} is KO'd!`);
    }
    return state;
  },

  PrecisionUp: (state, source, target, value) => {
    if (target && (source.power || 0) < (target.power || 0)) {
      source.tempPower = (source.tempPower || 0) + value;
      state.log.push(`${source.name} Precision: +${value} Power.`);
    }
    return state;
  },

  ResetHands: (state, source, target, value) => {
    const drawN = value || 5;
    for (const who of ["player", "opponent"]) {
      const side = sideOf(state, who);
      side.discard.push(...side.hand);
      side.hand = [];
      drawCard(state, who, drawN);
    }
    state.log.push(`${source.name} resets both hands (${drawN} each).`);
    return state;
  },

  Retreat: (state, source) => {
    source.pendingRetreat = true;
    state.log.push(`${source.name} will retreat after this battle.`);
    return state;
  },

  Reveal: (state, source) => {
    const names = enemySide(state, source).hand.map((c) => c.name);
    state.log.push(
      names.length
        ? `${source.name} reveals the enemy hand: ${names.join(", ")}.`
        : `${source.name} reveals an empty hand.`
    );
    return state;
  },

  RevealDraw: (state, source) => {
    const mine = friendSide(state, source);
    const top = mine.deck[0];
    if (top) state.log.push(`${source.name} reveals ${top.name} and draws it.`);
    drawCard(state, getOwner(state, source), 1);
    return state;
  },

  RevengeUp: (state, source, target, value) => {
    if (state.lastKoSeat === getOwner(state, source)) {
      source.tempPower = (source.tempPower || 0) + value;
      state.log.push(`${source.name} Revenge: +${value} Power.`);
    }
    return state;
  },

  ShuffleBench: (state, source) => {
    const mine = friendSide(state, source);
    mine.bench = shuffle(mine.bench);
    state.log.push(`${source.name} shuffles the Bench.`);
    return state;
  },

  SwapBoost: (state, source, target, value) => {
    const mine = friendSide(state, source);
    mine.nextSwapBoost = value;
    state.log.push(`Next swap grants +${value} Power to the unit entering Active.`);
    return state;
  },

  TempoUp: (state, source, target, value) => {
    friendSide(state, source).active.forEach((unit) => {
      unit.tempPower = (unit.tempPower || 0) + value;
    });
    state.log.push(`Tempo up: Active units gain +${value} this turn.`);
    return state;
  },

  TempoDown: (state, source, target, value) => {
    enemySide(state, source).active.forEach((unit) => {
      unit.tempPower = (unit.tempPower || 0) - value;
    });
    state.log.push(`Tempo down: Enemy Active units lose ${value} this turn.`);
    return state;
  },

  Tutor: (state, source) => {
    const mine = friendSide(state, source);
    if (!mine.deck.length) return state;
    let best = 0;
    for (let i = 1; i < mine.deck.length; i++) {
      if ((mine.deck[i].power || 0) > (mine.deck[best].power || 0)) best = i;
    }
    const [card] = mine.deck.splice(best, 1);
    mine.hand.push(card);
    mine.deck = shuffle(mine.deck);
    state.log.push(`${source.name} tutors ${card.name}.`);
    return state;
  }
};

function triggerDefeatAbilities(state, unit) {
  if (!unit?.abilityCategory || unit.abilityCategory !== "Defeat") return state;
  const enemy = enemySide(state, unit);
  applyAbility(state, unit, enemy.active[0] || null, unit.ability);
  return state;
}

module.exports = { applyAbility, triggerDefeatAbilities, getOwner };
