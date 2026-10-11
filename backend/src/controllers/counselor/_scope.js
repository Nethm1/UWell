/**
 * Shared helpers for scoping the counselor module to the authenticated user.
 *
 * Every counselor-module document carries a `counselorId`. Historically these
 * all defaulted to the seeded demo id `c1`, so every logged-in counselor saw
 * the same dataset. We now resolve documents for the authenticated counselor
 * and fall back to the seeded set only when that counselor has no data yet,
 * so screens are populated on a fresh account instead of rendering empty.
 */
const SEED_COUNSELOR_ID = 'c1';

const counselorKey = (req) => String((req && req.user && req.user.id) || '') || SEED_COUNSELOR_ID;

const applySort = (query, sort) => (sort ? query.sort(sort) : query);

async function findScoped(Model, key, filter = {}, sort = null) {
  let docs = await applySort(Model.find({ ...filter, counselorId: key }), sort);
  if (docs.length === 0 && key !== SEED_COUNSELOR_ID) {
    docs = await applySort(Model.find({ ...filter, counselorId: SEED_COUNSELOR_ID }), sort);
  }
  return docs;
}

async function findOneScoped(Model, key, filter = {}) {
  let doc = await Model.findOne({ ...filter, counselorId: key });
  if (!doc && key !== SEED_COUNSELOR_ID) {
    doc = await Model.findOne({ ...filter, counselorId: SEED_COUNSELOR_ID });
  }
  return doc;
}

module.exports = { SEED_COUNSELOR_ID, counselorKey, findScoped, findOneScoped };
