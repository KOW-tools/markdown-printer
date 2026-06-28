# Privacy Policy

*Last Updated: June 2026*

Markdown Printer ("we", "our", or "us") is an open-source, client-side markdown editor and previewer. This Privacy Policy explains how data is handled when you use our application.

## 1. Information We Collect (Application Level)

Markdown Printer is a fully client-side application. **We do not collect, transmit, or store any data on external servers.**

All data you enter — including markdown content, file uploads, and editor preferences — remains entirely within your browser. No account, login, or personal information is required to use this application.

## 2. Infrastructure & Hosting Data (Server Level)

While Markdown Printer does not collect your data, the platform used to host this website (e.g., GitHub Pages / Netlify / Vercel) may automatically collect standard web server logs. This metadata is a technical necessity for serving the website files and ensuring security.

This data may include:

* Your Internet Protocol (IP) address.
* Browser type and operating system.
* Date and time of your visit.
* Referring website addresses.

This data is handled by our hosting provider in accordance with their respective privacy policy and is not used by us for tracking or profiling purposes.

## 3. Local Data Storage

To provide features like session persistence and font uploads, we use browser-native storage technologies:

* **IndexedDB:** Used to store tab history (markdown content) and uploaded custom fonts. This data never leaves your device.
* **localStorage:** Used to remember your editor preferences such as page size, font selection, margin settings, theme preference, view mode, and LLM API keys.
* **sessionStorage:** Used to maintain your current editing session and active tab state.

You can clear all stored data at any time through your browser's settings or developer tools.

## 4. How We Use Your Data

All locally stored data is used solely to:

* Restore your editing session when you return to the application.
* Remember your display preferences across sessions.
* Provide access to previously opened documents via the history feature.
* Retain custom fonts you have uploaded for use in document rendering.
* Store your LLM API key for AI autocomplete (only sent directly from your browser to the API provider you configure).

## 5. Third-Party Services

Markdown Printer does **not** integrate with any third-party analytics, advertising, payment, or tracking services. We do not use Google Analytics, Hotjar, or any similar tools.

The application loads web fonts from [@fontsource](https://www.google.com/search?q=https://www.npmjs.com/package/%40fontsource) as bundled assets. No user data is sent to external font providers.

**LLM Autocomplete (Opt-in):** When you enable AI autocomplete and configure an API provider, your API key is sent directly from your browser to the API provider you configure (e.g., OpenAI, Anthropic). Markdown Printer never sees or stores your API key. All LLM requests are made directly between your browser and the API provider.

## 6. Cookies and Tracking

Markdown Printer does **not** use cookies or any tracking technologies. All state is managed through browser storage APIs described above.

## 7. Your Rights

Under applicable privacy laws including GDPR and CCPA, you have the right to:

* **Access:** View all data stored locally by this application through your browser's developer tools.
* **Delete:** Remove all application data by clearing your browser's site data for this domain, or by using the "Clear History" feature within the application.
* **Export:** Download your markdown content at any time in Markdown, HTML, or PDF format.

## 8. Children's Privacy

Markdown Printer does not knowingly collect any information from children under the age of 13. Since all core data processing occurs locally in your browser and no personal information is requested, the application is safe for users of all ages.

## 9. Data Security

All your application data is stored locally on your device. No document data is transmitted over the internet by this application. Your data security is equivalent to the security of your own device and browser.

## 10. Changes to This Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this page. Continued use of the application after changes constitutes acceptance of the updated policy.

## 11. Contact

If you have questions about this Privacy Policy or wish to exercise your data rights, please reach out via:

* GitHub: https://www.github.com/KOWX712/markdown-printer
