/**
 * Script de lógica para el popup de configuración de Discord Translator
 */

document.addEventListener('DOMContentLoaded', () => {
  const toggleEnabled = document.getElementById('toggle-enabled');
  const toggleAuto = document.getElementById('toggle-auto');
  const toggleReplace = document.getElementById('toggle-replace');
  const toggleOutgoing = document.getElementById('toggle-outgoing');
  const selectLang = document.getElementById('select-lang');
  const statCount = document.getElementById('stat-count');
  const btnClearCache = document.getElementById('btn-clear-cache');

  // Valores por defecto
  const defaultSettings = {
    enabled: true,
    autoTranslate: true,
    replaceOriginal: true,
    translateOutgoing: true,
    targetLang: 'es'
  };

  // Cargar estado guardado
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(defaultSettings, (items) => {
      toggleEnabled.checked = items.enabled;
      toggleAuto.checked = items.autoTranslate;
      if (toggleReplace) toggleReplace.checked = items.replaceOriginal !== false;
      toggleOutgoing.checked = items.translateOutgoing;
      selectLang.value = items.targetLang || 'es';
      updateDisabledStates(items.enabled);
    });
  }

  // Cargar estadísticas
  loadStats();

  // Listeners de cambio de configuración
  toggleEnabled.addEventListener('change', () => {
    const isEnabled = toggleEnabled.checked;
    chrome.storage.sync.set({ enabled: isEnabled });
    updateDisabledStates(isEnabled);
  });

  toggleAuto.addEventListener('change', () => {
    chrome.storage.sync.set({ autoTranslate: toggleAuto.checked });
  });

  if (toggleReplace) {
    toggleReplace.addEventListener('change', () => {
      chrome.storage.sync.set({ replaceOriginal: toggleReplace.checked });
    });
  }

  toggleOutgoing.addEventListener('change', () => {
    chrome.storage.sync.set({ translateOutgoing: toggleOutgoing.checked });
  });

  selectLang.addEventListener('change', () => {
    chrome.storage.sync.set({ targetLang: selectLang.value });
  });

  // Limpiar caché
  btnClearCache.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearCache' }, (res) => {
      const originalText = btnClearCache.innerHTML;
      btnClearCache.innerHTML = `✓ ¡Limpio!`;
      setTimeout(() => {
        btnClearCache.innerHTML = originalText;
      }, 1500);
    });
  });

  function updateDisabledStates(isEnabled) {
    toggleAuto.disabled = !isEnabled;
    if (toggleReplace) toggleReplace.disabled = !isEnabled;
    toggleOutgoing.disabled = !isEnabled;
    selectLang.disabled = !isEnabled;

    const cards = document.querySelectorAll('.setting-card');
    cards.forEach(card => {
      if (!isEnabled) {
        card.style.opacity = '0.5';
        card.style.pointerEvents = 'none';
      } else {
        card.style.opacity = '1';
        card.style.pointerEvents = 'auto';
      }
    });
  }

  function loadStats() {
    chrome.runtime.sendMessage({ action: 'getStats' }, (res) => {
      if (res && res.stats) {
        statCount.textContent = res.stats.totalTranslated || 0;
      }
    });
  }
});
