/**
 * React Speech Recognition Client
 * Streamlined speech recognition using the react-speech-recognition package
 */

// Language mappings for speech recognition
export const languageMap = {
  'hindi': 'hi-IN',
  'english': 'en-US', 
  'punjabi': 'pa-IN',
  'en': 'en-US',
  'hi': 'hi-IN',
  'pa': 'pa-IN'
};

/**
 * Get mapped language code
 */
export const getMappedLanguage = (language) => {
  const lang = language?.toLowerCase();
  return languageMap[lang] || 'en-US';
};

// This file is now just for utility functions
// All speech recognition logic is handled by react-speech-recognition hook
