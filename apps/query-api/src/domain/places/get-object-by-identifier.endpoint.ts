import { Injectable } from '@nestjs/common';

import { ObjectIdentifiersRepository } from '../../repositories/object-identifiers.repository';

export type ObjectByIdentifierDto = { object_id: string };

/** Exact `identifier {type, value}` → object lookup (e.g. dedup before creating from a Google place). */
@Injectable()
export class GetObjectByIdentifierEndpoint {
  constructor(private readonly identifiers: ObjectIdentifiersRepository) {}

  async execute(input: { type: string; value: string }): Promise<ObjectByIdentifierDto | null> {
    const found = await this.identifiers.findObjectIdsByIdentifier(input.type, [input.value]);
    const objectId = found.get(input.value);
    return objectId ? { object_id: objectId } : null;
  }
}
