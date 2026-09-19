/**
 * Service Worker para Discord Translator
 * Maneja las peticiones de traducción evitando restricciones de CSP/CORS en Discord
 */

// Caché en memoria para respuestas inmediatas
const translationCache = new Map();
const MAX_CACHE_SIZE = 500;

// Inicialización de estadísticas al instalar
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['stats', 'settings'], (result) => {
    if (!result.stats) {
      chrome.storage.local.set({
        stats: { totalTranslated: 0, lastUsed: Date.now() }
      });
    }
    if (!result.settings) {
      chrome.storage.sync.set({
        enabled: true,
        autoTranslate: true,
        replaceOriginal: true,
        targetLang: 'es',
        showOriginalButton: true,
        translateOutgoing: true
      });
    }
  });
});

// Listener de mensajes
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslate(request)
      .then((res) => sendResponse({ success: true, data: res }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // Respuesta asíncrona
  }

  if (request.action === 'clearCache') {
    translationCache.clear();
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'getStats') {
    chrome.storage.local.get(['stats'], (result) => {
      sendResponse({ stats: result.stats || { totalTranslated: 0 } });
    });
    return true;
  }
});

/**
 * Procesa la solicitud de traducción consultando caché o APIs externas
 */
async function handleTranslate({ text, targetLang = 'es', sourceLang = 'auto' }) {
  const trimmed = text.trim();
  if (!trimmed) {
    return { translatedText: '', detectedLang: 'auto', isSameLanguage: false };
  }

  const cacheKey = `${sourceLang}:${targetLang}:${trimmed}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  let result;
  try {
    result = await fetchGoogleTranslate(trimmed, targetLang, sourceLang);
  } catch (primaryError) {
    console.warn('[Discord Translator] Error en Google Translate, probando fallback:', primaryError);
    try {
      result = await fetchMyMemoryTranslate(trimmed, targetLang, sourceLang);
    } catch (fallbackError) {
      throw new Error(`Error al traducir: ${primaryError.message || fallbackError.message}`);
    }
  }

  // Guardar en caché
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    translationCache.delete(firstKey);
  }
  translationCache.set(cacheKey, result);

  // Incrementar contador de estadísticas
  incrementStats();

  return result;
}

/**
 * Traduce usando el endpoint público de Google Translate
 */
async function fetchGoogleTranslate(text, targetLang, sourceLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Google Translate HTTP ${response.status}`);
  }

  const data = await response.json();

  // data[0] contiene fragmentos [[ "traducido", "original", ... ], ...]
  let translatedText = '';
  if (Array.isArray(data[0])) {
    for (const chunk of data[0]) {
      if (chunk && chunk[0]) {
        translatedText += chunk[0];
      }
    }
  }

  const detectedLang = data[2] || 'auto';
  const isSameLanguage = detectedLang.toLowerCase() === targetLang.toLowerCase();

  return {
    translatedText,
    detectedLang,
    isSameLanguage
  };
}

/**
 * Fallback a MyMemory en caso de bloqueo o error
 */
async function fetchMyMemoryTranslate(text, targetLang, sourceLang) {
  const sl = sourceLang === 'auto' ? 'autodetect' : sourceLang;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(sl)}|${encodeURIComponent(targetLang)}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MyMemory HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.responseStatus !== 200 && data.responseStatus !== '200') {
    throw new Error(data.responseDetails || 'Error en MyMemory');
  }

  const translatedText = data.responseData?.translatedText || text;
  const detectedLang = data.matches?.[0]?.['created-by'] || 'auto';

  return {
    translatedText,
    detectedLang,
    isSameLanguage: translatedText.trim().toLowerCase() === text.trim().toLowerCase()
  };
}

function incrementStats() {
  chrome.storage.local.get(['stats'], (res) => {
    const stats = res.stats || { totalTranslated: 0 };
    stats.totalTranslated = (stats.totalTranslated || 0) + 1;
    stats.lastUsed = Date.now();
    chrome.storage.local.set({ stats });
  });
}
