// providers/minimax.js

if (typeof ProviderManager === "undefined") {
  console.error("ProviderManager not loaded");
} else {
  ProviderManager.register("minimax", {
    name: "MiniMax",
    models: ["MiniMax-M2.7", "MiniMax-M2.7-Pro", "MiniMax-M2.5", "MiniMax-M2.5-Pro"],

    async chatCompletion({ apiKey, model, messages, maxTokens = 4096, temperature = 0.7 }) {
      if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
        throw new Error("Invalid MiniMax API key");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(new DOMException("MiniMax API request timed out after 60 seconds. The server may be slow or the task is too complex.", "TimeoutError")),
        60_000
      );

      try {
        const response = await fetch("https://api.minimaxi.chat/v1/text/chatcompletion_v2", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey.trim()}`
          },
          body: JSON.stringify({
            model: model || "MiniMax-M2.7",
            messages,
            max_tokens: maxTokens,
            temperature: temperature,
            stream: false
          }),
          signal: controller.signal
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new Error(`MiniMax API error ${response.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await response.json();
        return {
          content: data?.choices?.[0]?.message?.content || "No response.",
          raw: data
        };
      } finally {
        clearTimeout(timeoutId);
      }
    }
  });
}
