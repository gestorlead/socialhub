import { supabase } from './supabase';
import { setUserLocaleClient } from './locale-client';
import { type SupportedLocale } from './locale-shared';

// Update user language preference in database and client
export async function updateUserLanguagePreference(
  userId: string, 
  language: SupportedLocale
): Promise<{ error: Error | null }> {
  try {
    // Update in database
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: language })
      .eq('id', userId);
    
    if (error) {
      console.error('Failed to update language preference:', error);
      return { error };
    }
    
    // Update client-side cookie
    setUserLocaleClient(language);
    
    return { error: null };
  } catch (error) {
    console.error('Error updating language preference:', error);
    return { error: error as Error };
  }
}

// Get user language preference from database
export async function getUserLanguagePreference(userId: string): Promise<SupportedLocale | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.warn('Failed to get language preference:', error);
      return null;
    }
    
    return data?.preferred_language || null;
  } catch (error) {
    console.warn('Error getting language preference:', error);
    return null;
  }
}

// Get user preferences (extensible for future preferences)
export interface UserPreferences {
  language: SupportedLocale | null;
  // Future preferences can be added here
  // theme?: 'light' | 'dark' | 'system';
  // timezone?: string;
  // notifications?: boolean;
}

export async function getUserPreferences(userId: string): Promise<UserPreferences> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferred_language')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.warn('Failed to get user preferences:', error);
      return { language: null };
    }
    
    return {
      language: data?.preferred_language || null
    };
  } catch (error) {
    console.warn('Error getting user preferences:', error);
    return { language: null };
  }
}

// Update multiple user preferences at once
export async function updateUserPreferences(
  userId: string, 
  preferences: Partial<UserPreferences>
): Promise<{ error: Error | null }> {
  try {
    const updates: Record<string, any> = {};
    
    if (preferences.language) {
      updates.preferred_language = preferences.language;
    }
    
    if (Object.keys(updates).length === 0) {
      return { error: null };
    }
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    
    if (error) {
      console.error('Failed to update user preferences:', error);
      return { error };
    }
    
    // Update client-side if language changed
    if (preferences.language) {
      setUserLocaleClient(preferences.language);
    }
    
    return { error: null };
  } catch (error) {
    console.error('Error updating user preferences:', error);
    return { error: error as Error };
  }
}