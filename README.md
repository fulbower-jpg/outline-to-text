# Outline to Text for Illustrator

Turn **outlined text back into live, editable text** in Adobe Illustrator. Select the outlined letters, click one button, and get editable text in the closest font you have installed.

> Think of it as a "grab text" feature for Illustrator, for when you have lots of outlined text and don't want to retype it.

<!-- Add a before/after GIF or screenshot here. This is the most important part of the README. -->
<!-- ![demo](docs/demo.gif) -->

## Features

- Converts outlined **English** text into editable text objects
- Finds the **closest matching font** from the fonts installed on your computer (regular or bold)
- Keeps the original colour and size, and places the text where the outlines were
- Choose to hide, keep or delete the original outlines
- **Convert anyway** button if no close font match is found
- Runs **fully offline**. Nothing is uploaded anywhere

## Install

1. Download `OutlineToText.zip` from the [latest release](../../releases/latest) and unzip it.
2. **Windows:** double-click `install-windows.bat`.
   **Mac:** open Terminal in the folder and run `bash install-mac.sh`.
3. Restart Illustrator.
4. Open **Window > Extensions > Outline to Text**.

The installer copies the panel into Adobe's extensions folder and turns on Adobe's debug mode, which is required for panels that aren't signed.

## How to use

1. Select the outlined text (it can be several lines or several shapes).
2. In the panel, choose a font mode:
   - **Closest match** tries every installed font and picks the best one.
   - **Always use one font** lets you pick a font yourself.
3. Choose what happens to the original outlines.
4. Click **Convert selection to live text**.
5. Check the result. OCR can mix up similar letters (I / l / 1, O / 0), so read it over.

## Limits

- English only for now
- You get one text object per line, not paragraphs
- Tracking, leading and exact kerning are not recreated
- Decorative or script fonts may not be recognised
- Text inside clipping masks, over photos, rotated or curved may not work well
- Early version. It has had limited testing, so please report problems

## Troubleshooting

- **Panel doesn't show up:** restart Illustrator after installing. Make sure you ran the installer for your system.
- **"Select the outlined text first":** select the outlines with the Selection tool before clicking Convert.
- **Wrong text or font:** try "Always use one font", or use **Convert anyway** and fix the text by hand.
- **Something else:** open an [issue](../../issues) and paste the message from the panel's log box.

## How it works

1. Copies your selection into a temporary document and turns it black on white.
2. Exports it as an image and reads the text with Tesseract OCR.
3. Draws the text in each installed font, stretched to the same width, and compares the shapes to the original.
4. Creates live text in the best match, sized and positioned to line up with the outlines.

## Compatibility

Built as an Adobe CEP panel for Illustrator versions that still support CEP. Adobe is gradually moving to a newer system called UXP, so this may need updating in the future.

## Credits

Built by [Aman](https://github.com/YOUR_USERNAME) with help from Claude (Anthropic). Uses Tesseract OCR, see [NOTICE.md](NOTICE.md).

## License

[MIT](LICENSE)
