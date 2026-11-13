/** "My feed" was requested without a viewer account. */
export class HubFeedViewerRequiredError extends Error {
  constructor() {
    super('The "my" filter requires the X-Viewer header');
    this.name = HubFeedViewerRequiredError.name;
  }
}
