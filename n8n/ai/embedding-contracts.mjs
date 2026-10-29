import { createHash } from 'node:crypto';

// These are implementation contracts, not model-quality or billing receipts.
// Current official contract: https://developers.openai.com/api/reference/resources/embeddings/methods/create
export const embeddingDimensions = 1536;
export const inputContractVersion = 'embedding_input.v1';
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const modelId = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(v);
const uuid = (v) =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const integer = (v) => Number.isSafeInteger(v) && v >= 0;
const hash = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** Conservative byte envelopes are execution controls. For the configured
 * byte-level tokenizer they upper-bound tokens; they are never presented as
 * provider-reported token usage. The actual API usage is recorded at settlement. */
export function validateEmbeddingRequest(request, limits = {}) {
  if (!object(limits)) return false;
  const maxInputs = limits.maxInputs ?? 100;
  const maxInputBytes = limits.maxInputBytes ?? 8192;
  const maxTotalBytes = limits.maxTotalBytes ?? 300000;
  if (
    !Number.isSafeInteger(maxInputs) ||
    maxInputs < 1 ||
    maxInputs > 100 ||
    !Number.isSafeInteger(maxInputBytes) ||
    maxInputBytes < 1 ||
    maxInputBytes > 8192 ||
    !Number.isSafeInteger(maxTotalBytes) ||
    maxTotalBytes < 1 ||
    maxTotalBytes > 300000 ||
    !object(request) ||
    Object.keys(request).sort().join(',') !== 'dimensions,encoding_format,input,model' ||
    !modelId(request.model) ||
    request.dimensions !== embeddingDimensions ||
    request.encoding_format !== 'float' ||
    !Array.isArray(request.input) ||
    request.input.length < 1 ||
    request.input.length > maxInputs
  )
    return false;
  let total = 0;
  for (const text of request.input) {
    if (typeof text !== 'string' || !text.trim() || !text.isWellFormed() || bytes(text) > maxInputBytes)
      return false;
    total += bytes(text);
  }
  return total <= maxTotalBytes;
}

export function validateEmbeddingSnapshot(snapshot) {
  if (
    !object(snapshot) ||
    snapshot.input_contract_version !== inputContractVersion ||
    snapshot.dimensions !== embeddingDimensions ||
    !object(snapshot.settings) ||
    !Number.isSafeInteger(snapshot.settings.max_input_bytes) ||
    !Number.isSafeInteger(snapshot.settings.max_total_bytes) ||
    !['simulated', 'provider'].includes(snapshot.settings.accounting_mode) ||
    !validateEmbeddingRequest(snapshot.provider_request, {
      maxInputBytes: snapshot.settings.max_input_bytes,
      maxTotalBytes: snapshot.settings.max_total_bytes,
    }) ||
    !Array.isArray(snapshot.mapping) ||
    snapshot.mapping.length !== snapshot.provider_request.input.length ||
    embeddingCost({ prompt_tokens: 0, total_tokens: 0 }, snapshot.price, snapshot.provider_request.model) ===
      null
  )
    return false;
  const seenMessages = new Set(),
    seenEntities = new Set();
  for (let index = 0; index < snapshot.mapping.length; index++) {
    const m = snapshot.mapping[index],
      text = snapshot.provider_request.input[index];
    if (
      !object(m) ||
      m.index !== index ||
      !['item', 'competitor', 'organization'].includes(m.entity_type) ||
      !uuid(m.entity_id) ||
      m.text !== text ||
      m.content_hash !== hash(text) ||
      !Array.isArray(m.msg_ids) ||
      m.msg_ids.length < 1 ||
      m.msg_ids.some((id) => !Number.isSafeInteger(id) || id < 1)
    )
      return false;
    const entity = m.entity_type + ':' + m.entity_id;
    if (seenEntities.has(entity)) return false;
    seenEntities.add(entity);
    for (const id of m.msg_ids) {
      if (seenMessages.has(id)) return false;
      seenMessages.add(id);
    }
  }
  return true;
}

export function embeddingUsage(usage) {
  return object(usage) &&
    integer(usage.prompt_tokens) &&
    integer(usage.total_tokens) &&
    usage.prompt_tokens === usage.total_tokens
    ? { prompt_tokens: usage.prompt_tokens, total_tokens: usage.total_tokens }
    : null;
}

/** One aggregate price per provider request. Never assign invented token
 * counts or the whole batch's usage separately to each response vector. */
export function embeddingCost(usage, price, model) {
  const u = embeddingUsage(usage);
  if (
    !u ||
    !modelId(model) ||
    !object(price) ||
    !['1M tokens', '1000000 tokens'].includes(price.unit) ||
    typeof price.usd !== 'number' ||
    !Number.isFinite(price.usd) ||
    price.usd < 0
  )
    return null;
  const value = (u.total_tokens * price.usd) / 1000000;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Response-array order is irrelevant. Index is the admitted mapping key.
 * Invalid vectors may still have known aggregate usage; wrong model identity
 * cannot be priced using the admitted model's price and stays unknown. */
export function parseEmbeddingResponse(raw, snapshot) {
  const responseModel = object(raw) && typeof raw.model === 'string' ? raw.model : null;
  const failure = (error, usage = null) => ({
    ok: false,
    rows: null,
    usage,
    response_model: responseModel,
    error,
  });
  if (!validateEmbeddingSnapshot(snapshot)) return failure('invalid_snapshot');
  if (!object(raw) || raw.object !== 'list' || responseModel !== snapshot.provider_request.model)
    return failure('response_identity_mismatch');
  const usage = embeddingUsage(raw.usage);
  if (!usage) return failure('usage_unknown');
  if (!Array.isArray(raw.data) || raw.data.length !== snapshot.mapping.length)
    return failure('incomplete_vectors', usage);
  const rows = Array(snapshot.mapping.length),
    seen = new Set();
  for (const value of raw.data) {
    if (
      !object(value) ||
      value.object !== 'embedding' ||
      !integer(value.index) ||
      value.index >= rows.length ||
      seen.has(value.index) ||
      !Array.isArray(value.embedding) ||
      value.embedding.length !== embeddingDimensions ||
      value.embedding.some(
        (v) => typeof v !== 'number' || !Number.isFinite(v) || !Number.isFinite(Math.fround(v)),
      ) ||
      !value.embedding.some((v) => Math.fround(v) !== 0)
    )
      return failure('invalid_vectors', usage);
    seen.add(value.index);
    const mapping = snapshot.mapping[value.index];
    rows[value.index] = {
      index: value.index,
      entity_type: mapping.entity_type,
      entity_id: mapping.entity_id,
      content_hash: mapping.content_hash,
      embedding: [...value.embedding],
    };
  }
  if (seen.size !== rows.length) return failure('incomplete_vectors', usage);
  return { ok: true, rows, usage, response_model: responseModel, error: null };
}
