UPDATE app_state
SET value = COALESCE((
  SELECT jsonb_agg(entry)
  FROM jsonb_array_elements(app_state.value) AS entries(entry)
  WHERE entry ->> 'id' NOT LIKE 'berita-%'
), '[]'::jsonb),
updated_at = NOW()
WHERE key = 'dokumentasi';
