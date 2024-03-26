import type { OnChangeAction, OnChangeEvent, PlayerId, Players, RuneClient } from "rune-games-sdk/multiplayer"

export const SLOW_DOWN = 0.995;

export type Player = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprite: number;
  dead: boolean;
  lastBounce: number;
  ready: boolean;
}

export enum Item {
  SMALL_CACTUS = 1,
  CACTUS = 2,
  ROCKS = 3,
  GAP = 4,
  FLYING = 5,
  GAP2 = 6,
}

export interface GameEvent {
  xp: number;
  item: number;
  playerId: string;
}

export interface GameState {
  players: Record<PlayerId, Player>;
  nextSprite: number;
  items: Record<number, Item>;
  endGame: number;
  events: GameEvent[];
  gameStart: number;
}

function getRandomItem(): Item {
  return Item.GAP2;

  const value = Math.random();
  if (value < 0.2) {
    return Item.SMALL_CACTUS
  } else if (value < 0.4) {
    return Item.CACTUS
  } else if (value < 0.6) {
    return Item.ROCKS
  } else if (value < 0.8) {
    return Item.FLYING
  } else if (value < 0.9) {
    return Item.GAP
  } else {
    return Item.GAP2;
  }
}

type GameActions = {
  speed: (params: { speed: number }) => void,
  jump: () => void;
  ready: () => void;
}

// Quick type so I can pass the complex object that is the 
// Rune onChange blob around without ugliness. 
export type GameUpdate = {
  game: GameState;
  action?: OnChangeAction<GameActions>;
  event?: OnChangeEvent;
  yourPlayerId: PlayerId | undefined;
  players: Players;
  rollbacks: OnChangeAction<GameActions>[];
  previousGame: GameState;
  futureGame?: GameState;
};

declare global {
  const Rune: RuneClient<GameState, GameActions>
}

Rune.initLogic({
  minPlayers: 1,
  maxPlayers: 4,
  setup: (allPlayersIds: string[]): GameState => {
    const state: GameState = {
      players: {},
      nextSprite: 0,
      items: {},
      endGame: Rune.gameTime() + (1 * 60000),
      events: [],
      gameStart: 0
    };

    let x = 20;
    for (let i=0;i<500;i++) {
      x += 10 + Math.floor(Math.random() * 10);
      state.items[x] = getRandomItem();
    }

    let offset = 5 * 20;

    for (const playerId of allPlayersIds) {
      state.players[playerId] = {
        id: playerId,
        x: offset,
        y: 0,
        vx: 0,
        vy: 0,
        sprite: (state.nextSprite++)%4,
        dead: false,
        lastBounce: 0,
        ready: false
      }
      offset -= 20;
    }

    return state;
  },
  updatesPerSecond: 30,
  update: (context) => {
    if (!Object.values(context.game.players).every(p => p.ready)) {
      context.game.endGame =  Rune.gameTime() + (1 * 60000);
      return;
    }
    if (context.game.gameStart === 0) {
      context.game.gameStart = Rune.gameTime() + 3000;
    }
    if (Rune.gameTime() < context.game.gameStart) {
      context.game.endGame =  Rune.gameTime() + (1 * 60000);
      return;
    }

    // do nothing
    context.game.events = [];

    for (const p of Object.values(context.game.players)) {
      p.x += p.vx / 2;
      p.y += p.vy;
      if (p.vy !== 0) {
        p.vy += 1.9;
      }
      if (p.y > 0 && !p.dead) {
        p.vy = 0;
        p.y = 0;
      }

      if (!p.dead) {
        const xp = (Math.floor(p.x / 32));
        // on the ground over a gap - fall off screen
        if ((context.game.items[xp] === Item.GAP || context.game.items[xp+1] === Item.GAP) && (p.y === 0)) {
          p.vx = 0;
          p.vy = 1;
          p.dead = true;
        } else if ((context.game.items[xp] === Item.GAP2 || context.game.items[xp+1] === Item.GAP2 || context.game.items[xp+2] === Item.GAP2) && (p.y === 0)) {
          p.vx = 0;
          p.vy = 1;
          p.dead = true;
        } else if (context.game.items[xp] === Item.FLYING && p.y < -10) {
          p.vx = -20;
          p.vy = -10;
          p.x -= p.vx;
          context.game.events.push({ xp, item: context.game.items[xp], playerId: p.id });
          delete context.game.items[xp];
          p.lastBounce = Rune.gameTime();
        } else if (context.game.items[xp] !== Item.GAP && context.game.items[xp] !== Item.GAP2 && context.game.items[xp] !== Item.FLYING  && context.game.items[xp] && p.y > -8) {
          p.vx = -20;
          p.vy = -10;
          p.x -= p.vx;
          context.game.events.push({ xp, item: context.game.items[xp], playerId: p.id });
          delete context.game.items[xp];
          p.lastBounce = Rune.gameTime();
        }
      }
    }
  },
  actions: {
    speed: ({ speed }, context) => {
      if (Rune.gameTime() < context.game.gameStart) {
        return;
      }

      const player = context.game.players[context.playerId];
      if (player && !player.dead && Rune.gameTime() - player.lastBounce > 500) {
        player.vx = speed;
      }
    },
    jump: (_, context) => {
    if (Rune.gameTime() < context.game.gameStart) {
      return;
    }

      const player = context.game.players[context.playerId];
      if (player && !player.dead) {
        if (player.y == 0 && player.vy === 0) {
          player.vy = -10;
        }
      }
    },
    ready: (_, context) => {
      const player = context.game.players[context.playerId];
      if (player && !player.dead) {
        player.ready = true;
      }
    }
  },
})