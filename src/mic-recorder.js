import 'webrtc-adapter';
import Encoder from './encoder';

class MicRecorder {
  constructor(config) {
    this.activeStream = null;
    this.context = null;
    this.microphone = null;
    this.processor = null;
    this.startTime = 0;

    this.config = config || {};
  }

  /**
   * Starts to listen for the microphone sound
   * @param {MediaStream} stream
   */
  addMicrophoneListener(stream) {
    this.activeStream = stream;

    // This prevents the weird noise once you start listening to the microphone
    this.timerToStart = setTimeout(() => {
      delete this.timerToStart;
    }, 100);

    // Set up Web Audio API to process data from the media stream (microphone).
    this.microphone = this.context.createMediaStreamSource(stream);

    // Settings a bufferSize of 0 instructs the browser to choose the best bufferSize
    this.processor = this.context.createScriptProcessor(0, 1, 1);

    // Add all buffers from LAME into an array.
    this.processor.onaudioprocess = (event) => {
      if (this.timerToStart) {
        return;
      }

      // Send microphone data to LAME for MP3 encoding while recording.
      this.lameEncoder.encode(event.inputBuffer.getChannelData(0));
    };

    // Begin retrieving microphone data.
    this.microphone.connect(this.processor);
    this.processor.connect(this.context.destination);
  };

  /**
   * Disconnect microphone, processor and remove activeStream
   */
  stop() {
    if (this.processor && this.microphone) {
      // Clean up the Web Audio API resources.
      this.microphone.disconnect();
      this.processor.disconnect();
      this.context.close();
      this.processor.onaudioprocess = null;

      // Remove recording icon from chrome tab
      this.activeStream.getAudioTracks().forEach(track => track.stop());
    }

    return this;
  };

  /**
   * Requests access to the microphone and start recording
   * @param {Function} callback
   * @param {Function} callbackError
   */
  start(callback, callbackError = null) {
    this.context = new AudioContext();
    this.config.sampleRate = this.context.sampleRate;
    this.lameEncoder = new Encoder(this.config);

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        this.addMicrophoneListener(stream);
        callback(stream);
      }).catch(function(err) {
        if (callbackError) callbackError(err);
      });
  };

  /**
   * Return Mp3 Buffer and Blob with type mp3
   * @param {Function} callback
   */
  getMp3(callback) {
    const finalBuffer = this.lameEncoder.finish();

    callback(finalBuffer, new Blob(finalBuffer, { type: 'audio/mp3' }));
    this.lameEncoder.clearBuffer();
  };
};

export default MicRecorder;
