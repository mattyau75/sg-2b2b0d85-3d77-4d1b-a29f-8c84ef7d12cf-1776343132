/**
 * Standardized Box Score Calculator (Module 3)
 * Generates accurate stats from raw play-by-play events.
 */
export interface PlayerStats {
  id: string;
  name: string;
  number: number;
  points: number;
  fgm: number;
  fga: number;
  three_pm: number;
  three_pa: number;
  ftm: number;
  fta: number;
  ast: number;
  reb: number;
  stl: number;
  blk: number;
  to: number;
}

export function calculateBoxScore(events: any[], players: any[]): PlayerStats[] {
  const statsMap: Record<string, PlayerStats> = {};

  // Initialize roster from directory
  players.forEach(p => {
    statsMap[p.id] = {
      id: p.id,
      name: p.name,
      number: p.number,
      points: 0,
      fgm: 0,
      fga: 0,
      three_pm: 0,
      three_pa: 0,
      ftm: 0,
      fta: 0,
      ast: 0,
      reb: 0,
      stl: 0,
      blk: 0,
      to: 0
    };
  });

  // Aggregate events into statistical buckets
  events.forEach(event => {
    if (!event.player_id || !statsMap[event.player_id]) return;
    
    const p = statsMap[event.player_id];
    const type = event.event_type?.toUpperCase();
    
    if (event.is_make) {
      if (type?.includes('3PT')) {
        p.points += 3;
        p.three_pm += 1;
        p.three_pa += 1;
        p.fgm += 1;
        p.fga += 1;
      } else if (type?.includes('FT')) {
        p.points += 1;
        p.ftm += 1;
        p.fta += 1;
      } else {
        p.points += 2;
        p.fgm += 1;
        p.fga += 1;
      }
    } else {
      if (type?.includes('3PT')) {
        p.three_pa += 1;
        p.fga += 1;
      } else if (type?.includes('FT')) {
        p.fta += 1;
      } else if (type?.includes('SHOT') || type?.includes('2PT')) {
        p.fga += 1;
      }
    }
    
    if (type?.includes('ASSIST')) p.ast += 1;
    if (type?.includes('REBOUND')) p.reb += 1;
    if (type?.includes('STEAL')) p.stl += 1;
    if (type?.includes('BLOCK')) p.blk += 1;
    if (type?.includes('TURNOVER')) p.to += 1;
  });

  return Object.values(statsMap).sort((a, b) => b.points - a.points);
}