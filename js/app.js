(() => {
  "use strict";

  const TL_CENTER = { lat: -20.7848, lng: -51.7007 };
  const STORAGE_POINTS = "alertasani_demo_points_v1";
  const STORAGE_USERS = "alertasani_demo_users_v1";
  const STORAGE_SESSION = "alertasani_demo_session_v1";

  let map = null;
  let mapReady = false;
  let pendingLocation = null;
  let wantsToReport = false;
  let mapMarkers = [];
  let toastTimer = null;

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeModal(modal) {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    if (!$(".modal.open")) document.body.style.overflow = "";
  }

  $$("[data-close-modal]").forEach(element => {
    element.addEventListener("click", () => {
      const modal = element.closest(".modal");
      if (modal) closeModal(modal);
    });
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      const opened = $(".modal.open");
      if (opened) closeModal(opened);
    }
  });

  function setActiveNav(section) {
    $$(".nav-link").forEach(link => {
      link.classList.toggle("active", link.dataset.section === section);
    });
  }

  function goToSection(id) {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveNav(id);
  }

  $$(".nav-link").forEach(link => {
    link.addEventListener("click", event => {
      event.preventDefault();
      goToSection(link.dataset.section);
      $("#mobile-menu").setAttribute("aria-expanded", "false");
    });
  });

  ["#hero-report", "#header-report", "#bottom-report"].forEach(selector => {
    $(selector).addEventListener("click", () => startReportFlow());
  });

  $("#map-add-button").addEventListener("click", () => startReportFlow());

  function startReportFlow() {
    if (!getSession()) {
      wantsToReport = true;
      openAuth("login");
      showToast("Entre ou crie uma conta de demonstração para registrar um ponto.");
      return;
    }
    goToSection("mapa");
    showToast("Agora clique no local desejado do mapa para adicionar o ponto.");
  }

  function continueReportFlow() {
    if (!wantsToReport || !getSession()) return;
    wantsToReport = false;
    goToSection("mapa");
    showToast("Agora clique no local desejado do mapa para adicionar o ponto.");
  }

  // Auth de demonstração: os dados ficam somente neste navegador.
  function getUsers() {
    return readJSON(STORAGE_USERS, []);
  }

  function getSession() {
    return readJSON(STORAGE_SESSION, null);
  }

  function updateAuthUI() {
    const session = getSession();
    $("#open-login").hidden = Boolean(session);
    $("#logout-button").hidden = !session;
    $("#user-label").hidden = !session;
    $("#user-label").textContent = session ? `Olá, ${session.name}` : "";
  }

  function setAuthFeedback(message, success = false) {
    const feedback = $("#auth-feedback");
    feedback.textContent = message;
    feedback.classList.toggle("success", success);
  }

  function openAuth(mode) {
    openModal("auth-modal");
    setAuthMode(mode);
    setAuthFeedback("");
  }

  function setAuthMode(mode) {
    const login = mode === "login";
    $("#login-form").hidden = !login;
    $("#register-form").hidden = login;
    $("#tab-login").classList.toggle("selected", login);
    $("#tab-register").classList.toggle("selected", !login);
    $("#auth-title").textContent = login ? "Entre na sua conta" : "Crie sua conta";
    $("#auth-description").textContent = login
      ? "Acesse para registrar e organizar suas ocorrências."
      : "Preencha os dados para criar uma conta de demonstração.";
    setAuthFeedback("");
  }

  $("#open-login").addEventListener("click", () => openAuth("login"));
  $("#tab-login").addEventListener("click", () => setAuthMode("login"));
  $("#tab-register").addEventListener("click", () => setAuthMode("register"));

  async function hashPassword(password, saltHex) {
    if (!window.crypto?.subtle) {
      throw new Error("Abra o projeto em localhost ou HTTPS para usar a demonstração de login.");
    }
    const encoder = new TextEncoder();
    const salt = saltHex
      ? Uint8Array.from(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)))
      : window.crypto.getRandomValues(new Uint8Array(16));

    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" },
      key, 256
    );
    const hash = Array.from(new Uint8Array(bits))
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
    const saltString = Array.from(salt)
      .map(byte => byte.toString(16).padStart(2, "0")).join("");
    return { hash, salt: saltString };
  }

  $("#register-form").addEventListener("submit", async event => {
    event.preventDefault();
    const name = $("#register-name").value.trim();
    const email = $("#register-email").value.trim().toLowerCase();
    const password = $("#register-password").value;

    if (name.length < 2) return setAuthFeedback("Digite seu nome.");
    if (password.length < 8) return setAuthFeedback("A senha precisa ter pelo menos 8 caracteres.");

    const users = getUsers();
    if (users.some(user => user.email === email)) {
      return setAuthFeedback("Este e-mail já está cadastrado neste navegador. Faça login.");
    }

    try {
      const credentials = await hashPassword(password);
      users.push({ name, email, passwordHash: credentials.hash, salt: credentials.salt });
      saveJSON(STORAGE_USERS, users);
      saveJSON(STORAGE_SESSION, { name, email });
      updateAuthUI();
      closeModal($("#auth-modal"));
      $("#register-form").reset();
      showToast("Conta de demonstração criada!");
      continueReportFlow();
    } catch (error) {
      setAuthFeedback(error.message || "Não foi possível criar a conta.");
    }
  });

  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("#login-email").value.trim().toLowerCase();
    const password = $("#login-password").value;
    const user = getUsers().find(item => item.email === email);

    if (!user) return setAuthFeedback("Conta não encontrada neste navegador. Crie uma conta primeiro.");

    try {
      const credentials = await hashPassword(password, user.salt);
      if (credentials.hash !== user.passwordHash) {
        return setAuthFeedback("E-mail ou senha incorretos.");
      }
      saveJSON(STORAGE_SESSION, { name: user.name, email: user.email });
      updateAuthUI();
      closeModal($("#auth-modal"));
      $("#login-form").reset();
      showToast(`Bem-vindo(a), ${user.name}!`);
      continueReportFlow();
    } catch (error) {
      setAuthFeedback(error.message || "Não foi possível entrar.");
    }
  });

  $("#logout-button").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_SESSION);
    updateAuthUI();
    showToast("Você saiu da conta.");
  });

  // Google Maps
  function showMapMessage(message) {
    const box = $("#map-message");
    box.textContent = message;
    box.hidden = false;
  }

  function hideMapMessage() {
    $("#map-message").hidden = true;
  }

  function loadGoogleMaps() {
    const key = window.ALERTASANI_CONFIG?.googleMapsApiKey;
    if (!key || key === "COLE_SUA_CHAVE_DO_GOOGLE_MAPS_AQUI") {
      showMapMessage("Para ativar o mapa interativo do Google, adicione sua chave em js/config.js. Veja as instruções no README.");
      return;
    }

    if (window.google?.maps) {
      initMap();
      return;
    }

    window.initAlertaSaniMap = initMap;
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initAlertaSaniMap&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onerror = () => showMapMessage("Não foi possível carregar o Google Maps. Confira a chave, as APIs ativadas e a configuração de faturamento.");
    document.head.appendChild(script);
  }

  function initMap() {
    if (mapReady || !window.google?.maps) return;
    map = new google.maps.Map($("#google-map"), {
      center: TL_CENTER,
      zoom: 12,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      mapTypeId: "roadmap"
    });
    mapReady = true;
    hideMapMessage();

    map.addListener("click", event => {
      if (!getSession()) {
        openAuth("login");
        showToast("Entre para adicionar um ponto ao mapa.");
        return;
      }
      pendingLocation = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      updateSelectedLocationText();
      openModal("report-modal");
    });

    renderPoints();
  }

  function updateSelectedLocationText() {
    const label = $("#selected-location");
    if (!pendingLocation) {
      label.textContent = "Nenhum local selecionado. Clique em um ponto do mapa para escolher.";
      return;
    }
    label.textContent = `Local selecionado: ${pendingLocation.lat.toFixed(5)}, ${pendingLocation.lng.toFixed(5)}`;
  }

  function getPoints() {
    return readJSON(STORAGE_POINTS, []);
  }

  function categoryColor(category) {
    return {
      "Água e esgoto": "#d56e54",
      "Lixo e resíduos": "#d99a3d",
      "Drenagem": "#4d9877",
      "Outros": "#6d83b4"
    }[category] || "#6d83b4";
  }

  function clearMarkers() {
    mapMarkers.forEach(marker => marker.setMap(null));
    mapMarkers = [];
  }

  function renderPoints() {
    if (!mapReady) return;
    clearMarkers();
    const points = getPoints();

    points.forEach(point => {
      const marker = new google.maps.Marker({
        position: { lat: point.lat, lng: point.lng },
        map,
        title: point.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: categoryColor(point.category),
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 8
        }
      });

      const info = new google.maps.InfoWindow({
        content: `<div style="max-width:220px;font-family:Arial,sans-serif">
          <strong>${escapeHTML(point.title)}</strong>
          <p style="margin:6px 0;color:#176b5b;font-size:12px">${escapeHTML(point.category)}</p>
          <p style="margin:0;font-size:12px">${escapeHTML(point.description)}</p>
        </div>`
      });

      marker.addListener("click", () => info.open({ anchor: marker, map }));
      mapMarkers.push(marker);
    });

    renderOccurrenceList(points);
    $("#points-count").textContent = `${points.length} ${points.length === 1 ? "ponto" : "pontos"} no mapa`;
    $("#side-count").textContent = points.length;
  }

  function renderOccurrenceList(points) {
    const list = $("#occurrence-list");
    if (!points.length) {
      list.innerHTML = `<div class="empty-list">
        <span class="empty-symbol">⌖</span>
        <strong>Nenhum ponto por aqui ainda</strong>
        <p>Os pontos adicionados ao mapa aparecerão nesta lista.</p>
      </div>`;
      return;
    }

    list.innerHTML = "";
    [...points].reverse().forEach(point => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "occurrence-item";
      item.innerHTML = `<span class="category-tag">${escapeHTML(point.category)}</span>
        <strong>${escapeHTML(point.title)}</strong>
        <span>${new Date(point.createdAt).toLocaleDateString("pt-BR")}</span>`;
      item.addEventListener("click", () => {
        map.panTo({ lat: point.lat, lng: point.lng });
        map.setZoom(16);
        const marker = mapMarkers.find(m => m.getTitle() === point.title);
        if (marker) google.maps.event.trigger(marker, "click");
      });
      list.appendChild(item);
    });
  }

  $("#report-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!getSession()) {
      closeModal($("#report-modal"));
      openAuth("login");
      return;
    }
    if (!pendingLocation) {
      showToast("Clique no mapa para selecionar o local da ocorrência.");
      return;
    }

    const point = {
      id: window.crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()),
      title: $("#report-title-input").value.trim(),
      category: $("#report-category").value,
      description: $("#report-description").value.trim(),
      lat: pendingLocation.lat,
      lng: pendingLocation.lng,
      createdAt: new Date().toISOString()
    };

    const points = getPoints();
    points.push(point);
    saveJSON(STORAGE_POINTS, points);

    $("#report-form").reset();
    pendingLocation = null;
    updateSelectedLocationText();
    closeModal($("#report-modal"));

    if (mapReady) {
      renderPoints();
      map.panTo({ lat: point.lat, lng: point.lng });
      map.setZoom(15);
    }
    showToast("Ponto adicionado ao mapa neste navegador.");
  });

  // Se a pessoa entrar na seção do mapa, tenta carregar a API.
  const mapObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) loadGoogleMaps();
  }, { threshold: 0.1 });
  mapObserver.observe($("#mapa"));

  // Menu pequeno para telas estreitas.
  $("#mobile-menu").addEventListener("click", () => {
    const nav = $(".main-nav");
    const expanded = $("#mobile-menu").getAttribute("aria-expanded") === "true";
    $("#mobile-menu").setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("mobile-open", !expanded);
  });

  updateAuthUI();
})();
