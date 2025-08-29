/**
 * Browser Speech Recognition Client
 * Focus on browser Speech Recognition for Hindi, English, and Punjabi
 */

class BrowserSpeechClient {
  constructor() {
    this.recognition = null;
    this.isRecording = false;
    this.onTranscript = null;
    this.onError = null;
    this.onStatusChange = null;
    this.currentLanguage = 'en-US';
    this.shouldBeRecording = false;
    this.interimResults = [];
    this.finalResults = [];
    
    // Language mappings for browser Speech Recognition
    this.languageMap = {
      'hindi': 'hi-IN',
      'english': 'en-US', 
      'punjabi': 'pa-IN',
      'en': 'en-US',
      'hi': 'hi-IN',
      'pa': 'pa-IN'
    };
  }

  /**
   * Set language for speech recognition
   */
  setLanguage(language) {
    const lang = language.toLowerCase();
    this.currentLanguage = this.languageMap[lang] || 'en-US';
    console.log('🌍 Language set to:', this.currentLanguage);
    
    if (this.recognition) {
      this.recognition.lang = this.currentLanguage;
    }
  }

  /**
   * Initialize browser Speech Recognition
   */
  initializeBrowserSpeechRecognition() {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      throw new Error('Browser speech recognition not supported. Please use Chrome, Edge, or Safari.');
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configure recognition settings for better real-time performance
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
    this.recognition.lang = this.currentLanguage;

    console.log('🎤 Browser Speech Recognition initialized with settings:', {
      language: this.currentLanguage,
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults,
      maxAlternatives: this.recognition.maxAlternatives
    });

    // Handle interim and final results
    this.recognition.onresult = (event) => {
      console.log('📝 Speech recognition result event received');
      console.log('Event details:', {
        resultIndex: event.resultIndex,
        resultsLength: event.results.length,
        totalResults: event.results.length,
        results: Array.from(event.results).map((result, i) => ({
          index: i,
          isFinal: result.isFinal,
          transcript: result[0].transcript,
          confidence: result[0].confidence
        }))
      });
      
      // Collect all interim results (non-final)
      let allInterimText = '';
      let allFinalText = '';
      
      // Process ALL results to get complete transcript
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        const confidence = result[0].confidence || 0.8;
        
        console.log(`Processing result ${i}:`, {
          transcript: `"${transcript}"`,
          isFinal: result.isFinal,
          confidence: confidence
        });
        
        if (result.isFinal) {
          allFinalText += transcript;
        } else {
          allInterimText += transcript;
        }
      }
      
      // Process only new final results from this event
      let newFinalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          newFinalText += result[0].transcript;
          const transcript = result[0].transcript;
          const confidence = result[0].confidence || 0.8;
          
          this.finalResults.push(transcript.trim());
          console.log('✅ New final result added:', transcript.trim());
          
          // Send each final result immediately
          const finalResult = {
            transcript: transcript.trim(),
            isFinal: true,
            confidence: confidence,
            timestamp: Date.now()
          };
          
          console.log('📤 Sending final result:', finalResult);
          this.onTranscript?.(finalResult);
        }
      }
      
      // Send interim results (all non-final text)
      if (allInterimText.trim() && allInterimText.trim() !== this.lastInterim) {
        this.lastInterim = allInterimText.trim();
        console.log('📝 Sending complete interim result:', allInterimText.trim());
        
        const interimResult = {
          transcript: allInterimText.trim(),
          isFinal: false,
          confidence: 0.5,
          timestamp: Date.now()
        };
        
        this.onTranscript?.(interimResult);
        window.latestAmplitude = 0.6; // Simulate amplitude for UI
      }
    };

    this.recognition.onerror = (event) => {
      console.error('❌ Browser Speech Recognition error:', event.error);
      console.log('🔍 Error details:', {
        error: event.error,
        message: event.message,
        timestamp: new Date().toISOString()
      });
      
      // Handle specific errors
      if (event.error === 'not-allowed') {
        console.error('🚫 Microphone permission denied');
        this.onError?.(new Error('Microphone permission denied. Please allow microphone access and try again.'));
      } else if (event.error === 'no-speech') {
        console.log('⏸️ No speech detected, continuing...');
        // Don't treat as error, just continue
      } else if (event.error === 'network') {
        console.error('🌐 Network error during speech recognition');
        this.onError?.(new Error('Network error occurred during speech recognition'));
      } else if (event.error === 'aborted') {
        console.log('⏸️ Recognition aborted');
      } else if (event.error === 'audio-capture') {
        console.error('🎤 Audio capture error');
        this.onError?.(new Error('Audio capture error. Please check your microphone.'));
      } else if (event.error === 'service-not-allowed') {
        console.error('🚫 Speech recognition service not allowed');
        this.onError?.(new Error('Speech recognition service not allowed'));
      } else {
        console.warn(`⚠️ Speech recognition error: ${event.error}`);
        this.onError?.(new Error(`Speech recognition error: ${event.error}`));
      }
    };

    this.recognition.onstart = () => {
      console.log('▶️ Browser Speech Recognition started');
      this.isRecording = true;
      this.lastInterim = '';
      this.finalResults = []; // Reset final results for new session
      this.onStatusChange?.('recording');
    };

    this.recognition.onend = () => {
      console.log('⏹️ Browser Speech Recognition ended');
      console.log('📊 Session summary:', {
        finalResults: this.finalResults,
        totalFinalResults: this.finalResults.length,
        sessionDuration: Date.now() - this.sessionStartTime
      });
      this.isRecording = false;
      this.onStatusChange?.('stopped');
      
      // Auto-restart if we're supposed to be recording (for continuous recognition)
      if (this.shouldBeRecording) {
        console.log('🔄 Restarting browser Speech Recognition for continuous mode...');
        setTimeout(() => {
          if (this.recognition && this.shouldBeRecording) {
            try {
              this.recognition.start();
            } catch (error) {
              if (error.name !== 'InvalidStateError') {
                console.error('❌ Error restarting recognition:', error);
              }
            }
          }
        }, 100);
      }
    };

    this.recognition.onspeechstart = () => {
      console.log('🎙️ Speech detected');
    };

    this.recognition.onspeechend = () => {
      console.log('🔇 Speech ended');
    };
  }

  /**
   * Connect to speech recognition service
   */
  async connect() {
    try {
      console.log('🎤 Initializing browser Speech Recognition only');
      this.initializeBrowserSpeechRecognition();
      this.onStatusChange?.('connected');
      return Promise.resolve();
    } catch (error) {
      console.error('❌ Failed to initialize browser Speech Recognition:', error);
      return Promise.reject(error);
    }
  }

  /**
   * Start speech recognition
   */
  async startRecognition() {
    if (!this.recognition) {
      await this.connect();
    }

    if (this.isRecording) {
      console.log('⚠️ Recognition already running');
      return;
    }

    try {
      console.log('🎤 Starting browser Speech Recognition...');
      this.shouldBeRecording = true;
      this.finalResults = []; // Reset final results
      this.lastInterim = '';
      this.sessionStartTime = Date.now(); // Track session duration
      
      // Immediately update status to show starting
      this.onStatusChange?.('starting');
      
      this.recognition.start();
      console.log('✅ Speech recognition start() called successfully');
    } catch (error) {
      console.error('❌ Error starting recognition:', error);
      this.onError?.(error);
    }
  }

  /**
   * Stop speech recognition
   */
  stopRecognition() {
    if (!this.recognition) {
      console.log('⚠️ No recognition instance to stop');
      return;
    }

    console.log('⏹️ Stopping browser Speech Recognition...');
    this.shouldBeRecording = false;
    
    if (this.isRecording) {
      this.recognition.stop();
    }
    
    console.log('Final session results:', {
      finalResults: this.finalResults,
      totalFinalResults: this.finalResults.length
    });
  }

  /**
   * Set event handlers
   */
  setEventHandlers({ onTranscript, onError, onStatusChange }) {
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onStatusChange = onStatusChange;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    console.log('🔌 Disconnecting speech recognition...');
    
    this.shouldBeRecording = false;
    
    if (this.recognition) {
      if (this.isRecording) {
        this.recognition.stop();
      }
      this.recognition = null;
    }
    
    this.isRecording = false;
    this.onStatusChange?.('disconnected');
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isConnected: !!this.recognition,
      isRecording: this.isRecording,
      useFallback: true, // Always true now since we're browser-only
      language: this.currentLanguage
    };
  }
}

// Export singleton instance
const speechClientInstance = new BrowserSpeechClient();
export default speechClientInstance;
