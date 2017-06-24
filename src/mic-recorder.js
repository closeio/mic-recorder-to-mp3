import Encoder from './encoder';

// getUserMedia Shim
navigator.getUserMedia = navigator.getUserMedia ||
  navigator.webkitGetUserMedia ||
  navigator.mozGetUserMedia ||
  navigator.msGetUserMedia;

class MicRecorder {
  constructor(config) {
    this.startTime = 0;
    this.microphone = null;
    this.processor = null;
    this.activeStream = null;

    this.config = config || {};
  }

  /**
   * Returns a new AudioContext instance
   */
  createAudioContext() {
    return new AudioContext();
  }

  /**
   * Starts to listen for the microphone sound
   * @param {MediaStream} stream
   */
  beginRecording(stream) {
    this.activeStream = stream;

    // This prevents the weird noise once you start listening to the microphone
    this.timerToStart = setTimeout(() => {
      delete this.timerToStart;
    }, 10);

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
  start(callback, callbackError) {
    this.context = this.createAudioContext();
    this.config.sampleRate = this.context.sampleRate;
    this.lameEncoder = new Encoder(this.config);

    navigator.getUserMedia({ audio: true }, (stream) => {
      this.beginRecording(stream);
      callback(stream);
    }, (error) => {
      callbackError(error);
    });
  };

  /**
   * Return Mp3 Buffer and Blob with type mp3
   * @param {Function} callback
   */
  getMp3(callback) {
    const finalBuffer = this.lameEncoder.finish();

    console.log('MP3 data size', finalBuffer.length);
    callback(finalBuffer, new Blob(finalBuffer, { type: 'audio/mp3' }));

    this.lameEncoder.clearBuffer();
  };
};

export default MicRecorder;
