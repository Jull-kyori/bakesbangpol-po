ALTER TABLE app_state DROP CONSTRAINT app_state_key_check;
ALTER TABLE app_state
  ADD CONSTRAINT app_state_key_check
  CHECK (key IN ('berita', 'komentar', 'site-settings', 'dokumentasi'));

ALTER TABLE app_state DROP CONSTRAINT app_state_value_shape;
ALTER TABLE app_state
  ADD CONSTRAINT app_state_value_shape
  CHECK (
    (key = 'berita' AND jsonb_typeof(value) = 'array')
    OR (
      key = 'komentar'
      AND jsonb_typeof(value) = 'object'
      AND COALESCE(jsonb_typeof(value -> 'comments') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'reactions') = 'array', FALSE)
      AND COALESCE(jsonb_typeof(value -> 'reports') = 'array', FALSE)
    )
    OR (key = 'site-settings' AND jsonb_typeof(value) = 'object')
    OR (key = 'dokumentasi' AND jsonb_typeof(value) = 'array')
  );

INSERT INTO app_state (key, value)
VALUES (
  'dokumentasi',
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', 'berita-' || (news.item ->> 'id') || '-' || media.urutan::text,
        'judul', news.item ->> 'judul',
        'kategori', news.item ->> 'kategori',
        'tanggal', news.item ->> 'tanggal',
        'keterangan', '',
        'gambar', media.gambar,
        'createdAt', COALESCE(
          news.item ->> 'createdAt',
          (news.item ->> 'tanggal') || 'T00:00:00.000Z'
        )
      )
      ORDER BY news.item ->> 'tanggal' DESC, media.urutan DESC
    )
    FROM app_state AS source
    CROSS JOIN LATERAL jsonb_array_elements(source.value) AS news(item)
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN jsonb_typeof(news.item -> 'galeri') = 'array' THEN news.item -> 'galeri'
        ELSE '[]'::jsonb
      END
      || CASE
        WHEN NULLIF(news.item ->> 'gambar', '') IS NOT NULL
          THEN jsonb_build_array(news.item ->> 'gambar')
        ELSE '[]'::jsonb
      END
    ) WITH ORDINALITY AS media(gambar, urutan)
    WHERE source.key = 'berita'
  ), '[]'::jsonb)
)
ON CONFLICT (key) DO NOTHING;
