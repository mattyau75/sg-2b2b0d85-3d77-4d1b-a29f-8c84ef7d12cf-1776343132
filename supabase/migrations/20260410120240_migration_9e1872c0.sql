-- 1. Ensure the games table has the ignition_status and worker_logs capability
    ALTER TABLE games ADD COLUMN IF NOT EXISTS ignition_status TEXT DEFAULT 'dormant';
    ALTER TABLE games ADD COLUMN IF NOT EXISTS processing_metadata JSONB DEFAULT '{"worker_logs": []}';
    
    -- 2. Create a high-performance heartbeat function that bypasses typical RLS constraints
    CREATE OR REPLACE FUNCTION public.worker_heartbeat(game_id UUID, p_progress INT, p_status TEXT, p_log_msg TEXT)
    RETURNS void AS $$
    BEGIN
      UPDATE public.games
      SET 
        progress_percentage = p_progress,
        status = p_status,
        last_heartbeat = NOW(),
        processing_metadata = jsonb_set(
          COALESCE(processing_metadata, '{"worker_logs": []}'),
          '{worker_logs}',
          (COALESCE(processing_metadata->'worker_logs', '[]'::jsonb) || jsonb_build_object(
            'timestamp', NOW(),
            'message', p_log_msg,
            'level', 'info'
          ))
        )
      WHERE id = game_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;