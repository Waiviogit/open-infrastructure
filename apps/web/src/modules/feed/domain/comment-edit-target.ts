/**
 * A published comment or thread opened for an inline edit. The re-broadcast keeps its author,
 * permlink and parent; `title` and `jsonMetadata` are the published values.
 */
export type CommentEditTarget = {
  author: string;
  permlink: string;
  parentAuthor: string;
  parentPermlink: string;
  title: string;
  /** Published markdown body. */
  body: string;
  /** Raw Hive `json_metadata` string. */
  jsonMetadata: string;
};
