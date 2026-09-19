# Discord Spanish Translator

A lightweight Chrome extension (Manifest V3) that translates incoming Discord Web chat messages into Spanish in real time.

Instead of displaying duplicate translation cards below every message, this extension replaces the foreign text directly in-place for a clean, distraction-free chat experience.

---

## Features

- **In-Place Replacement**: Directly replaces non-Spanish messages with their Spanish translation.
- **Automatic Translation**: Uses a `MutationObserver` to detect and translate incoming messages automatically.
- **CSP & CORS Compliant**: All translation network calls are handled via the background Service Worker to adhere to Discord's Content Security Policy.
- **No API Keys Required**: Uses the public translation endpoint out of the box with zero external configuration or paid subscriptions.
- **Outgoing Message Translator**: Includes an optional button in the chat bar to translate your draft before sending.
- **Customizable**: Built-in popup settings menu to toggle auto-translation, toggle in-place replacement, switch destination languages, or clear cache.
- **Local Caching**: Caches recent translations to minimize requests and prevent rate limits.

---

## Installation

### Prerequisites
Google Chrome, Brave, Microsoft Edge, or any Chromium-based browser.

### Steps

1. Clone or download this repository:
   ```bash
   git clone https://github.com/bert27/Discord-Spanish-translator.git
   ```

2. Open your browser and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable **Developer mode** (toggle located in the upper-right corner).

4. Click **Load unpacked** in the top-left corner and select the cloned folder:
   ```
   /path/to/Discord-Spanish-translator
   ```

5. Go to [Discord Web](https://discord.com/app) and reload the tab. Any non-Spanish messages will now be rendered in Spanish.

---

## Project Structure

```
.
├── manifest.json            # Manifest V3 extension configuration
├── background/
│   └── service-worker.js    # Background service worker (API handling & cache)
├── content/
│   ├── content.js           # Content script (DOM observer & message replacer)
│   └── styles.css           # Styling for translated message elements
├── popup/
│   ├── popup.html           # Settings popup interface
│   ├── popup.css            # Popup styles
│   └── popup.js             # Settings state management
├── icons/                   # Extension icons (16px, 32px, 48px, 128px)
├── LICENSE                  # MIT License
└── README.md                # Documentation
```

---

## Settings

Clicking the extension icon in the toolbar opens the configuration panel:

- **Auto-Translate**: Automatically translates new chat messages without manual interaction.
- **In-Place Replacement**: Replaces original message text directly instead of appending translated boxes.
- **Outgoing Translation**: Adds a translation action to the message input bar.
- **Target Language**: Sets the primary language (defaults to Spanish `es`).
- **Clear Cache**: Clears the stored translation cache.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
