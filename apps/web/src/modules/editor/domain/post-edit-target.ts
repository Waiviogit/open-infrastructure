/** Published post being edited: re-broadcast keeps its permlink and parent. */
export type PostEditTarget = {
  permlink: string;
  /** Hive `parent_permlink` of the post (root posts: the category). */
  parentPermlink: string;
};
