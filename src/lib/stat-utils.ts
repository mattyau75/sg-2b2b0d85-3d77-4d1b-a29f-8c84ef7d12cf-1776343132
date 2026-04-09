/**
 * Standardized Box Score Calculator
 * Module 3: Generates accurate stats from raw play-by-play events.
 */
export interface PlayerStats {
  id: string;
  name: string;
  number: number;
  points: number;
  fgm: number;
  fga: number;
  fg_pct: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
}

export function calculateBoxScore(events: any[], players: any[]): PlayerStats[] {
  const statsMap: Record<string, PlayerStats> = {};

  // Initialize roster
  players.forEach(p => {
    statsMap[p.id] = {
      id: p.id,
      name: p.name,
      number: p.number,
      points: 0,
      fgm: 0,
      fga: 0,
      fg_pct: 0,
      ast: 0,
      reb: 0,
      stl: 0,
      blk: 0
    };
  });

  // Aggregate events
  events.forEach(event => {
    if (!event.player_id || !statsMap[event.player_id]) return;
    
    const p = statsMap[event.player_id];
    
    switch (event.event_type) {
      case 'MADE_2PT':
        p.points += 2;
        p.fgm += 1;
        p.fga += 1;
        break;
      case 'MADE_3PT':
        p.points += 3;
        p.fgm += 1;
        p.fga += 1;
        break;
      case 'MISS_2PT':
      case 'MISS_3PT':
        p.fga += 1;
        break;
      case 'ASSIST':
        p.ast += 1;
        break;
      case 'REBOUND':
        p.reb += 1;
        break;
      case 'STEAL':
        p.stl += 1;
        break;
      case 'BLOCK':
        p.blk += 1;
        break;
    }
  });

  // Final calculations
  return Object.values(statsMap).map(p => ({
    ...p,
    fg_pct: p.fga > 0 ? (p.fgm / p.fga) * 100 : 0
  })).sort((a, b) => b.points - a.points);
}