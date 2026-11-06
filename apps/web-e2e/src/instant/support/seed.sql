-- Instant-navigation e2e data: viewer carol follows two objects; feeds are long enough to scroll.
-- Runs against the `test` database only (global-setup.ts refuses anything else).
BEGIN;

TRUNCATE accounts_current, objects_core, user_object_follows, object_updates, threads,
  channels, messages, user_account_mutes, posts CASCADE;

INSERT INTO accounts_current (name, wobjects_weight) VALUES
  ('carol', 10), ('alice', 50), ('bob', 20), ('dave', 1);

INSERT INTO objects_core (object_id, object_type, creator, transaction_id, weight) VALUES
  ('cafe-1', 'restaurant', 'alice', 'tx-o1', 100),
  ('park-2', 'place', 'bob', 'tx-o2', 50),
  ('museum-3', 'place', 'bob', 'tx-o3', 10);

INSERT INTO user_object_follows (account, object_id) VALUES ('carol', 'cafe-1'), ('carol', 'park-2');

INSERT INTO object_updates (update_id, object_id, update_type, creator, locale, created_at_unix, event_seq, transaction_id, value_text) VALUES
  ('u-cafe-name', 'cafe-1', 'name', 'alice', 'en-US', 1762400000, 1001, 'tx-u1', 'Blue Cafe'),
  ('u-park-name', 'park-2', 'name', 'bob', 'en-US', 1762400100, 1002, 'tx-u2', 'Central Park'),
  ('u-museum-name', 'museum-3', 'name', 'bob', 'en-US', 1762400200, 1003, 'tx-u3', 'Art Museum'),
  ('u-cafe-desc', 'cafe-1', 'description', 'bob', 'en-US', 1762400300, 1004, 'tx-u4', 'Best coffee in town'),
  ('u-park-desc', 'park-2', 'description', 'alice', 'en-US', 1762400400, 1005, 'tx-u5', 'Big green park');

INSERT INTO object_updates (update_id, object_id, update_type, creator, locale, created_at_unix, event_seq, transaction_id, value_text)
SELECT 'u-bulk-' || g, 'cafe-1', 'description', 'bob', 'en-US', 1762300000 + g, 5000 + g, 'tx-b' || g, 'Bulk update ' || g
FROM generate_series(1, 30) g;

INSERT INTO threads (author, permlink, parent_author, parent_permlink, body, hashtags, type, created_unix, created) VALUES
  ('alice', 't-cafe', 'leothreads', 'root', 'Great espresso at #cafe-1 today', '{cafe-1}', 'leothreads', 1762401000, '2025-11-06T03:50:00'),
  ('bob', 't-park', 'leothreads', 'root', 'Walk in #park-2', '{park-2}', 'leothreads', 1762402000, '2025-11-06T04:06:40');

INSERT INTO threads (author, permlink, parent_author, parent_permlink, body, hashtags, type, created_unix, created)
SELECT 'alice', 'bulk-' || g, 'leothreads', 'root', 'Bulk thread number ' || g || ' about #cafe-1', '{cafe-1}', 'leothreads',
  1762300000 + g, to_char(to_timestamp(1762300000 + g) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')
FROM generate_series(1, 30) g;

INSERT INTO channels (channel_id, kind, object_id, creator, access, title, created_at_unix, event_seq, transaction_id) VALUES
  ('ch-cafe', 'object', 'cafe-1', 'alice', 'public', 'Blue Cafe', 1762400000, 2001, 'tx-c1');

INSERT INTO messages (message_id, channel_id, author, body, created_at_unix, event_seq, transaction_id, dup_group_id) VALUES
  ('m-cafe-1', 'ch-cafe', 'alice', 'New seasonal menu is live', 1762406000, 3001, 'tx-m1', 'm-cafe-1');

INSERT INTO posts (author, permlink, title, body, json_metadata, depth, category, parent_permlink, root_author, root_permlink, created, created_unix) VALUES
  ('alice', 'espresso-review', 'Espresso review at Blue Cafe', 'The espresso at Blue Cafe is rich and balanced. Worth the visit.',
   '{"tags":["coffee"]}', 0, 'coffee', 'coffee', 'alice', 'espresso-review', '2025-11-06T04:00:00', 1762401600);
COMMIT;
