/**
 * @module supabaseClient
 * @description Configures and exports the Supabase client instance.
 * Sets up the connection to Supabase with proper authentication and headers.
 * 
 * @example
 * // Import and use the client
 * import { supabase } from './supabaseClient';
 * 
 * // Make a query
 * const { data, error } = await supabase
 *   .from('table_name')
 *   .select('*');
 * 
 * @requires REACT_APP_SUPABASE_URL - Environment variable for Supabase project URL
 * @requires REACT_APP_SUPABASE_ANON_KEY - Environment variable for Supabase anonymous key
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

// Configure the Supabase client with additional options
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Create a single channel instance for status monitoring
const statusChannel = supabase.channel('status');

// Set up status monitoring without resubscription attempts
statusChannel
  .on('system', { event: '*' }, (payload) => {
    if (payload.event === 'disconnected') {
      console.log('Disconnected from Supabase realtime');
    } else if (payload.event === 'connected') {
      console.log('Connected to Supabase realtime');
    } else if (payload.event === 'error') {
      console.warn('Supabase realtime error:', payload.error);
    }
  })
  .subscribe();

// Export helper function to check connection status
export const isRealtimeConnected = () => {
  return statusChannel.state === 'joined';
};

// Add this function to get names with descriptions
export const getNamesWithDescriptions = async () => {
  try {
    // First get hidden name IDs
    const { data: hiddenData, error: hiddenError } = await supabase
      .from('hidden_names')
      .select('name_id');
    
    if (hiddenError) {
      console.error('Error fetching hidden names:', hiddenError);
      throw hiddenError;
    }

    const hiddenIds = hiddenData?.map(item => item.name_id) || [];

    // Build query with updated_at field
    let query = supabase
      .from('name_options')
      .select(`
        id,
        name,
        description,
        cat_name_ratings (
          rating,
          wins,
          losses,
          updated_at
        )
      `);
    
    // Only apply the not.in filter if we have hidden IDs
    if (hiddenIds.length > 0) {
      query = query.not('id', 'in', `(${hiddenIds.join(',')})`);
    }

    // Execute query with ordering
    const { data, error } = await query.order('name');

    if (error) throw error;
    
    // Process the data to include the latest updated_at
    const processedData = data.map(item => ({
      ...item,
      updated_at: item.cat_name_ratings?.[0]?.updated_at || null
    }));
    
    return processedData || [];
  } catch (error) {
    console.error('Error fetching names:', error);
    throw error;
  }
};

// Add this function to track rating history
export const addRatingHistory = async (userName, nameId, oldRating, newRating) => {
  try {
    const { error } = await supabase
      .from('rating_history')
      .insert({
        user_name: userName,
        name_id: nameId,
        old_rating: oldRating,
        new_rating: newRating,
        timestamp: new Date().toISOString()
      });
      
    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error saving rating history:', error);
    throw error;
  }
};

// Add this function to update ratings with proper timestamps
export const updateRating = async (userName, nameId, newRating, wins = null, losses = null) => {
  const now = new Date().toISOString();
  
  try {
    // First get existing rating data
    const { data: existingData, error: fetchError } = await supabase
      .from('cat_name_ratings')
      .select('wins, losses')
      .eq('user_name', userName)
      .eq('name_id', nameId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching existing rating:', fetchError);
      return { error: fetchError };
    }

    // Use provided wins/losses or keep existing ones
    const finalWins = wins !== null ? wins : (existingData?.wins || 0);
    const finalLosses = losses !== null ? losses : (existingData?.losses || 0);

    const { error } = await supabase
      .from('cat_name_ratings')
      .upsert({
        user_name: userName,
        name_id: nameId,
        rating: newRating,
        wins: finalWins,
        losses: finalLosses,
        updated_at: now
      }, {
        onConflict: 'user_name,name_id'
      });

    if (error) throw error;
    
    // Also update the rating history
    await addRatingHistory(userName, nameId, null, newRating);
    
    return { error: null };
  } catch (error) {
    console.error('Error updating rating:', error);
    return { error };
  }
};

// Add this function to delete a name (only if it's hidden)
export const deleteName = async (nameId) => {
  try {
    // First check if the name exists in name_options
    const { data: nameData, error: nameError } = await supabase
      .from('name_options')
      .select('name')
      .eq('id', nameId)
      .single();
    
    if (nameError?.code === 'PGRST116') {
      // This error code means no rows were returned
      throw new Error('Name has already been deleted');
    } else if (nameError) {
      console.error('Error checking name existence:', nameError);
      throw nameError;
    }
    
    if (!nameData) {
      throw new Error('Name does not exist in database');
    }

    // Check if name is hidden
    const { data: hiddenData, error: hiddenError } = await supabase
      .from('hidden_names')
      .select('*')
      .eq('name_id', nameId);
    
    if (hiddenError) {
      console.error('Error checking hidden status:', hiddenError);
      throw hiddenError;
    }
    
    if (!hiddenData || hiddenData.length === 0) {
      throw new Error('Cannot delete name that is not hidden');
    }

    // Use a transaction to ensure all deletes happen or none happen
    const { error: error1 } = await supabase.rpc('delete_name_cascade', { target_name_id: nameId });
    
    if (error1) {
      console.error('Error in delete transaction:', error1);
      throw error1;
    }

    return { error: null, success: true };
  } catch (error) {
    console.error('Error in deleteName function:', error);
    return { error, success: false };
  }
};