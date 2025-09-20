import { supabase } from '../../../backend/api/supabaseClient';

/**
 * @module TournamentService
 * @description Service layer for tournament-related business logic.
 * Handles tournament creation, rating updates, and result processing.
 */

export class TournamentService {
  /**
   * * Creates a new tournament with the given names
   * @param {Array} names - Array of name objects with id, name, description
   * @param {Object} existingRatings - Current ratings for names
   * @returns {Array} Processed tournament names with ratings
   */
  static createTournament(names, existingRatings = {}) {
    return names.map((n) => ({
      id: n.id,
      name: n.name,
      description: n.description,
      rating: existingRatings[n.name]?.rating || 1500
    }));
  }

  /**
   * * Processes tournament completion and updates ratings
   * @param {Object} finalRatings - Final ratings after tournament
   * @param {Array} voteHistory - History of all votes
   * @param {string} userName - Current user name
   * @param {Object} existingRatings - Current ratings from database
   * @returns {Promise<Object>} Updated ratings object
   */
  static async processTournamentCompletion(
    finalRatings,
    voteHistory,
    userName,
    existingRatings = {}
  ) {
    try {
      // * Convert finalRatings to array if it's an object
      const ratingsArray = Array.isArray(finalRatings)
        ? finalRatings
        : Object.entries(finalRatings).map(([name, rating]) => ({
            name,
            rating
          }));

      // Build a quick lookup map for final ratings to avoid repeated .find calls
      const ratingMap = new Map(ratingsArray.map((r) => [r.name, r.rating]));

      // * Initialize tournament results for all names
      const tournamentResults = {};
      ratingsArray.forEach((rating) => {
        tournamentResults[rating.name] = { wins: 0, losses: 0 };
      });

      // * Process vote history to count wins and losses
      voteHistory.forEach((vote) => {
        const { match, result } = vote;
        const { left, right } = match;

        // * Initialize if not exists (safety check)
        if (!tournamentResults[left.name]) {
          tournamentResults[left.name] = { wins: 0, losses: 0 };
        }
        if (!tournamentResults[right.name]) {
          tournamentResults[right.name] = { wins: 0, losses: 0 };
        }

        // * Update based on numeric result
        if (result < -0.1) {
          // * left won (using threshold to account for floating point)
          tournamentResults[left.name].wins++;
          tournamentResults[right.name].losses++;
        } else if (result > 0.1) {
          // * right won
          tournamentResults[right.name].wins++;
          tournamentResults[left.name].losses++;
        }
        // * For values near 0 (both/none), we don't update wins/losses
      });

      if (!supabase) {
        const updatedRatings = { ...existingRatings };
        Object.entries(tournamentResults).forEach(([name, results]) => {
          const finalRating = ratingMap.get(name) ?? 1500;
          const existing = updatedRatings[name] || { wins: 0, losses: 0 };
          updatedRatings[name] = {
            rating: Math.round(finalRating),
            wins: (existing.wins || 0) + results.wins,
            losses: (existing.losses || 0) + results.losses
          };
        });
        return updatedRatings;
      }

      // * Get name_ids from cat_name_options table
      const { data: nameOptions, error: nameError } = await supabase
        .from('cat_name_options')
        .select('id, name')
        .in('name', Object.keys(tournamentResults));

      if (nameError) {
        throw new Error(`Failed to fetch names: ${nameError.message}`);
      }

      // * Create a map of name to name_id
      const nameToIdMap = nameOptions.reduce((acc, { id, name }) => {
        acc[name] = id;
        return acc;
      }, {});

      // * Prepare records for database update
      const recordsToUpsert = Object.entries(tournamentResults)
        .map(([name, results]) => {
          const name_id = nameToIdMap[name];
          if (!name_id) {
            console.warn(`No name_id found for ${name}`);
            return null;
          }

          // * Get the final rating for this name
          const finalRating = ratingMap.get(name) ?? 1500;

          // * Get existing rating data
          const existingRating = existingRatings[name] || {
            wins: 0,
            losses: 0
          };

          return {
            user_name: userName,
            name_id,
            rating: Math.round(finalRating),
            // * Add new wins/losses to existing totals
            wins: (existingRating.wins || 0) + results.wins,
            losses: (existingRating.losses || 0) + results.losses,
            updated_at: new Date().toISOString()
          };
        })
        .filter(Boolean);

      await TournamentService.upsertRatingRecords(recordsToUpsert);

      // * Return updated ratings for local state
      const updatedRatings = { ...existingRatings };
      const idToNameMap = new Map(
        nameOptions.map(({ id, name }) => [id, name])
      );
      recordsToUpsert.forEach((record) => {
        const name = idToNameMap.get(record.name_id);
        if (name) {
          updatedRatings[name] = {
            rating: record.rating,
            wins: record.wins,
            losses: record.losses
          };
        }
      });

      return updatedRatings;
    } catch (error) {
      console.error('Error in tournament completion:', error);
      throw error;
    }
  }

  /**
   * * Updates ratings for names
   * @param {Array} adjustedRatings - Array of rating objects
   * @param {string} userName - Current user name
   * @returns {Promise<Object>} Updated ratings object
   */
  static async updateRatings(adjustedRatings, userName) {
    try {
      if (!supabase) {
        return adjustedRatings.reduce(
          (acc, { name, rating, wins = 0, losses = 0 }) => {
            acc[name] = {
              rating: Math.round(rating),
              wins,
              losses
            };
            return acc;
          },
          {}
        );
      }

      // * Convert array format to consistent object format
      const updatedRatings = adjustedRatings.reduce(
        (acc, { name, rating, wins = 0, losses = 0 }) => {
          acc[name] = {
            rating: Math.round(rating),
            wins: wins,
            losses: losses
          };
          return acc;
        },
        {}
      );

      // * Get name_ids in a single query
      const { data: nameOptions, error: nameError } = await supabase
        .from('cat_name_options')
        .select('id, name')
        .in('name', Object.keys(updatedRatings));

      if (nameError) {
        throw nameError;
      }

      // * Create records for database update
      const recordsToUpsert = nameOptions.map(({ id, name }) => ({
        user_name: userName,
        name_id: id,
        rating: updatedRatings[name].rating,
        wins: updatedRatings[name].wins,
        losses: updatedRatings[name].losses,
        updated_at: new Date().toISOString()
      }));

      await TournamentService.upsertRatingRecords(recordsToUpsert);

      return updatedRatings;
    } catch (error) {
      console.error('Error updating ratings:', error);
      throw error;
    }
  }

  /**
   * * Helper to upsert rating records into the database
   * @param {Array} recordsToUpsert - Records ready for database upsert
   * @throws {Error} If no records provided or database operation fails
   */
  static async upsertRatingRecords(recordsToUpsert) {
    if (recordsToUpsert.length === 0) {
      throw new Error('No valid records to update');
    }

    const { error: upsertError } = await supabase
      .from('cat_name_ratings')
      .upsert(recordsToUpsert, {
        onConflict: 'user_name,name_id',
        returning: 'minimal'
      });

    if (upsertError) {
      throw new Error(`Failed to update ratings: ${upsertError.message}`);
    }
  }

  /**
   * * Fetches all names and their ratings to generate the cat's name
   * @returns {Promise<string>} The cat's name made from all names ranked by rating
   */
  static async generateCatName() {
    try {
      // If Supabase is not available, return a default name with Woods
      if (!supabase) {
        return 'Mystery Cat Woods';
      }

      // First get all names from cat_name_options
      const { data: allNames, error: namesError } = await supabase
        .from('cat_name_options')
        .select('id, name')
        .order('name');

      if (namesError) {
        throw namesError;
      }

      if (!allNames || allNames.length === 0) {
        return 'Mystery Cat';
      }

      // Get hidden name IDs
      const { data: hiddenData, error: hiddenError } = await supabase
        .from('cat_name_ratings')
        .select('name_id')
        .eq('is_hidden', true);

      if (hiddenError) {
        throw hiddenError;
      }

      const hiddenIds = new Set(hiddenData?.map((item) => item.name_id) || []);

      // Filter out hidden names
      const visibleNames = allNames.filter((name) => !hiddenIds.has(name.id));

      if (visibleNames.length === 0) {
        return 'Mystery Cat';
      }

      // Get ratings for visible names
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('cat_name_ratings')
        .select(
          `
          name_id,
          rating,
          cat_name_options (
            name
          )
        `
        )
        .in(
          'name_id',
          visibleNames.map((n) => n.id)
        )
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('rating', { ascending: false });

      if (ratingsError) {
        throw ratingsError;
      }

      // If no ratings data, use all visible names
      if (!ratingsData || ratingsData.length === 0) {
        const fallbackName = visibleNames.map((n) => n.name).join(' ');
        return fallbackName ? `${fallbackName} Woods` : 'Mystery Cat Woods';
      }

      // Sort by rating (highest to lowest) and extract names
      const sortedNames = ratingsData
        .map((item) => item.cat_name_options?.name)
        .filter((name) => name) // Remove any null/undefined names
        .join(' ');

      // Append "Woods" as the last name
      const finalName =
        sortedNames || visibleNames.map((n) => n.name).join(' ');
      return finalName ? `${finalName} Woods` : 'Mystery Cat Woods';
    } catch (error) {
      console.error('Error generating cat name:', error);
      return 'Mystery Cat Woods';
    }
  }

  /**
   * * Fetches individual name statistics for the generated cat name
   * @returns {Promise<Array>} Array of name objects with their stats
   */
  static async getCatNameStats() {
    try {
      // First get all names from cat_name_options
      const { data: allNames, error: namesError } = await supabase
        .from('cat_name_options')
        .select('id, name, description, categories')
        .order('name');

      if (namesError) {
        throw namesError;
      }

      if (!allNames || allNames.length === 0) {
        return [];
      }

      // Get hidden name IDs
      const { data: hiddenData, error: hiddenError } = await supabase
        .from('cat_name_ratings')
        .select('name_id')
        .eq('is_hidden', true);

      if (hiddenError) {
        throw hiddenError;
      }

      const hiddenIds = new Set(hiddenData?.map((item) => item.name_id) || []);

      // Filter out hidden names
      const visibleNames = allNames.filter((name) => !hiddenIds.has(name.id));

      if (visibleNames.length === 0) {
        return [];
      }

      // Get ratings for visible names
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('cat_name_ratings')
        .select(
          `
          name_id,
          rating,
          wins,
          losses,
          cat_name_options (
            name,
            description,
            categories
          )
        `
        )
        .in(
          'name_id',
          visibleNames.map((n) => n.id)
        )
        .or('is_hidden.is.null,is_hidden.eq.false')
        .order('rating', { ascending: false });

      if (ratingsError) {
        throw ratingsError;
      }

      // Create a map of ratings data for quick lookup
      const ratingsMap = new Map();
      if (ratingsData && ratingsData.length > 0) {
        ratingsData.forEach((item) => {
          ratingsMap.set(item.name_id, item);
        });
      }

      // Process and return the data with stats
      return visibleNames.map((name, index) => {
        const ratingData = ratingsMap.get(name.id);

        if (ratingData) {
          const totalMatches =
            (ratingData.wins || 0) + (ratingData.losses || 0);
          const winRate =
            totalMatches > 0
              ? Math.round(((ratingData.wins || 0) / totalMatches) * 100)
              : 0;

          return {
            id: name.id,
            name: name.name,
            description: name.description,
            categories: name.categories || [],
            rating: ratingData.rating || 1500,
            wins: ratingData.wins || 0,
            losses: ratingData.losses || 0,
            totalMatches,
            winRate,
            rank: index + 1
          };
        } else {
          // For names without ratings, use default values
          return {
            id: name.id,
            name: name.name,
            description: name.description,
            categories: name.categories || [],
            rating: 1500,
            wins: 0,
            losses: 0,
            totalMatches: 0,
            winRate: 0,
            rank: index + 1
          };
        }
      });
    } catch (error) {
      console.error('Error fetching cat name stats:', error);
      return [];
    }
  }

  /**
   * * Calculates tournament statistics
   * @param {Array} ratings - Array of rating objects
   * @returns {Object} Tournament statistics
   */
  static calculateTournamentStats(ratings) {
    if (!ratings?.length) {
      return {
        total: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        avgRating: 0,
        ratingSpread: 0,
        totalMatches: 0
      };
    }

    const total = ratings.length;
    const wins = ratings.reduce((sum, r) => sum + (r.wins || 0), 0);
    const losses = ratings.reduce((sum, r) => sum + (r.losses || 0), 0);
    const winRate = total > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

    // * Enhanced rating statistics
    const ratingsWithValues = ratings.filter((r) => r.rating !== null);
    const avgRating =
      ratingsWithValues.length > 0
        ? Math.round(
            ratingsWithValues.reduce((sum, r) => sum + (r.rating || 0), 0) /
              ratingsWithValues.length
          )
        : 0;

    const ratingSpread =
      ratingsWithValues.length > 0
        ? Math.max(...ratingsWithValues.map((r) => r.rating || 0)) -
          Math.min(...ratingsWithValues.map((r) => r.rating || 0))
        : 0;

    const totalMatches = wins + losses;

    return {
      total,
      wins,
      losses,
      winRate,
      avgRating,
      ratingSpread,
      totalMatches
    };
  }
}

export default TournamentService;
