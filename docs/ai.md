# AI — Provider Architecture, Chat, Search, Recommendations

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index).

Everything AI lives under **`lib/ai/*`** with clean seams so the provider can be swapped
and RAG added later without touching callers.

## Provider & settings

- **Provider seam** (`lib/ai/provider.ts`): a small adapter registry keyed by
  `AIProviderId` (today only `"groq"`). `getModel(modelId)` returns a `LanguageModel` or
  `null`; `aiAvailable()` reports configuration. Adding OpenAI/Anthropic/Gemini = register
  one adapter. The low-level Groq client stays in `lib/groq.ts`.
- **Settings** (`lib/ai/settings.ts`): `getAISettings()` folds the single-row **`AISetting`**
  table over env defaults (model, temperature, maxTokens, system prompt, feature flags).
  `recordAIUsage(tokens)` meters usage. **The API key is never in the DB** — only in
  `GROQ_API_KEY`; model from `GROQ_MODEL` (default `llama-3.3-70b-versatile`). Never
  hardcode the model.
- **Retrieval seam (RAG-ready)** (`lib/ai/retrieval.ts`): `retrieveProductContext()`
  returns `ContextChunk[]` from keyword catalog lookup today. Swap the body for vector
  search later — callers are unchanged.
- **Prompts** (`lib/ai/prompts.ts`): persona + system-prompt builders; honors the
  admin-configured system prompt override.

## Chat

- **Orchestration** (`lib/ai/chat.ts`): `runAssistantStream()` resolves settings/flags,
  grounds with context, returns a `streamText` result, exposes `onFinish(text, tokens)`
  (used by the route for metering + history).
- The HTTP route (`app/api/ai/chat/route.ts`) returns `toTextStreamResponse()` — chat
  streams as **plain text** consumed via `fetch`/`ReadableStream` in
  `components/storefront/ai-chat.tsx`, NOT the `useChat`/UIMessage protocol (robust across
  AI SDK versions). Friendly fallbacks/limits carry an `X-AI-Fallback: 1` header so the
  client renders the message inline instead of erroring.
- Rate-limited via Upstash (fail-open). **Graceful degrade:** with no key (or AI disabled)
  the route returns a friendly plain-text message; pages render; search falls back.
- **Persistence:** conversations for logged-in users in `AIChat`/`AIMessage`
  (`/account/ai-history` + transcript). Admin controls + usage at `/admin/ai-settings`.

## Structured output warning

**Groq `llama-3.3-70b-versatile` does NOT support the `json_schema` response format**, so
AI SDK `generateObject` fails on it. Use **`generateText` + defensive JSON parse** for
structured output (see `lib/ai/search.ts`, `lib/marketing/ai.ts`). Don't reintroduce
`generateObject` without checking model support.

## Search

- `lib/ai/search.ts#aiProductSearch()` extracts structured filters with generateText +
  JSON parse, then a progressive query (category/price → phrase → tokens → price-only).
  Falls back to keyword search when AI is off/unavailable.
- **Smart search is keyless:** `lib/recommendations/intent.ts#expandSearchTerms` maps
  goals ("weight loss" → flax/chia/makhana…) and `smartKeywordSearch` (in
  `lib/ai/search.ts`) unions literal + intent matches — the fallback at every level.

## Recommendation engine (`lib/recommendations/`)

- Centralized service — the single source of truth for every reco section. `service.ts`:
  `recommendedForYou`, `similarProducts`, `frequentlyBoughtTogether`,
  `customersAlsoBought`, `trending`, `bestSellers`, `complementaryForCart`,
  `productCombos`. All **rule-based + DB-driven** (work with no AI key), isolated so a
  future provider (embeddings / vector search / LLM re-rank) slots in without touching
  callers. `lib/ai/recommendations.ts#getRecommendations` is a thin back-compat wrapper.
- **Behavior tracking feeds it:** the additive `UserEvent` log
  (`lib/recommendations/events.ts#trackEvent` + `getUserSignals`) — privacy-preserving
  (session userId or anon `nut_anon` cookie; no PII). Client signals go through
  `POST /api/track` (rate-limited) via `components/storefront/behavior-tracker.tsx`;
  WISHLIST_ADD and PURCHASE are recorded server-side from their authoritative actions.
- Reco strips reuse `components/storefront/reco-section.tsx` (`RecoSection`, optional
  `source` → RECO_CLICK analytics via `reco-click-area.tsx`). Sections render nothing when
  empty (cold-start safe). Recently-viewed is a localStorage client component.

## Admin AI Insights

`/admin/insights` (`ai` permission, `lib/queries/insights.ts`): most viewed/purchased/
cart-added, top searches, FBT pairs, reco click-rate, repeat-purchase rate from real
`UserEvent` + order data. The page also hosts the advanced analytics sections — see
`docs/analytics.md`.
