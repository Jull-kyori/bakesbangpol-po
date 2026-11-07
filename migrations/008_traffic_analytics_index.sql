CREATE INDEX IF NOT EXISTS traffic_page_views_created_at_visitor_id_idx
  ON traffic_page_views (created_at DESC, visitor_id);
