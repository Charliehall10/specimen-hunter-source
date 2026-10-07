"""Transcribe WAV files with Vosk to sanity-check what a voice line says."""
import json, sys, wave
from vosk import Model, KaldiRecognizer, SetLogLevel

SetLogLevel(-1)
model = Model(sys.argv[1])
for path in sys.argv[2:]:
    w = wave.open(path)
    rec = KaldiRecognizer(model, w.getframerate())
    rec.SetWords(True)
    while True:
        data = w.readframes(4000)
        if not data:
            break
        rec.AcceptWaveform(data)
    res = json.loads(rec.FinalResult())
    words = ', '.join(f"{x['word']}({x['conf']:.2f})" for x in res.get('result', []))
    print(f"{path}: '{res.get('text', '')}'  {words}")
