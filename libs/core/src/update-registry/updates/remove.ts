import type { UpdateDefinition } from '../types';
import { postRefSchema } from '../schemas/string-schemas';
import { UPDATE_TYPES } from '../update-types';

export const UPDATE_REMOVE: UpdateDefinition = {
  update_type: UPDATE_TYPES.REMOVE,
  namespace: 'odl',
  localizable: false,
  description: "Post hidden from the object's Posts feed (`author/permlink`).",
  value_kind: 'text',
  cardinality: 'multi',
  schema: postRefSchema,
};
