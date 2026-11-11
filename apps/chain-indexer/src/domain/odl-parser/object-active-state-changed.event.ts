/**
 * Emitted by `ObjectStatusHandler` after `objects_core.status` crosses the active boundary
 * (`active` ↔ any inactive status). Derived read models that count only active objects listen.
 */
export const OBJECT_ACTIVE_STATE_CHANGED_EVENT = 'odl.object.active_state_changed';

export class ObjectActiveStateChangedEvent {
  constructor(
    public readonly objectId: string,
    public readonly objectType: string,
    public readonly isActive: boolean,
  ) {}
}
