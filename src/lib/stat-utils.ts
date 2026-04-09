/**
 * Standardized Box Score Calculator (Module 3)
 * Generates accurate stats from raw play-by-play events.
 */
export interface PlayerStats {
  id: string;
  name: string;
  number: number;
  points: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
  assists: number;
  rebounds: number;
  steals: number;
  blocks: number;
  turnovers: number;
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
      fg_made: 0,
      fg_attempted: 0,
      three_made: 0,
      three_attempted: 0,
      ft_made: 0,
      ft_attempted: 0,
      assists: 0,
      rebounds: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0
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
        p.three_made += 1;
        p.three_attempted += 1;
        p.fg_made += 1;
        p.fg_attempted += 1;
      } else if (type?.includes('FT')) {
        p.points += 1;
        p.ft_made += 1;
        p.ft_attempted += 1;
      } else {
        p.points += 2;
        p.fg_made += 1;
        p.fg_attempted += 1;
      }
    } else {
      if (type?.includes('3PT')) {
        p.three_attempted += 1;
        p.fg_attempted += 1;
      } else if (type?.includes('FT')) {
        p.ft_attempted += 1;
      } else if (type?.includes('SHOT') || type?.includes('2PT')) {
        p.fg_attempted += 1;
      }
    }
    
    if (type?.includes('ASSIST')) p.assists += 1;
    if (type?.includes('REBOUND')) p.rebounds += 1;
    if (type?.includes('STEAL')) p.steals += 1;
    if (type?.includes('BLOCK')) p.blocks += 1;
    if (type?.includes('TURNOVER')) p.turnovers += 1;
  });

  return Object.values(statsMap).sort((a, b) => b.points - a.points);
}