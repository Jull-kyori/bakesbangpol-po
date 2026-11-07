CREATE TABLE IF NOT EXISTS traffic_page_views (
  id BIGSERIAL PRIMARY KEY,
  visitor_id UUID NOT NULL,
  page_path TEXT NOT NULL CHECK (
    page_path IN ('/', '/berita.html', '/berita-detail.html', '/aspirasi.html', '/kebijakan.html')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS traffic_page_views_created_at_idx
  ON traffic_page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS traffic_page_views_path_created_at_idx
  ON traffic_page_views (page_path, created_at DESC);

ALTER TABLE admin_activity DROP CONSTRAINT IF EXISTS admin_activity_actor_check;
ALTER TABLE admin_activity
  ADD CONSTRAINT admin_activity_actor_check
  CHECK (actor IN ('Admin', 'Tidak terautentikasi'));
