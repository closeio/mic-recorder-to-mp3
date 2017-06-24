# Microphone Recorder to Mp3

Record your microphone audio input and get a ```audio/mp3``` file in the end.

# Install

## Yarn

```bash
yarn add mic-recorder-to-mp3
```

## NPM

```bash
npm install mic-recorder-to-mp3
```

# How to use

```js
const MicRecorder = require('mic-recorder-to-mp3');

// New instance
const recorder = new MicRecorder({
  bitRate: 128
});

// Start recording. Browser will request permission to use your microphone.
recorder.start(function () {
  console.log('Start recording');
}, function () {
  alert('We could not make use of your microphone at the moment');
});


// Once you are done singing your best song, stop and get the mp3.
recorder
  .stop()
  .getMp3((buffer, blob) => {
    // do what ever you want with buffer and blob
    // Example: Create a mp3 file and play
    const file = new File(buffer, 'me-at-thevoice.mp3', {
      type: blob.type,
      lastModified: Date.now()
    });

    const player = new Audio(URL.createObjectURL(file));
    player.play();

  }, function (e) {
    alert('We could not retrieve your message');
    console.log(e);
  });
```

# License

MIT
