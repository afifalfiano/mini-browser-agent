// providers/gemini.js

if (typeof ProviderManager === "undefined") {
  console.error("ProviderManager not loaded");
} else {
  ProviderManager.register("gemini", {
    name: "Gemini",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3.0-flash", "gemini-3.0-pro", "gemini-2.0-flash"],

    async chatCompletion({ apiKey, model, messages, maxTokens = 4096, temperature = 0.7 }) {
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
        throw new Error("Invalid Gemini API key");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000); // 60s timeout

      try {
        // Convert standard {role, content} to Gemini format
        // Gemini roles: "user", "model"
        // Also separate system instructions
        let systemInstruction = null;
        const geminiContents = [];

        for (const msg of messages) {
          if (msg.role === "system") {
            // If multiple system messages exist, combine them
            if (systemInstruction) {
              systemInstruction.parts[0].text += "\n\n" + msg.content;
            } else {
              systemInstruction = { parts: [{ text: msg.content }] };
            }
          } else {
            const role = msg.role === "assistant" ? "model" : "user";
            // Combine consecutive messages with the same role (Gemini requires alternating roles)
            if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
               geminiContents[geminiContents.length - 1].parts[0].text += "\n\n" + msg.content;
            } else {
               geminiContents.push({
                 role: role,
                 parts: [{ text: msg.content }]
               });
            }
          }
        }

        const requestBody = {
          contents: geminiContents,
          generationConfig: {
            temperature: temperature,
            maxOutputTokens: maxTokens,
          }
        };

        if (systemInstruction) {
          requestBody.systemInstruction = systemInstruction;
        }

        const geminiModel = model || "gemini-2.5-flash";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey.trim()}`;

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`Gemini API error ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        
        // Extract text from Gemini response
        let textContent = "";
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
          textContent = data.candidates[0].content.parts.map(p => p.text).join("");
        } else {
          textContent = "No response.";
        }

        return {
          content: textContent,
          raw: data
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }
  });
}
