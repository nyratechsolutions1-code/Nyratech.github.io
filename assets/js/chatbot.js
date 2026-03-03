/* chatbot.js - vanilla JS chatbot, contact storage, and admin panel logic */
(function() {
  const BOT_RESPONSES_KEY = 'botResponses';
  const SUGGESTED_KEY = 'suggestedQuestions';
  const CONTACTS_KEY = 'contactSubmissions';
  const LAST_VIEWED_CONTACTS_KEY = 'lastViewedContacts';
  const CHAT_CONVERSATION_KEY = 'chatConversation';
  const ADMIN_SESSION_KEY = 'adminSession';
  const SITE_HITS_KEY = 'siteHits';
  const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  const defaultResponses = {
    "What services do you offer?": "We provide enterprise software development, AI solutions, cloud engineering, and custom web applications.",
    "How can I contact you?": "You can reach us at +91 8928629182 or email NehaSingh@nyratechsolutions.com",
    "What technologies do you use?": "We work with React, Node.js, Python, AI/ML frameworks, and cloud platforms like AWS and Azure.",
    "Where are you located?": "We're based in Pune/PCMC, Maharashtra, India.",
    "Tell me about NyraTech": "NyraTech Solutions is a technology company specializing in enterprise software, AI, and cloud solutions. We're pioneers in Human-AI collaboration."
  };

  const defaultSuggestions = [
    "What services do you offer?",
    "How can I contact you?",
    "Tell me about NyraTech"
  ];

  // server-backed storage state
  let usingServer = false;
  let serverData = null;
  const SERVER_ENDPOINT = '/api/data'; // POST/GET JSON

  function initServerStorage() {
    return fetch(SERVER_ENDPOINT)
      .then(r=>{
        if (!r.ok) throw new Error('no server response');
        return r.json();
      })
      .then(obj=>{
        serverData = obj || {};
        usingServer = true;
      })
      .catch(err=>{
        console.warn('server storage unavailable', err);
        usingServer = false;
      });
  }

  function syncServer() {
    if (!usingServer || !serverData) return;
    fetch(SERVER_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(serverData)
    }).catch(e=>console.error('sync failed', e));
  }

  // storage helpers -------------------------------------------------------
  // The module now supports exporting/importing all store data to a text file
  // from the admin panel. LocalStorage remains the primary store but is backed
  // up when the user exports, and can be restored from a .txt file on import.

  function loadBotResponses() {
    if (usingServer && serverData && serverData.botResponses) {
      return serverData.botResponses;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(BOT_RESPONSES_KEY));
      if (stored && typeof stored === 'object') return stored;
    } catch (e) {}
    localStorage.setItem(BOT_RESPONSES_KEY, JSON.stringify(defaultResponses));
    return Object.assign({}, defaultResponses);
  }

  function saveBotResponses(obj) {
    if (usingServer) {
      serverData = serverData || {};
      serverData.botResponses = obj;
      syncServer();
    }
    try { localStorage.setItem(BOT_RESPONSES_KEY, JSON.stringify(obj)); } catch (e) {}
  }

  function loadSuggestions() {
    if (usingServer && serverData && Array.isArray(serverData.suggestions)) {
      return serverData.suggestions;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(SUGGESTED_KEY));
      if (Array.isArray(stored) && stored.length > 0) return stored;
    } catch (e) {}
    // if nothing stored yet or stored array is empty, reset to defaults
    localStorage.setItem(SUGGESTED_KEY, JSON.stringify(defaultSuggestions));
    return defaultSuggestions.slice();
  }

  function saveSuggestions(arr) {
    if (usingServer) {
      serverData = serverData || {};
      serverData.suggestions = arr;
      syncServer();
    }
    try { localStorage.setItem(SUGGESTED_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function loadContacts() {
    if (usingServer && serverData && Array.isArray(serverData.contacts)) {
      return serverData.contacts;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(CONTACTS_KEY));
      if (Array.isArray(stored)) return stored;
    } catch (e) {}
    return [];
  }

  function saveContacts(arr) {
    if (usingServer) {
      serverData = serverData || {};
      serverData.contacts = arr;
      syncServer();
    }
    try { localStorage.setItem(CONTACTS_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  function updateBadgeCount() {
    const last = localStorage.getItem(LAST_VIEWED_CONTACTS_KEY) || 0;
    const contacts = loadContacts();
    const newCount = contacts.filter(c => new Date(c.timestamp) > new Date(last)).length;
    const badge = document.querySelector('#chatbot-button .badge');
    if (badge) {
      if (newCount > 0) {
        badge.textContent = newCount;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }
    // also update admin tab badge if present
    const adminBadge = document.getElementById('contacts-badge');
    if (adminBadge) {
      if (newCount > 0) {
        adminBadge.textContent = newCount;
        adminBadge.style.display = 'inline-block';
      } else {
        adminBadge.style.display = 'none';
      }
    }
  }

  // chat conversation state ------------------------------------------------
  function loadConversation() {
    try {
      const stored = JSON.parse(sessionStorage.getItem(CHAT_CONVERSATION_KEY));
      if (Array.isArray(stored)) return stored;
    } catch (e) {}
    return [];
  }
  function saveConversation(arr) {
    try { sessionStorage.setItem(CHAT_CONVERSATION_KEY, JSON.stringify(arr)); } catch (e) {}
  }

  // utilities -------------------------------------------------------------
  function formatTime(date) {
    const d = new Date(date);
    return d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }

  // export/import helpers --------------------------------------------------
  // collects current data into a single object for export
  function collectAllData() {
    if (usingServer && serverData) {
      // clone to avoid mutation
      return JSON.parse(JSON.stringify(serverData));
    }
    return {
      botResponses: loadBotResponses(),
      suggestions: loadSuggestions(),
      contacts: loadContacts(),
      siteHits: loadHits()
    };
  }

  function exportData() {
    const data = collectAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chatbot-data.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function importDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const obj = JSON.parse(e.target.result);
        if (obj.botResponses) localStorage.setItem(BOT_RESPONSES_KEY, JSON.stringify(obj.botResponses));
        if (obj.suggestions) localStorage.setItem(SUGGESTED_KEY, JSON.stringify(obj.suggestions));
        if (obj.contacts) localStorage.setItem(CONTACTS_KEY, JSON.stringify(obj.contacts));
        if (obj.siteHits != null) localStorage.setItem(SITE_HITS_KEY, String(obj.siteHits));
        // refresh UI
        updateSuggestionButtons();
        updateBadgeCount();
        updateHitsDisplay();
        alert('Data imported successfully.');
      } catch (err) {
        console.error('import error', err);
        alert('Could not parse import file.');
      }
    };
    reader.readAsText(file);
  }

  function promptImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json';
    input.onchange = function() {
      if (input.files.length) importDataFromFile(input.files[0]);
    };
    input.click();
  }

  // site hit counter ------------------------------------------------------
  function loadHits() {
    if (usingServer && serverData && typeof serverData.siteHits === 'number') {
      return serverData.siteHits;
    }
    const h = parseInt(localStorage.getItem(SITE_HITS_KEY), 10);
    return isNaN(h) ? 0 : h;
  }
  function saveHits(n) {
    if (usingServer) {
      serverData = serverData || {};
      serverData.siteHits = n;
      syncServer();
    }
    try { localStorage.setItem(SITE_HITS_KEY, String(n)); } catch (e) {}
  }
  function incrementHits() {
    const count = loadHits() + 1;
    saveHits(count);
    return count;
  }
  function updateHitsDisplay() {
    const el = document.getElementById('hits-number');
    if (el) {
      el.textContent = loadHits();
    }
  }

  // chat UI ---------------------------------------------------------------
  let chatWindow, chatButton;

  function createChatUI() {
    // ensure styles for chat window exist (responsive/mobile friendly)
    applyChatStyles();
    // button
    chatButton = document.createElement('div');
    chatButton.id = 'chatbot-button';
    chatButton.innerHTML = '<i class="bi bi-chat-dots" style="font-size:1.5rem;color:#fff"></i><span class="badge" style="display:none;"></span>';
    document.body.appendChild(chatButton);
    chatButton.addEventListener('click', toggleChat);

    // window
    chatWindow = document.createElement('div');
    chatWindow.id = 'chatbot-window';
    chatWindow.innerHTML = `
      <div id="chatbot-header">
        <span class="title">NyraBot</span>
        <div class="controls">
          <button id="btn-clear" title="Clear Chat">🗑️</button>
          <button id="btn-minimize" title="Minimize">➖</button>
          <button id="btn-close" title="Close">✖️</button>
        </div>
      </div>
      <div id="chatbot-messages"></div>
      <div id="chatbot-typing">NyraBot is typing...</div>
      <div id="chatbot-input-area">
        <div id="chatbot-suggestions"></div>
        <input type="text" id="chatbot-input" placeholder="Type your message...">
        <button class="send-button">Send</button>
      </div>
    `;
    document.body.appendChild(chatWindow);

    document.getElementById('btn-close').addEventListener('click', closeChat);
    document.getElementById('btn-minimize').addEventListener('click', minimizeChat);
    document.getElementById('btn-clear').addEventListener('click', clearChat);
    chatWindow.querySelector('.send-button').addEventListener('click', onSendClicked);
    chatWindow.querySelector('#chatbot-input').addEventListener('keypress', function(e){
      if (e.key === 'Enter') { e.preventDefault(); onSendClicked(); }
    });

    makeDraggable(chatWindow, document.getElementById('chatbot-header'));
    updateSuggestionButtons();
    updateBadgeCount();
  }

  function toggleChat() {
    if (chatWindow.style.display === 'flex') {
      chatWindow.style.display = 'none';
    } else {
      chatWindow.style.display = 'flex';
      chatWindow.style.opacity = '1';
    }
  }
  function closeChat() { chatWindow.style.display = 'none'; }
  function minimizeChat() { chatWindow.style.display = 'none'; }
  function clearChat() {
    const msgDiv = document.getElementById('chatbot-messages');
    msgDiv.innerHTML = '';
    saveConversation([]);
  }

  function showTyping(show) {
    const el = document.getElementById('chatbot-typing');
    el.style.display = show ? 'block' : 'none';
  }

  function addMessage(text, sender) {
    const msgDiv = document.getElementById('chatbot-messages');
    const wrapper = document.createElement('div');
    wrapper.className = 'message ' + sender;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = text; // support HTML
    wrapper.appendChild(bubble);
    const timeEl = document.createElement('div');
    timeEl.className = 'timestamp';
    timeEl.textContent = formatTime(new Date());
    wrapper.appendChild(timeEl);
    msgDiv.appendChild(wrapper);
    msgDiv.scrollTop = msgDiv.scrollHeight;

    // save conversation
    const conv = loadConversation();
    conv.push({sender, text, time: new Date().toISOString()});
    saveConversation(conv);
  }

  function onSendClicked() {
    const input = document.getElementById('chatbot-input');
    let text = input.value.trim();
    if (!text) return;
    addMessage(text, 'user');
    input.value = '';
    // handle response
    showTyping(true);
    setTimeout(() => {
      showTyping(false);
      const reply = getBotReply(text);
      addMessage(reply, 'bot');
    }, 800);
  }

  function getBotReply(userText) {
    const responses = loadBotResponses();
    const key = Object.keys(responses).find(q => q.toLowerCase() === userText.toLowerCase());
    if (key) return responses[key];
    return "Sorry, I don't understand that yet. You can try another question.";
  }

  function updateSuggestionButtons() {
    const container = document.getElementById('chatbot-suggestions');
    container.innerHTML = '';
    const sug = loadSuggestions();
    sug.forEach(q => {
      const btn = document.createElement('button');
      btn.textContent = q;
      btn.addEventListener('click', () => {
        document.getElementById('chatbot-input').value = q;
        onSendClicked();
      });
      container.appendChild(btn);
    });
  }

  function makeDraggable(elem, handle) {
    let isDragging = false;
    let offsetX = 0, offsetY = 0;
    handle.addEventListener('mousedown', function(e){
      isDragging = true;
      offsetX = e.clientX - elem.offsetLeft;
      offsetY = e.clientY - elem.offsetTop;
      document.addEventListener('mousemove', onDrag);
      document.addEventListener('mouseup', onDrop);
    });
    function onDrag(e) {
      if (!isDragging) return;
      elem.style.left = (e.clientX - offsetX) + 'px';
      elem.style.top = (e.clientY - offsetY) + 'px';
    }
    function onDrop() {
      isDragging = false;
      document.removeEventListener('mousemove', onDrag);
      document.removeEventListener('mouseup', onDrop);
    }
  }


  // chat style injection --------------------------------------------------
  function applyChatStyles() {
    if (document.getElementById('chatbot-style')) return; // only once
    const style = document.createElement('style');
    style.id = 'chatbot-style';
    style.textContent = `
      #chatbot-button {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background:#007bff;
        border-radius:50%;
        width:50px;
        height:50px;
        display:flex;
        align-items:center;
        justify-content:center;
        cursor:pointer;
        z-index:10000;
      }
      #chatbot-window {
        position: fixed;
        bottom: 80px;
        right: 20px;
        width: 350px;
        max-width: 90%;
        height: 500px;
        max-height: 90%;
        background: #fff;
        border: 1px solid #ccc;
        display: none;
        flex-direction: column;
        z-index:10000;
        box-shadow: 0 0 10px rgba(0,0,0,.2);
      }
      #chatbot-window #chatbot-messages {
        flex:1;
        overflow-y:auto;
        padding:10px;
      }
      #chatbot-window #chatbot-input-area {
        display:flex;
        border-top:1px solid #ddd;
        padding:5px;
      }
      #chatbot-window #chatbot-input-area input {
        flex:1;
        padding:5px;
      }
      #chatbot-window #chatbot-input-area .send-button {
        margin-left:5px;
      }
      #chatbot-suggestions {
        padding:5px;
        display:flex;
        flex-wrap:wrap;
        gap:5px;
      }
      #chatbot-suggestions button {
        flex:1 1 auto;
        padding:4px 6px;
        font-size:0.9rem;
        white-space:normal;
      }
      /* responsive adjustments */
      @media (max-width: 600px) {
        #chatbot-button { bottom:10px; right:10px; }
        #chatbot-window {
          bottom:0;
          right:0;
          width:100%;
          height:100%;
          border-radius:0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // contact form ----------------------------------------------------------
  function initContactForm() {
    const form = document.querySelector('form.php-email-form');
    if (!form) return;
    let isSubmitting = false;

    // Use a capturing listener so we can stop other non-capturing listeners
    // (such as the vendor php-email-form validator) from also handling submit.
    function handleChatbotSubmit(e) {
      e.preventDefault();
      // prevent other listeners from running (stop propagation to bubble phase)
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      if (e.stopPropagation) e.stopPropagation();

      if (isSubmitting) return;
      isSubmitting = true;

      const errMsg = form.querySelector('.error-message');
      if (errMsg) errMsg.style.display = 'none';
      const sentMsg = form.querySelector('.sent-message');
      if (sentMsg) sentMsg.style.display = 'none';

      const nameInput = form.querySelector('input[name="name"]');
      const emailInput = form.querySelector('input[name="email"]');
      const phoneInput = form.querySelector('input[name="phone"]');
      const companyInput = form.querySelector('input[name="company"]');
      const serviceInput = form.querySelector('select[name="service"]');
      const messageInput = form.querySelector('textarea[name="message"]');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';
      const company = companyInput ? companyInput.value.trim() : '';
      const service = serviceInput ? serviceInput.value : '';
      const message = messageInput ? messageInput.value.trim() : '';

      if (!name || !email || !message) {
        isSubmitting = false;
        showValidationErrorModal('Please fill in all required fields (Name, Email, and Message)');
        return;
      }
      if (!service) {
        isSubmitting = false;
        showValidationErrorModal('Please select a service interest');
        return;
      }

      try {
        const contacts = loadContacts();
        contacts.push({name, email, phone, company, service, message, timestamp: new Date().toISOString()});
        saveContacts(contacts);
        updateBadgeCount();
        showThankYouModal();
        form.reset();
      } catch (error) {
        console.error('Error saving contact:', error);
        showValidationErrorModal('Error saving your message. Please try again.');
      }

      isSubmitting = false;
      // small timeout to signal submission complete
      setTimeout(()=>{
        try { form.dispatchEvent(new Event('chatbot:submitted')); } catch(e){}
      }, 50);
    }

    // attach as capturing listener so it runs before bubble listeners and can block them
    form.addEventListener('submit', handleChatbotSubmit, true);
  }

  function showValidationErrorModal(message) {
    const existingModal = document.getElementById('errorModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'errorModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white border-0">
            <h5 class="modal-title">Error</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center py-4">
            <i class="bi bi-exclamation-circle text-primary" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
            <p style="font-size: 1rem; margin-bottom: 0;">${message}</p>
          </div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
  }

  function showThankYouModal() {
    const existingModal = document.getElementById('thankYouModal');
    if (existingModal) {
      existingModal.remove();
    }
    
    const modal = document.createElement('div');
    modal.id = 'thankYouModal';
    modal.className = 'modal fade';
    modal.setAttribute('tabindex', '-1');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML = `
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header bg-primary text-white border-0">
            <h5 class="modal-title">Thank You!</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body text-center py-4">
            <i class="bi bi-check-circle text-primary" style="font-size: 3rem; margin-bottom: 15px; display: block;"></i>
            <p style="font-size: 1.1rem; margin-bottom: 0;">Thank you for your message! We will get back to you soon.</p>
          </div>
          <div class="modal-footer border-0">
            <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    modal.addEventListener('hidden.bs.modal', () => modal.remove());
  }

  // admin panel -----------------------------------------------------------
  function initAdminPanel() {
    if (!document.body.classList.contains('admin-panel')) return;
    checkSession();
    const loginForm = document.getElementById('admin-login-form');
    const dashboard = document.getElementById('dashboard-box'); // corrected ID
    if (loginForm) {
      loginForm.addEventListener('submit', function(e){
        e.preventDefault();
        const user = loginForm.querySelector('input[name="username"]').value;
        const pass = loginForm.querySelector('input[name="password"]').value;
        if (user === 'admin' && pass === 'nyratech2025') {
          createSession();
          showDashboard();
        } else {
          alert('Invalid credentials');
        }
      });
    }
    if (dashboard) {
      document.getElementById('logout-btn').addEventListener('click', logout);
      // add export / import buttons if not already present
      if (!document.getElementById('export-data-btn')) {
        const ctrlDiv = document.createElement('div');
        ctrlDiv.className = 'mb-3';
        ctrlDiv.innerHTML = `
          <button id="export-data-btn" class="btn btn-sm btn-secondary me-2">Export Data</button>
          <button id="import-data-btn" class="btn btn-sm btn-secondary">Import Data</button>
        `;
        dashboard.insertBefore(ctrlDiv, dashboard.firstChild);
        document.getElementById('export-data-btn').addEventListener('click', exportData);
        document.getElementById('import-data-btn').addEventListener('click', promptImport);
      }
      // load tabs content
      loadContactsTable();
      loadBotResponsesEditor();
      loadSuggestionsEditor();
    }
  }

  function checkSession() {
    const s = JSON.parse(sessionStorage.getItem(ADMIN_SESSION_KEY) || '{}');
    if (s.loggedIn && s.start && (Date.now() - s.start) < SESSION_TIMEOUT_MS) {
      showDashboard();
    } else {
      // clear any expired or invalid session, but don't trigger reload loop
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      // the login form remains visible by default
    }
  }

  function createSession() {
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({loggedIn:true,start:Date.now()}));
  }

  function logout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem(LAST_VIEWED_CONTACTS_KEY);
    window.location.reload();
  }

  function showDashboard() {
    const loginBox = document.getElementById('login-box');
    const dash = document.getElementById('dashboard-box');
    if (loginBox) loginBox.style.display = 'none';
    if (dash) dash.style.display = 'block';
    localStorage.setItem(LAST_VIEWED_CONTACTS_KEY, new Date().toISOString());
    updateBadgeCount();
    updateHitsDisplay();
  }

  // contacts table
  function loadContactsTable() {
    const tbody = document.getElementById('contacts-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const contacts = loadContacts();
    contacts.forEach((c,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${c.name}</td><td>${c.email}</td><td>${c.company||''}</td><td>${c.service||''}</td><td>${c.phone||''}</td><td>${formatTime(c.timestamp)}</td><td>${c.message}</td><td><button class="btn btn-sm btn-danger" data-index="${i}">Delete</button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('button[data-index]').forEach(btn=>{
      btn.addEventListener('click',function(){
        const idx = +this.dataset.index;
        contacts.splice(idx,1);
        saveContacts(contacts);
        loadContactsTable();
      });
    });
  }

  // bot responses editor
  function loadBotResponsesEditor() {
    const container = document.getElementById('bot-responses-container');
    if (!container) return;
    const responses = loadBotResponses();
    container.innerHTML = '';
    Object.keys(responses).forEach(q=>{
      const row = document.createElement('div');
      row.className = 'mb-3';
      row.innerHTML = `
        <div class="input-group">
          <input type="text" class="form-control question" value="${q}">
          <input type="text" class="form-control answer" value="${responses[q].replace(/"/g,'\"')}">
          <button class="btn btn-danger btn-sm delete">Delete</button>
        </div>
      `;
      container.appendChild(row);
    });
    // add new
    const addBtn = document.getElementById('add-bot-qna');
    if (addBtn) {
      addBtn.onclick = function(){
        const row = document.createElement('div');
        row.className='mb-3';
        row.innerHTML = `<div class="input-group">
          <input type="text" class="form-control question" placeholder="Question">
          <input type="text" class="form-control answer" placeholder="Answer">
          <button class="btn btn-danger btn-sm delete">Delete</button>
        </div>`;
        container.appendChild(row);
        attachRowEvents(row);
      };
    }
    // attach events to existing
    container.querySelectorAll('.input-group').forEach(attachRowEvents);
  }

  function attachRowEvents(row) {
    const del = row.querySelector('.delete');
    del.addEventListener('click',()=>{
      row.remove();
      persistBotResponses();
    });
    row.querySelectorAll('input').forEach(inp=>{
      inp.addEventListener('input',persistBotResponses);
    });
  }

  function persistBotResponses() {
    const container = document.getElementById('bot-responses-container');
    const pairs = {};
    container.querySelectorAll('.input-group').forEach(group=>{
      const q = group.querySelector('.question').value.trim();
      const a = group.querySelector('.answer').value.trim();
      if (q && a) pairs[q] = a;
    });
    saveBotResponses(pairs);
  }

  // suggestions editor
  function loadSuggestionsEditor() {
    const container = document.getElementById('suggestions-container');
    if (!container) return;
    const arr = loadSuggestions();
    container.innerHTML = '';
    arr.forEach((q,i)=>{
      const div = document.createElement('div');
      div.className='input-group mb-2';
      div.innerHTML = `<input type="text" class="form-control" value="${q}"><button class="btn btn-danger btn-sm delete" data-index="${i}">Delete</button>`;
      container.appendChild(div);
    });
    const addBtn = document.getElementById('add-suggestion');
    if (addBtn) {
      addBtn.onclick = function(){
        const div = document.createElement('div');
        div.className='input-group mb-2';
        div.innerHTML = `<input type="text" class="form-control" placeholder="Suggestion"><button class="btn btn-danger btn-sm delete">Delete</button>`;
        container.appendChild(div);
        attachSuggestionRow(div);
      };
    }
    container.querySelectorAll('.input-group').forEach(attachSuggestionRow);
  }

  function attachSuggestionRow(div) {
    const inp = div.querySelector('input');
    const del = div.querySelector('.delete');
    inp.addEventListener('input',persistSuggestions);
    del.addEventListener('click',()=>{ div.remove(); persistSuggestions(); });
  }

  function persistSuggestions() {
    const container = document.getElementById('suggestions-container');
    const arr = [];
    container.querySelectorAll('input').forEach(inp=>{
      const v = inp.value.trim(); if (v) arr.push(v);
    });
    saveSuggestions(arr);
    updateSuggestionButtons();
  }

  // run init
  async function tryLoadFileBackup() {
    try {
      const resp = await fetch('chatbot-data.txt');
      if (!resp.ok) return;
      const text = await resp.text();
      const obj = JSON.parse(text);
      if (obj) {
        if (obj.botResponses) localStorage.setItem(BOT_RESPONSES_KEY, JSON.stringify(obj.botResponses));
        if (obj.suggestions) localStorage.setItem(SUGGESTED_KEY, JSON.stringify(obj.suggestions));
        if (obj.contacts) localStorage.setItem(CONTACTS_KEY, JSON.stringify(obj.contacts));
        if (obj.siteHits != null) localStorage.setItem(SITE_HITS_KEY, String(obj.siteHits));
      }
    } catch (e) {
      // silent if file missing or invalid
      console.debug('no backup file or invalid format');
    }
  }

  document.addEventListener('DOMContentLoaded', async function() {
    // initialise server-backed store if available
    await initServerStorage();
    // if a static backup file exists, load its contents too (optional)
    await tryLoadFileBackup();

    // increment hit counter each page load
    incrementHits();

    createChatUI();
    initContactForm();
    updateBadgeCount();
    initAdminPanel();
    // restore conversation if any
    const conv = loadConversation();
    if (conv.length) {
      conv.forEach(m => addMessage(m.text, m.sender));
    }
  });
})();
