-- Drop ratings table and related objects
DROP TRIGGER IF EXISTS ratings_updated_at_trigger ON ratings;
DROP FUNCTION IF EXISTS update_ratings_updated_at();
DROP TABLE IF EXISTS ratings;
