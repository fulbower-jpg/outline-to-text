# Third-party software

This project bundles the following open-source components (inside `OutlineToText/`):

| Component | Used for | License |
|---|---|---|
| [Tesseract.js](https://github.com/naptha/tesseract.js) (`lib/tesseract.min.js`, `lib/worker.min.js`) | Reading text from images (OCR) | Apache 2.0 |
| [Tesseract.js Core](https://github.com/naptha/tesseract.js-core) (`lib/tesseract-core.wasm.js`) | OCR engine (WebAssembly) | Apache 2.0 |
| [Tesseract English language data](https://github.com/tesseract-ocr/tessdata_best) (`lib/lang/eng.traineddata.gz`) | English OCR model | Apache 2.0 |
| `CSInterface.js` from [Adobe CEP Resources](https://github.com/Adobe-CEP/CEP-Resources) | Talking to Illustrator from the panel | Adobe's license, see the header in the file |

The rest of the project is MIT licensed, see `LICENSE`.
