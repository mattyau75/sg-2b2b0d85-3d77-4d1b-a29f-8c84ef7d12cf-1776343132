-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams Table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#FF6B00',
  secondary_color TEXT DEFAULT '#0B0F19',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Players Table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  number INTEGER,
  position TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Games Table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  home_team_id UUID REFERENCES teams(id),
  away_team_id UUID REFERENCES teams(id),
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  venue TEXT,
  youtube_url TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, processing, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Play-by-Play Events
CREATE TABLE play_by_play (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id),
  team_id UUID REFERENCES teams(id),
  event_type TEXT NOT NULL, -- shot, rebound, assist, foul, turnover, etc.
  description TEXT,
  game_time TEXT, -- e.g., "12:00 Q1"
  timestamp_seconds INTEGER, -- Video timestamp
  x_coord DECIMAL, -- Shot location x (0-100)
  y_coord DECIMAL, -- Shot location y (0-100)
  is_make BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stats Cache (Denormalized for quick access)
CREATE TABLE player_game_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  minutes INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  rebounds INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  steals INTEGER DEFAULT 0,
  blocks INTEGER DEFAULT 0,
  turnovers INTEGER DEFAULT 0,
  fg_made INTEGER DEFAULT 0,
  fg_attempted INTEGER DEFAULT 0,
  three_made INTEGER DEFAULT 0,
  three_attempted INTEGER DEFAULT 0,
  ft_made INTEGER DEFAULT 0,
  ft_attempted INTEGER DEFAULT 0,
  plus_minus INTEGER DEFAULT 0,
  UNIQUE(game_id, player_id)
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_by_play ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_game_stats ENABLE ROW LEVEL SECURITY;

-- T2 Policies (Public read, authenticated write)
CREATE POLICY "public_read_teams" ON teams FOR SELECT USING (true);
CREATE POLICY "public_read_players" ON players FOR SELECT USING (true);
CREATE POLICY "public_read_games" ON games FOR SELECT USING (true);
CREATE POLICY "public_read_pbp" ON play_by_play FOR SELECT USING (true);
CREATE POLICY "public_read_stats" ON player_game_stats FOR SELECT USING (true);

CREATE POLICY "auth_write_teams" ON teams FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_write_players" ON players FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_write_games" ON games FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_write_pbp" ON play_by_play FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_write_stats" ON player_game_stats FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);