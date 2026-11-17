import type { UpdateDefinition } from '../types';
import { postRefSchema } from '../schemas/string-schemas';
import { UPDATE_TYPES } from '../update-types';

export const UPDATE_PIN: UpdateDefinition = {
  update_type: UPDATE_TYPES.PIN,
  namespace: 'odl',
  localizable: false,
  description: "Pinned post on the object's Posts feed (`author/permlink`).",
  value_kind: 'text',
  cardinality: 'multi',
  schema: postRefSchema,
};
