# "Fish on!" voice line

The in-game clip is `client/src/assets/fish-on.wav`. It was made like this:

1. **Text to speech** with [Piper](https://github.com/OHF-Voice/piper1-gpl) (`pip install piper-tts`), voice
   `en_GB-northern_english_male-medium` (dataset OpenSLR 83, CC-BY-SA 4.0: credit it):

       python -m piper.download_voices --data-dir voices en_GB-northern_english_male-medium
       python -m piper -m voices/en_GB-northern_english_male-medium.onnx \
         --length-scale 0.85 --noise-scale 0.9 --noise-w-scale 1.0 -f take.wav -- 'Fish! On!'

2. **Make it excited** with `psola_excite.py` (numpy + scipy). It raises the pitch and makes "on" jump up
   (TD-PSOLA keeps timing and voice character), then adds emphasis, presence, a doubled layer, drive and
   a light echo:

       python psola_excite.py take.wav fish-on.wav 1.18 1.35 1.6     # in game ("medium")
       python psola_excite.py take.wav mild.wav    1.12 1.25 1.4
       python psola_excite.py take.wav hot.wav     1.25 1.45 1.8

3. **Check it** with `contour.py` (pitch of "fish" vs "on"; run on a `dry` render for accurate numbers)
   and `asr.py` (Vosk speech recognition, `pip install vosk` + `vosk-model-small-en-us-0.15`) to make sure
   it is still heard as "fish on".

To use your own recording instead, save it as a short mono WAV (trim the silence) over
`client/src/assets/fish-on.wav`, then rebuild the desktop app (`npm run dist` in `desktop/`).
