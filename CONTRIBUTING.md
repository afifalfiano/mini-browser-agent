# Contributing to Mini Browser Agent

First off, thank you for considering contributing to Mini Browser Agent! It's people like you that make open source such a great community to learn, inspire, and create.

## How to Contribute

### 1. Fork & Clone
Fork the repository on GitHub and clone it to your local machine.
```bash
git clone https://github.com/your-username/mini-browser-agent.git
cd mini-browser-agent
```

### 2. Setup Environment
Install dependencies needed for testing. We use Puppeteer for headless browser automation testing.
```bash
npm install
```

Copy the example environment variables file and add your own API keys.
```bash
cp .env.example .env
```
*(Never commit your `.env` file!)*

### 3. Making Changes
Create a new branch for your feature or bug fix:
```bash
git checkout -b feature/your-awesome-feature
```

When making changes, please keep the following in mind:
- Ensure you do not add external dependencies to the extension files unless absolutely necessary (we prefer Vanilla JS to keep the extension lightweight and secure).
- If you modify the core engine, please ensure the Prompt format remains intact and robust.
- The extension runs in Manifest V3 environments. Respect the separation between `sidebar`, `background`, and `content scripts`.

### 4. Running Tests
Before submitting a pull request, ensure that the core features remain functional by running the End-to-End tests:
```bash
npm run test:e2e
```
*Note: The E2E tests run in a headless Chrome instance and will test `content.js` and `background.js` communication automatically.*

### 5. Submitting a Pull Request
Once you're happy with your changes, commit them with a clear message:
```bash
git commit -m "feat: add new scrolling capability"
git push origin feature/your-awesome-feature
```
Open a Pull Request on GitHub. Please provide a clear description of the problem you're solving or the feature you're adding.

## Code of Conduct
Please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms. Be respectful and constructive.

Thank you!
— Afif Alfiano
