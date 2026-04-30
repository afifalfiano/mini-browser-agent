// providers/base.js — Provider Manager

const ProviderManager = (() => {
  const _providers = new Map();

  function register(id, providerDef) {
    _providers.set(id, providerDef);
  }

  function getProvider(id) {
    return _providers.get(id);
  }

  function getProviders() {
    return Array.from(_providers.entries()).map(([id, p]) => ({
      id,
      name: p.name,
      models: p.models
    }));
  }

  /**
   * @param {string} providerId
   * @param {{ apiKey: string, model: string, messages: any[], maxTokens?: number, temperature?: number }} options
   */
  async function chat(providerId, options) {
    const provider = _providers.get(providerId);
    if (!provider) throw new Error(`Provider '${providerId}' not found`);
    return await provider.chatCompletion(options);
  }

  return { register, getProvider, getProviders, chat };
})();

if (typeof window !== "undefined") {
  window.ProviderManager = ProviderManager;
} else if (typeof module !== "undefined") {
  module.exports = { ProviderManager };
}
