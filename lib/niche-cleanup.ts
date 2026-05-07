// =============================================================================
// NICHE CLEANUP MICROSERVICE — find & merge duplicate niches
// =============================================================================
// PLAIN: After lots of "Discover top 10 niches" clicks, the catalog gets
//        cluttered with near-duplicates ("korean skincare" + "k-beauty").
//        This service:
//          1. Asks AI to spot clusters of similar niches.
//          2. Merges a cluster — products + suggestions move to a primary
//             niche, the duplicates are deleted.
//
// TECH:  Pure-ish module — Supabase + Groq, no HTTP. Keeps the merge in
//        one transaction-like flow so we don't leave orphaned data.
// =============================================================================

import { supabase } from '@/lib/supabase';
import { generateJson, SchemaType } from '@/lib/groq';
import type { TrendingNiche } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

// PLAIN: One cluster of similar niches. The primary is the one we keep.
// TECH:  Returned by findDuplicateClusters; consumed by the UI.
export interface DuplicateCluster {
  primary_id: string;
  primary_name: string;
  similar_ids: string[];
  similar_names: string[];
  reason: string;
}

// PLAIN: AI's raw response — string IDs/names.
interface AiCluster {
  primary_id: string;
  similar_ids: string[];
  reason: string;
}

interface AiClustersResponse {
  clusters: AiCluster[];
}

const CLUSTERS_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    clusters: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          primary_id: {
            type: SchemaType.STRING,
            description:
              'UUID of the niche to KEEP (best/most general one of the cluster)',
          },
          similar_ids: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              'UUIDs of duplicate/near-duplicate niches that should be merged INTO primary',
          },
          reason: {
            type: SchemaType.STRING,
            description:
              'One sentence explaining why these niches are essentially the same',
          },
        },
        required: ['primary_id', 'similar_ids', 'reason'],
      },
    },
  },
  required: ['clusters'],
} as const;

// =============================================================================
// PUBLIC API
// =============================================================================

/**
 * PLAIN: Asks the AI to scan all your niches and find clusters of
 *        duplicates / near-duplicates. Returns groups the user can review
 *        before merging.
 *
 * TECH:  Single Groq call. Validates that all returned IDs actually
 *        exist (defends against hallucinated UUIDs).
 */
export async function findDuplicateClusters(): Promise<DuplicateCluster[]> {
  // PLAIN: Pull all active niches.
  // TECH:  Lightweight SELECT — only fields the AI needs for matching.
  const { data: niches, error } = await supabase
    .from('trending_niches')
    .select('id, name, description, keywords')
    .eq('is_active', true);

  if (error) {
    throw new Error(`[cleanup] niche fetch failed: ${error.message}`);
  }

  if (!niches || niches.length < 2) {
    return [];
  }

  // PLAIN: Build the niche list for the AI.
  // TECH:  Compact format the LLM can scan.
  const nicheList = niches
    .map(
      (n) =>
        `- ${n.id} | "${n.name}"\n  desc: ${n.description ?? '(none)'}\n  kw: ${n.keywords ?? '(none)'}`
    )
    .join('\n');

  const prompt = `
You're cleaning up a Pinterest affiliate marketer's niche catalog.

NICHES (${niches.length} total):
${nicheList}

Find clusters where 2 or more niches are duplicates or near-duplicates
(same audience, same products, just different names). Examples:
- "korean skincare" + "k-beauty" → same thing
- "indoor plants" + "houseplants" + "plant care" → same thing
- "vastu home decor" + "spiritual home decor" → arguably the same

For each cluster:
- primary_id: pick the BEST (most general/clear) niche to KEEP
- similar_ids: list the OTHER ones in the cluster (these get merged INTO primary)
- reason: one sentence

Skip niches that have no duplicate. Return only ACTUAL clusters of 2+.
If no duplicates exist, return clusters: [].

Return JSON: { clusters: [...] }
  `.trim();

  const ai = await generateJson<AiClustersResponse>(prompt, CLUSTERS_SCHEMA);

  // PLAIN: Validate the AI's IDs actually exist (don't trust hallucinations).
  // TECH:  Build a lookup, filter clusters, attach human-readable names.
  const idToName = new Map(niches.map((n) => [n.id, n.name]));

  const validClusters: DuplicateCluster[] = [];
  for (const cluster of ai.clusters ?? []) {
    if (!idToName.has(cluster.primary_id)) continue;
    const validSimilar = (cluster.similar_ids ?? []).filter(
      (id) => idToName.has(id) && id !== cluster.primary_id
    );
    if (validSimilar.length === 0) continue;

    validClusters.push({
      primary_id: cluster.primary_id,
      primary_name: idToName.get(cluster.primary_id)!,
      similar_ids: validSimilar,
      similar_names: validSimilar.map((id) => idToName.get(id)!),
      reason: cluster.reason,
    });
  }

  return validClusters;
}

/**
 * PLAIN: Merges duplicate niches into a primary one:
 *          1. All products under the duplicates get reassigned to primary
 *          2. All suggestions under the duplicates get reassigned to primary
 *          3. The duplicate niches are deleted
 *
 * TECH:  No transactions in Supabase JS — best-effort sequential. If a
 *        step fails, partial merge is possible (acceptable for cleanup).
 *        Cascade-delete on niche FKs handles edge cases.
 */
export async function mergeNiches(
  primaryId: string,
  duplicateIds: string[]
): Promise<{
  productsMoved: number;
  suggestionsMoved: number;
  nichesDeleted: number;
}> {
  if (duplicateIds.length === 0) {
    return { productsMoved: 0, suggestionsMoved: 0, nichesDeleted: 0 };
  }

  // PLAIN: Refuse to merge a niche into itself.
  // TECH:  Defensive check; UI shouldn't allow this but be safe.
  const safeDupes = duplicateIds.filter((id) => id !== primaryId);
  if (safeDupes.length === 0) {
    return { productsMoved: 0, suggestionsMoved: 0, nichesDeleted: 0 };
  }

  // PLAIN: 1. Reassign products from duplicates to primary.
  // TECH:  UPDATE product_library SET niche_id = primaryId WHERE niche_id IN (...).
  const { count: productsMoved } = await supabase
    .from('product_library')
    .update({ niche_id: primaryId }, { count: 'exact' })
    .in('niche_id', safeDupes);

  // PLAIN: 2. Reassign suggestions from duplicates to primary.
  // TECH:  Same pattern; suggestions table has FK on niche_id.
  const { count: suggestionsMoved } = await supabase
    .from('niche_product_suggestions')
    .update({ niche_id: primaryId }, { count: 'exact' })
    .in('niche_id', safeDupes);

  // PLAIN: 3. Delete the duplicate niches.
  // TECH:  Hard delete; ON DELETE SET NULL means orphaned products would
  //        keep working — but step 1 already reassigned them.
  const { count: nichesDeleted } = await supabase
    .from('trending_niches')
    .delete({ count: 'exact' })
    .in('id', safeDupes);

  return {
    productsMoved: productsMoved ?? 0,
    suggestionsMoved: suggestionsMoved ?? 0,
    nichesDeleted: nichesDeleted ?? 0,
  };
}

/**
 * PLAIN: Bulk-deactivate niches without deleting them. Useful for
 *        archiving low-score niches without losing their data.
 *
 * TECH:  UPDATE is_active = false. Hidden from dashboard but kept in DB.
 */
export async function bulkDeactivateNiches(
  nicheIds: string[]
): Promise<number> {
  if (nicheIds.length === 0) return 0;

  const { count } = await supabase
    .from('trending_niches')
    .update({ is_active: false }, { count: 'exact' })
    .in('id', nicheIds);

  return count ?? 0;
}

/**
 * PLAIN: Returns niche stats useful for the cleanup page header
 *        ("you have N total niches, M with no products").
 *
 * TECH:  Two parallel SELECTs.
 */
export async function getNicheStats(): Promise<{
  total: number;
  withProducts: number;
  empty: number;
  lowScore: number;
}> {
  const { count: total } = await supabase
    .from('trending_niches')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  // PLAIN: Get all niches + their product counts (via product_library).
  const { data: niches } = await supabase
    .from('trending_niches')
    .select('id, score')
    .eq('is_active', true);

  const { data: products } = await supabase
    .from('product_library')
    .select('niche_id')
    .eq('is_active', true);

  const productCount = new Map<string, number>();
  for (const p of products ?? []) {
    if (p.niche_id) {
      productCount.set(p.niche_id, (productCount.get(p.niche_id) ?? 0) + 1);
    }
  }

  let withProducts = 0;
  let empty = 0;
  let lowScore = 0;
  for (const n of niches ?? []) {
    const cnt = productCount.get(n.id) ?? 0;
    if (cnt > 0) withProducts++;
    else empty++;
    if ((n.score ?? 0) < 50) lowScore++;
  }

  return {
    total: total ?? 0,
    withProducts,
    empty,
    lowScore,
  };
}

// PLAIN: Re-export the shape so other modules can import it.
export type { TrendingNiche };
