/** Emitted after a new `objects_core` row is stored by `object_create`. */
export const OBJECT_CREATED_EVENT = 'odl.object.created';

export class ObjectCreatedEvent {
  constructor(
    public readonly objectId: string,
    public readonly objectType: string,
  ) {}
}
