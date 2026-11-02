import assert from 'node:assert/strict';
import test from 'node:test';
import type { CompetitiveStore } from '../src/shared/competitive';
import { summarizeCompetitive } from '../src/server/competitive/stats';

const store: CompetitiveStore = {
  version: 1,
  updatedAt: '2026-11-02T12:00:00.000Z',
  source: 'quakeclub',
  matches: [
    {
      id: 'm2',
      matchId: 'm2',
      map: 'campgrounds',
      gameType: 'CA',
      playedAt: '2026-11-02T11:00:00.000Z',
      duration: 300,
      serverName: 'SkF',
      team1Score: 10,
      team2Score: 7,
      rated: true,
      players: [
        {
          steamId: '1',
          name: 'alk4pone',
          team: 1,
          kills: 12,
          deaths: 8,
          score: 100,
          damageDealt: 4000,
          damageTaken: 3000,
          rounds: 10,
          roundsWon: 10,
          performance: 25,
          eloChange: 8,
          clan: 'SkF乂',
          weapons: { RG: { hits: 4, shots: 10, kills: 3, damage: 320 } },
          medals: {},
        },
      ],
    },
    {
      id: 'm1',
      matchId: 'm1',
      map: 'asylum',
      gameType: 'CA',
      playedAt: '2026-11-01T11:00:00.000Z',
      duration: 300,
      serverName: 'SkF',
      team1Score: 4,
      team2Score: 10,
      rated: true,
      players: [
        {
          steamId: '1',
          name: 'alk4pone',
          team: 1,
          kills: 5,
          deaths: 10,
          score: 50,
          damageDealt: 2000,
          damageTaken: 3500,
          rounds: 10,
          roundsWon: 4,
          performance: 15,
          eloChange: -4,
          clan: 'SKF乂',
          weapons: { RG: { hits: 2, shots: 10, kills: 1, damage: 160 } },
          medals: {},
        },
      ],
    },
  ],
};

test('competitive summary aggregates clan record and player stats', () => {
  const summary = summarizeCompetitive(store);
  assert.equal(summary.totalMatches, 2);
  assert.equal(summary.wins, 1);
  assert.equal(summary.losses, 1);
  assert.equal(summary.winRate, 50);
  assert.equal(summary.playerCount, 1);

  const player = summary.players[0]!;
  assert.equal(player.name, 'alk4pone');
  assert.equal(player.appearances, 2);
  assert.equal(player.kills, 17);
  assert.equal(player.deaths, 18);
  assert.equal(player.avgPerformance, 20);
  assert.equal(player.eloChange, 4);
  assert.deepEqual(player.recentForm, ['win', 'loss']);

  const rail = player.weapons.find((w) => w.weapon === 'RG')!;
  assert.equal(rail.hits, 6);
  assert.equal(rail.shots, 20);
  assert.equal(rail.accuracy, 30);
});
