/**
 * Unified Speech Recognition Client
 * Supports both So    // Configuration options
    this.config = {
      model: options.model || 'stt-rt-preview',  // Use correct model alias from official docs
      audioFormat: 'pcm_s16le',  // Fixed format as per official docs
      enableSpeakerDiarization: options.enableSpeakerDiarization || false,
      enableLanguageIdentification: true,  // Always enable for multi-language support
      enableNonFinalTokens: true,  // Always enable for real-time feedback
      enableEndpointDetection: false,  // Disable to prevent premature finalization
      context: options.context || 'kirtan bhajan punjabi religious song',  // Better context for domain
      ...options
    };ket API and react-speech-recognition (Web Speech API) fallback
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

// Soniox language mappings - Punjabi first for Kirtan/Bhajan transcription
export const sonioxLanguageMap = {
  'punjabi': 'pa',
  'hindi': 'hi', 
  'english': 'en',
  'pa': 'pa',
  'hi': 'hi',
  'en': 'en'
};

/**
 * Get mapped language code for Web Speech API
 */
export const getMappedLanguage = (language) => {
  const lang = language?.toLowerCase();
  return languageMap[lang] || 'en-US';
};

/**
 * Get mapped language code for Soniox API
 */
export const getSonioxLanguage = (language) => {
  const lang = language?.toLowerCase();
  return sonioxLanguageMap[lang] || 'en';
};

/**
 * Speech Recognition Provider Types
 */
export const SPEECH_PROVIDERS = {
  SONIOX: 'soniox',
  WEB_SPEECH: 'web_speech'
};

/**
 * Soniox WebSocket Speech Recognition Client
 */
export class SonioxSpeechClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.ws = null;
    this.isConnected = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.stream = null;
    this.keepaliveInterval = null; // For connection keepalive
    
    // Configuration options
    this.config = {
      model: options.model || 'stt-rt-preview',  // Use correct model alias from official docs
      audioFormat: 'pcm_s16le',  // Fixed format as per official docs
      enableSpeakerDiarization: options.enableSpeakerDiarization || false,
      enableLanguageIdentification: true,  // Always enable for multi-language support
      enableNonFinalTokens: true,  // Always enable for real-time feedback
      enableEndpointDetection: false,  // Disable to prevent premature finalization
      context: options.context || 'kirtan bhajan punjabi religious song',  // Better context for domain
      ...options
    };

    // Event handlers
    this.onTranscript = options.onTranscript || (() => {});
    this.onError = options.onError || (() => {});
    this.onConnectionChange = options.onConnectionChange || (() => {});
    this.onFinalTranscript = options.onFinalTranscript || (() => {});
  }

  /**
   * Connect to Soniox WebSocket API following official protocol
   */
  async connect(language = 'en') {
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }

      console.log('🔗 Connecting to Soniox WebSocket API...');

      return new Promise((resolve, reject) => {
        this.ws = new WebSocket('wss://stt-rt.soniox.com/transcribe-websocket');
        this.isConnected = false;
        
        this.ws.onopen = () => {
          console.log('✅ Connected to Soniox WebSocket API');
          
          // Send minimal configuration to test - exact format from official docs
          const config = {
            "api_key": this.apiKey,
            "model": "stt-rt-preview",
            "audio_format": "pcm_s16le",
            "sample_rate": 16000,
            "num_channels": 1
            
          };

          this.ws.send(JSON.stringify(config));
          console.log('📡 Sent Soniox configuration:', config);
          
          // Set connected state and resolve immediately
          this.isConnected = true;
          this.onConnectionChange(true);
          console.log('✅ Soniox ready for audio streaming');
          
          // Start keepalive to prevent connection timeout
          this.startKeepalive();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            this.handleSonioxResponse(response);
          } catch (error) {
            console.error('❌ Error parsing Soniox response:', error);
            this.onError(error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 Soniox WebSocket closed:', event.code, event.reason);
          this.isConnected = false;
          this.onConnectionChange(false);
          this.stopKeepalive(); // Stop keepalive when connection closes
          
          if (event.code !== 1000) { // Not a normal closure
            const error = new Error(`WebSocket closed with code ${event.code}: ${event.reason}`);
            this.onError(error);
            reject(error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ Soniox WebSocket error:', error);
          this.isConnected = false;
          this.onConnectionChange(false);
          this.stopKeepalive(); // Stop keepalive on error
          this.onError(error);
          reject(error);
        };
      });

    } catch (error) {
      console.error('❌ Failed to connect to Soniox:', error);
      this.onError(error);
      throw error;
    }
  }

  /**
   * Handle Soniox API responses
   */
  handleSonioxResponse(response) {
    if (response.error_code) {
      console.error('❌ Soniox API error:', response.error_code, response.error_message);
      this.onError(new Error(`Soniox API Error ${response.error_code}: ${response.error_message}`));
      return;
    }

    if (response.finished) {
      console.log('✅ Soniox transcription finished');
      this.onFinalTranscript();
      return;
    }

    if (response.tokens && response.tokens.length > 0) {
      // Separate final and interim tokens
      const finalTokens = response.tokens.filter(token => token.is_final);
      const interimTokens = response.tokens.filter(token => !token.is_final);
      
      // Build interim transcript for immediate display
      const interimTranscript = interimTokens.map(token => token.text).join('');
      
      // Build final transcript that should be concatenated
      const finalTranscript = finalTokens.map(token => token.text).join('');
      
      // Detect languages in the tokens
      const languages = [...new Set(response.tokens
        .filter(token => token.language)
        .map(token => token.language)
      )];
      
      console.log('🎤 Soniox transcript:', {
        interim: interimTranscript,
        final: finalTranscript,
        languages: languages,
        totalTokens: response.tokens.length,
        finalTokens: finalTokens.length,
        interimTokens: interimTokens.length
      });

      // Call transcript handler with proper separation
      this.onTranscript(interimTranscript, false, {
        tokens: interimTokens,
        languages: languages,
        finalAudioMs: response.final_audio_proc_ms,
        totalAudioMs: response.total_audio_proc_ms,
        provider: SPEECH_PROVIDERS.SONIOX
      });

      // Handle final tokens separately for concatenation
      if (finalTokens.length > 0) {
        this.onTranscript(finalTranscript, true, {
          tokens: finalTokens,
          languages: languages,
          finalAudioMs: response.final_audio_proc_ms,
          totalAudioMs: response.total_audio_proc_ms,
          provider: SPEECH_PROVIDERS.SONIOX
        });
      }
    }
  }

  /**
   * Start keepalive mechanism to prevent connection timeout
   * As per Soniox docs: send keepalive at least once every 20 seconds when not sending audio
   */
  startKeepalive() {
    // Clear any existing keepalive
    this.stopKeepalive();
    
    // Send keepalive every 10 seconds (well within the 20s requirement)
    this.keepaliveInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isConnected) {
        // Only send keepalive when not actively sending audio
        if (!this.isRecording) {
          const keepaliveMessage = { type: 'keepalive' };
          this.ws.send(JSON.stringify(keepaliveMessage));
          console.log('💓 Sent keepalive to maintain Soniox connection');
        }
      }
    }, 10000); // 10 seconds
  }

  /**
   * Stop keepalive mechanism
   */
  stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
  }

  /**
   * Start recording audio and sending to Soniox
   */
  async startRecording() {
    try {
      // Ensure we have a valid connection
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isConnected) {
        throw new Error('Soniox WebSocket not connected. Please ensure connection is established first.');
      }

      if (this.isRecording) {
        console.log('🎤 Recording already in progress');
        return;
      }

      console.log('🎤 Starting Soniox recording...');

      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Create audio context and recorder
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      });

      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Create a script processor for real-time audio processing
      const processor = this.audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (event) => {
        if (this.isRecording && this.ws && this.ws.readyState === WebSocket.OPEN) {
          const inputBuffer = event.inputBuffer.getChannelData(0);
          
          // Convert to 16-bit PCM
          const pcmData = new Int16Array(inputBuffer.length);
          for (let i = 0; i < inputBuffer.length; i++) {
            pcmData[i] = Math.max(-32768, Math.min(32767, inputBuffer[i] * 32768));
          }
          
          // Send as binary data
          this.ws.send(pcmData.buffer);
        }
      };

      source.connect(processor);
      processor.connect(this.audioContext.destination);
      
      this.processor = processor;
      this.isRecording = true;
      
      console.log('✅ Soniox recording started');

    } catch (error) {
      console.error('❌ Failed to start Soniox recording:', error);
      this.onError(error);
    }
  }

  /**
   * Stop recording
   */
  stopRecording() {
    if (!this.isRecording) {
      return;
    }

    console.log('⏹️ Stopping Soniox recording...');

    this.isRecording = false;

    // Clean up audio resources
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // Send empty frame to signal end of audio
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(new ArrayBuffer(0));
    }

    console.log('✅ Soniox recording stopped');
  }

  /**
   * Update language
   */
  async setLanguage(language) {
    const sonioxLang = getSonioxLanguage(language);
    
    if (this.isRecording) {
      this.stopRecording();
    }

    if (this.isConnected) {
      this.disconnect();
    }

    // Reconnect with new language
    await this.connect(sonioxLang);
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect() {
    console.log('🔌 Disconnecting from Soniox...');
    
    this.stopRecording();
    this.stopKeepalive(); // Stop keepalive mechanism
    
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.onConnectionChange(false);
  }

  /**
   * Check if Soniox is available (has API key)
   */
  static isAvailable(apiKey) {
    return Boolean(apiKey && apiKey.trim());
  }
}
