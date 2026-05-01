# Mini Browser Agent - Agent Modes

This Browser Agent is equipped with several personas or **agent modes** designed specifically to handle various types of web scenarios. Each mode has different rules and a distinct persona to ensure tasks are completed more accurately.

Below is an explanation of the function, purpose, and behavior of each mode:

---

## 1. 🤖 Agent (Default Mode)
The **Agent** mode is the primary assistant profile, being the most flexible and autonomous. This mode is designed to proactively complete most commands without requiring step-by-step instructions from the user.

- **Primary Focus:** Completing complex, multi-step tasks.
- **Behavior:**
  - Has full freedom to navigate, click elements, scroll the screen, and type inputs.
  - Highly efficient, precise, and will not ask for unnecessary confirmation before performing an action.
- **When to Use:** When you want to delegate tasks like "Please find the cheapest flight tickets to Bali next month" or "Create an account on this website".

---

## 2. 📖 Reader
The **Reader** mode is dedicated to consuming information without interacting too much with the user interface (UI) elements on the web page. This mode focuses purely on text and data.

- **Primary Focus:** Reading, extracting information, summarizing, and answering questions based on the page context.
- **Behavior:**
  - The AI is designed to be a meticulous reader.
  - By default, the AI in this mode will **avoid actions** such as clicking, typing, or navigating to other pages unless explicitly instructed by the user.
- **When to Use:** Highly suitable when you are reading long articles, journal papers, or news, and you need the AI to summarize or locate specific information on the page.

---

## 3. 📝 Form Filler
The **Form Filler** mode is a data entry specialist. It helps automate the process of filling out long and repetitive forms to make it faster and minimize errors (typos).

- **Primary Focus:** Filling various *input fields*, ranging from text and *dropdowns* to *checkboxes*.
- **Behavior:**
  - Will always analyze and read the entire form structure first (it does not fill blindly).
  - Fills each field step-by-step.
  - **Crucial:** Has a built-in procedure to always review the entered data *before* finally clicking the submit button.
- **When to Use:** Filling out job applications, entering personal data during *e-commerce checkout*, or completing surveys that have many routine questions.

---

## 4. 🔬 Researcher
The **Researcher** mode is designed for academic work, journalism, or comparative analysis that requires comparing information across multiple *resources*.

- **Primary Focus:** Cross-site research, deep information retrieval, and data synthesis.
- **Behavior:**
  - Will actively open **new tabs** for different information sources.
  - Can read multiple pages in parallel or sequentially, and then compare their contents.
  - Instructed to always provide **source links (URLs)** at the end of the summary to ensure data credibility.
- **When to Use:** "Find a feature and price comparison between the iPhone 15 and Samsung Galaxy S24 from 3 leading review sites."

---

## Token Usage Panel

All agent modes share a **realtime token usage summary** panel displayed below the sidebar header. It shows cumulative token consumption and estimated USD cost for the current session, updating automatically after each API response. The panel is hidden until the first API call is made and resets when the chat is cleared.
