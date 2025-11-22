import postgres from 'postgres';

/**
 * Shared PostgreSQL connection instance
 * This singleton pattern prevents connection pool exhaustion by reusing the same connection
 * across all API routes.
 *
 * Connection configuration:
 * - SSL required for secure connections
 * - Connection timeout: 30 seconds
 * - Idle timeout: 30 seconds (close idle connections to prevent pool exhaustion)
 * - Max connections: 10 (prevent too many concurrent connections)
 * - Automatic reconnection on connection loss
 */
const sql = postgres(process.env.POSTGRES_URL!, {
  ssl: 'require',
  connect_timeout: 30,
  idle_timeout: 30,
  max: 10,
  onnotice: () => {}, // Suppress notices to reduce console noise
});

export default sql;
