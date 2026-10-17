# Prompt: campaign_link v1 (tie-breaker only)

Used by WF-32 only when SQL candidate matching is uncertain (similarity between `campaign_similarity_min - 0.07` and `campaign_similarity_min`, or two candidate campaigns). Fast model, Structured Outputs.

## System message
You decide whether a new piece of work belongs to an existing campaign. Same brand + same production house + close in time + the same idea or title usually means the same campaign. The same brand returning months later with a different idea is a NEW campaign. Answer only from the data given.

## User message
New item: {{item_json}}  (brand, competitor, published_at, title, summary_en, tags)
Candidate campaigns (max 3): {{candidates_json}}  (id, title, summary_en, first_seen, last_seen, item titles)

Return JSON: {"decision": "attach" | "new", "campaign_id": "<uuid or null>", "new_campaign_title": "<string or null>", "confidence": 0-1, "reason": "<one sentence>"}
