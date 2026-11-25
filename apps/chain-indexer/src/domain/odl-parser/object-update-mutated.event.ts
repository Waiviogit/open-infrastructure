/**
 * Emitted after an object update is created or a validity vote on it changes (cast, changed or
 * removed), so the winner of `updateType` on `objectId` may have changed.
 */
export const OBJECT_UPDATE_MUTATED_EVENT = 'odl.object_update.mutated';

export class ObjectUpdateMutatedEvent {
  constructor(
    public readonly objectId: string,
    public readonly updateType: string,
  ) {}
}
