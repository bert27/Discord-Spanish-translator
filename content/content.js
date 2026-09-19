/**
 * Content Script para Discord Translator
 * Inyecta botones de traducción, maneja traducción automática y muestra resultados
 */

(function () {
  'use strict';

  // Configuración por defecto
  let settings = {
    enabled: true,
    autoTranslate: true,
    replaceOriginal: true, // Reemplazar directamente el texto en inglés por español
    targetLang: 'es',
    showOriginalButton: true,
    translateOutgoing: true
  };

  // Cargar configuración guardada
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(settings, (loadedSettings) => {
      settings = { ...settings, ...loadedSettings };
      if (settings.enabled) {
        initObserver();
        initInputTranslator();
      }
    });

    // Escuchar cambios de configuración en vivo
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'sync') {
        for (const [key, { newValue }] of Object.entries(changes)) {
          settings[key] = newValue;
        }
        if (!settings.enabled) {
          removeInjectedElements();
        } else {
          processExistingMessages();
          initInputTranslator();
        }
      }
    });
  }

  // SVG Icons
  const GLOBE_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm7.93 9h-3.18a15.7 15.7 0 0 0-1.39-5.12A8.02 8.02 0 0 1 19.93 11zM12 4.07a13.72 13.72 0 0 1 2.5 6.93H9.5A13.72 13.72 0 0 1 12 4.07zM4.07 13h3.18a15.7 15.7 0 0 0 1.39 5.12A8.02 8.02 0 0 1 4.07 13zm3.18-2H4.07a8.02 8.02 0 0 1 4.57-5.12A15.7 15.7 0 0 0 7.25 11zM12 19.93a13.72 13.72 0 0 1-2.5-6.93h5a13.72 13.72 0 0 1-2.5 6.93zm3.36-1.81A15.7 15.7 0 0 0 16.75 13h3.18a8.02 8.02 0 0 1-4.57 5.12z"/>
    </svg>
  `;

  const COPY_SVG = `
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
  `;

  /**
   * Observador de mutaciones para detectar nuevos mensajes dinámicamente
   */
  let observer = null;

  function initObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      if (!settings.enabled) return;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              checkAndProcessNode(node);
            }
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    processExistingMessages();
  }

  /**
   * Procesa mensajes ya cargados en el DOM
   */
  function processExistingMessages() {
    const messages = document.querySelectorAll('[id^="message-content-"], div[class*="messageContent"]');
    messages.forEach((msg) => processMessageElement(msg));
  }

  function checkAndProcessNode(node) {
    if (node.matches && (node.matches('[id^="message-content-"]') || node.matches('div[class*="messageContent"]'))) {
      processMessageElement(node);
      return;
    }

    if (node.querySelectorAll) {
      const messages = node.querySelectorAll('[id^="message-content-"], div[class*="messageContent"]');
      messages.forEach((msg) => processMessageElement(msg));
    }
  }

  /**
   * Añade el botón de traducción o reemplaza directamente el texto al español
   */
  function processMessageElement(messageElement) {
    if (!messageElement || messageElement.dataset.dtProcessed) return;

    // Verificar si el mensaje tiene texto real
    const rawText = messageElement.innerText ? messageElement.innerText.trim() : '';
    if (!rawText) return;

    messageElement.dataset.dtProcessed = 'true';

    // Si está activo el reemplazo directo y traducción automática
    if (settings.autoTranslate && settings.replaceOriginal) {
      executeInPlaceTranslation(messageElement, rawText);
      return;
    }

    // Si no está en modo reemplazo directo, creamos el botón manual
    const btnWrapper = document.createElement('div');
    btnWrapper.className = 'discord-translator-btn-wrapper';

    const translateBtn = document.createElement('button');
    translateBtn.className = 'discord-translator-btn';
    translateBtn.setAttribute('type', 'button');
    translateBtn.setAttribute('title', 'Traducir este mensaje al español');
    translateBtn.innerHTML = `${GLOBE_SVG}<span>Traducir</span>`;

    btnWrapper.appendChild(translateBtn);
    messageElement.insertAdjacentElement('afterend', btnWrapper);

    translateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      executeTranslation(messageElement, btnWrapper, translateBtn, rawText);
    });

    if (settings.autoTranslate) {
      executeTranslation(messageElement, btnWrapper, translateBtn, rawText, true);
    }
  }

  /**
   * Reemplaza el texto en inglés directamente por español en el mismo mensaje
   */
  function executeInPlaceTranslation(messageElement, text) {
    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: text,
        targetLang: settings.targetLang || 'es'
      },
      (response) => {
        if (!response || !response.success || !response.data) return;

        const { translatedText, isSameLanguage } = response.data;
        if (isSameLanguage || !translatedText) return;

        // Verificar si ya fue envuelto
        if (messageElement.querySelector('.dt-translated-content')) return;

        // Envolver los nodos originales en un span oculto (display: none)
        const originalWrapper = document.createElement('span');
        originalWrapper.className = 'dt-original-hidden';

        while (messageElement.firstChild) {
          originalWrapper.appendChild(messageElement.firstChild);
        }

        // Crear el span visible con el texto traducido al español
        const translatedSpan = document.createElement('span');
        translatedSpan.className = 'dt-translated-content';
        translatedSpan.textContent = translatedText;

        // Indicador sutil de traducción
        const indicator = document.createElement('span');
        indicator.className = 'dt-translated-indicator';
        indicator.setAttribute('title', 'Traducido al español. Clic para alternar original');
        indicator.innerHTML = '🌐';
        indicator.addEventListener('click', (e) => {
          e.stopPropagation();
          const isHidden = originalWrapper.classList.contains('dt-original-hidden');
          if (isHidden) {
            originalWrapper.classList.remove('dt-original-hidden');
            translatedSpan.style.display = 'none';
          } else {
            originalWrapper.classList.add('dt-original-hidden');
            translatedSpan.style.display = 'inline';
          }
        });

        messageElement.appendChild(originalWrapper);
        messageElement.appendChild(translatedSpan);
        messageElement.appendChild(indicator);
      }
    );
  }

  /**
   * Realiza la llamada de traducción y maneja la respuesta
   */
  function executeTranslation(messageElement, btnWrapper, translateBtn, text, isAuto = false) {
    if (translateBtn.classList.contains('loading')) return;

    // Buscar si ya existe una caja de traducción para este mensaje
    let resultBox = btnWrapper.parentElement.querySelector(`.discord-translator-result[data-for="${messageElement.id || ''}"]`);
    if (resultBox) {
      // Alternar visibilidad si ya existe
      resultBox.style.display = resultBox.style.display === 'none' ? 'block' : 'none';
      return;
    }

    // Activar estado de carga
    translateBtn.classList.add('loading');
    translateBtn.innerHTML = `<span class="discord-translator-spinner"></span><span>Traduciendo...</span>`;

    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: text,
        targetLang: settings.targetLang || 'es'
      },
      (response) => {
        translateBtn.classList.remove('loading');

        if (!response || !response.success || !response.data) {
          translateBtn.innerHTML = `${GLOBE_SVG}<span>Error al traducir</span>`;
          setTimeout(() => {
            translateBtn.innerHTML = `${GLOBE_SVG}<span>Reintentar</span>`;
          }, 3000);
          return;
        }

        const { translatedText, detectedLang, isSameLanguage } = response.data;

        // Si ya está en español y es automático, no creamos ruido innecesario
        if (isSameLanguage && isAuto) {
          translateBtn.style.display = 'none';
          return;
        }

        if (isSameLanguage) {
          translateBtn.innerHTML = `${GLOBE_SVG}<span>Ya está en ${settings.targetLang.toUpperCase()}</span>`;
          setTimeout(() => {
            translateBtn.innerHTML = `${GLOBE_SVG}<span>Traducir</span>`;
          }, 2500);
          return;
        }

        // Crear la caja con la traducción
        renderTranslationBox(messageElement, btnWrapper, translatedText, detectedLang);
        translateBtn.innerHTML = `${GLOBE_SVG}<span>Traducido</span>`;
      }
    );
  }

  /**
   * Renderiza la tarjeta estilizada con la traducción
   */
  function renderTranslationBox(messageElement, btnWrapper, translatedText, detectedLang) {
    // Remover caja previa si existía
    const existingBox = btnWrapper.parentElement.querySelector('.discord-translator-result');
    if (existingBox) existingBox.remove();

    const box = document.createElement('div');
    box.className = 'discord-translator-result';
    if (messageElement.id) {
      box.dataset.for = messageElement.id;
    }

    const langLabel = detectedLang ? `${detectedLang.toUpperCase()} ➔ ${settings.targetLang.toUpperCase()}` : `ESPAÑOL`;

    box.innerHTML = `
      <div class="discord-translator-header">
        <span class="discord-translator-badge">${GLOBE_SVG} ${langLabel}</span>
        <div class="discord-translator-actions">
          <button class="discord-translator-action-btn dt-copy-btn" title="Copiar traducción">
            ${COPY_SVG} Copiar
          </button>
          <button class="discord-translator-action-btn dt-hide-btn" title="Ocultar traducción">
            ✕ Ocultar
          </button>
        </div>
      </div>
      <div class="discord-translator-text">${escapeHtml(translatedText)}</div>
    `;

    // Evento para copiar
    const copyBtn = box.querySelector('.dt-copy-btn');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(translatedText).then(() => {
        copyBtn.innerHTML = `✓ Copiado`;
        setTimeout(() => {
          copyBtn.innerHTML = `${COPY_SVG} Copiar`;
        }, 2000);
      });
    });

    // Evento para ocultar
    const hideBtn = box.querySelector('.dt-hide-btn');
    hideBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      box.style.display = 'none';
    });

    btnWrapper.insertAdjacentElement('afterend', box);
  }

  /**
   * Botón de traducción en la barra de entrada de texto de Discord (para enviar mensajes traducidos)
   */
  let inputObserver = null;

  function initInputTranslator() {
    if (!settings.translateOutgoing) return;

    setInterval(() => {
      if (!settings.enabled || !settings.translateOutgoing) return;
      attachToChatInput();
    }, 1500);
  }

  function attachToChatInput() {
    const chatBar = document.querySelector('form div[class*="buttons-"], form div[class*="channelTextArea"] div[class*="buttons"]');
    if (!chatBar || chatBar.querySelector('.discord-translator-input-btn')) return;

    const translateInputBtn = document.createElement('button');
    translateInputBtn.className = 'discord-translator-input-btn';
    translateInputBtn.setAttribute('type', 'button');
    translateInputBtn.setAttribute('title', 'Traducir mensaje antes de enviar (al inglés u otro idioma)');
    translateInputBtn.innerHTML = GLOBE_SVG;

    translateInputBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleOutgoingTranslation(translateInputBtn);
    });

    chatBar.prepend(translateInputBtn);
  }

  /**
   * Traduce el texto que el usuario está escribiendo en el chat de Discord
   */
  function handleOutgoingTranslation(button) {
    const slateEditor = document.querySelector('[role="textbox"]');
    if (!slateEditor) {
      showToast('No se encontró el cuadro de texto del chat');
      return;
    }

    const currentText = slateEditor.innerText ? slateEditor.innerText.trim() : '';
    if (!currentText) {
      showToast('Escribe algo en el chat primero para traducirlo');
      return;
    }

    // Idioma destino al enviar: si el usuario escribe en español, traducir por defecto al inglés ('en') o al idioma opuesto
    const targetOutLang = settings.targetLang === 'es' ? 'en' : 'es';

    button.classList.add('active');
    showToast(`Traduciendo al ${targetOutLang === 'en' ? 'Inglés' : 'Español'}...`);

    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: currentText,
        targetLang: targetOutLang,
        sourceLang: 'auto'
      },
      (response) => {
        button.classList.remove('active');

        if (!response || !response.success || !response.data) {
          showToast('Error al traducir el mensaje');
          return;
        }

        const translated = response.data.translatedText;
        replaceSlateText(slateEditor, translated);
        showToast(`Mensaje traducido al ${targetOutLang.toUpperCase()}`);
      }
    );
  }

  /**
   * Reemplaza el texto dentro del editor Slate de Discord preservando el estado de React
   */
  function replaceSlateText(editor, newText) {
    editor.focus();

    // Seleccionar todo el contenido actual del editor
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection.removeAllRanges();
    selection.addRange(range);

    // Usar insertText para que Slate y React capturen el evento input
    document.execCommand('insertText', false, newText);
  }

  function showToast(message) {
    const existing = document.querySelector('.discord-translator-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'discord-translator-toast';
    toast.innerHTML = `${GLOBE_SVG}<span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function removeInjectedElements() {
    document.querySelectorAll('.dt-translated-content, .dt-translated-indicator').forEach(el => el.remove());
    document.querySelectorAll('.dt-original-hidden').forEach(el => {
      const parent = el.parentNode;
      while (el.firstChild) {
        parent.insertBefore(el.firstChild, el);
      }
      el.remove();
    });
    document.querySelectorAll('.discord-translator-btn-wrapper, .discord-translator-result, .discord-translator-input-btn').forEach(el => el.remove());
    document.querySelectorAll('[data-dt-processed]').forEach(el => el.removeAttribute('data-dt-processed'));
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();
