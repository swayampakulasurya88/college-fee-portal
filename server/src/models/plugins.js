// Shared mongoose schema helpers.
export function jsonPlugin(schema) {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret) {
      ret.id = ret._id?.toString?.() ?? ret._id;
      delete ret._id;
      return ret;
    },
  });
}
