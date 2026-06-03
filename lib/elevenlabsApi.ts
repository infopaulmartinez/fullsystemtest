import { toast } from 'react-hot-toast';

// ElevenLabs API wrapper
class ElevenLabsAPI {
  private apiKey: string = import.meta.env.VITE_ELEVENLABS_API_KEY || '39e8258376b99dbff5da8fbe0afbd4e2';
  private voiceId: string = 'WNxHBFUm0NC5fojx98kr'; // Vivien ElevenLabs voice ID
  private isPlaying: boolean = false;
  private audioElement: HTMLAudioElement | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.apiKey = apiKey;
    }
    this.initAudioElement();
  }

  private initAudioElement() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.addEventListener('ended', () => {
        this.isPlaying = false;
      });
      this.audioElement.addEventListener('error', (e) => {
        console.error('Audio element error:', e);
        this.isPlaying = false;
      });
    }
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  public setVoiceId(voiceId: string) {
    this.voiceId = voiceId;
  }

  public async speak(text: string): Promise<boolean> {
    return this.textToSpeech(text)
  }

  public async textToSpeech(text: string): Promise<boolean> {
    try {
      console.log('Generating speech with ElevenLabs for text:', text.substring(0, 50) + '...');
      
      // Use fetch API directly to call ElevenLabs API
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_flash_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error:', response.status, errorText);
        
        if (response.status === 401) {
          throw new Error('unauthorized');
        } else if (response.status === 429) {
          throw new Error('quota_exceeded');
        } else {
          throw new Error(`API error: ${response.status}`);
        }
      }

      const audioData = await response.arrayBuffer();
      console.log(`Audio data received: ${audioData.byteLength} bytes`);
      
      // Create audio blob and play
      if (this.audioElement) {
        const audioBlob = new Blob([audioData], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(audioBlob);
        this.audioElement.src = audioUrl;
        this.isPlaying = true;
        
        try {
          await this.audioElement.play();
          console.log('Audio playback started successfully');
        } catch (playError) {
          console.error('Audio playback error:', playError);
          this.isPlaying = false;
          URL.revokeObjectURL(audioUrl);
          throw new Error('Failed to play audio: ' + playError.message);
        }
        
        // Clean up object URL after playing
        this.audioElement.onended = () => {
          URL.revokeObjectURL(audioUrl);
          this.isPlaying = false;
          console.log('Audio playback ended');
        };
        
        this.audioElement.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          this.isPlaying = false;
          console.error('Audio element error during playback');
        };
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error calling ElevenLabs API:', error);
      
      // Show user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('quota_exceeded')) {
          toast.error('ElevenLabs API kvóta túllépve. Ellenőrizd a fiókod.');
        } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
          toast.error('Érvénytelen ElevenLabs API kulcs.');
        } else if (error.message.includes('Failed to play audio')) {
          toast.error('Hang lejátszási hiba. Próbáld újra.');
        } else {
          toast.error('Hiba a beszédgenerálás során. Próbáld újra.');
        }
      } else {
        toast.error('Ismeretlen hiba történt a beszédgenerálás során.');
      }
      
      return false;
    }
  }

  public async getVoices(): Promise<any[]> {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: {
          'xi-api-key': this.apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.status}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error getting ElevenLabs voices:', error);
      return [];
    }
  }

  public stop() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.isPlaying = false;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}

// Create a singleton instance
export const elevenlabsApi = new ElevenLabsAPI();

export default elevenlabsApi;