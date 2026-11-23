(() => {
  "use strict";

  const API_URL = "http://localhost:5524";
  const TL_CENTER = { lat: -20.7848, lng: -51.7007 };
  const STORAGE_SESSION = "alertasani_session_v2";

  let map = null;
  let mapReady = false;
  let pendingLocation = null;
  let wantsToReport = false;
  let mapMarkers = [];
  let toastTimer = null;
  let categoriasBanco = [];
  let pontosCarregados = [];

  const $ = selector => document.querySelector(selector);
  const $$ = selector => Array.from(document.querySelectorAll(selector));

  function saveSession(session) {
    localStorage.setItem(STORAGE_SESSION, JSON.stringify(session));
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_SESSION));
    } catch {
      return null;
    }
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[char]));
  }

  async function api(endpoint, options = {}) {
    const session = getSession();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };

    if (session?.token) {
      headers.Authorization = `Bearer ${session.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401 && session?.token) {
        localStorage.removeItem(STORAGE_SESSION);
        updateAuthUI();
      }
      throw new Error(data.erro || "Erro ao comunicar com o servidor.");
    }

    return data;
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
    if (!modal) return;
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
    $(selector)?.addEventListener("click", startReportFlow);
  });

  $("#map-add-button")?.addEventListener("click", startReportFlow);

  function startReportFlow() {
    if (!getSession()) {
      wantsToReport = true;
      openAuth("login");
      showToast("Entre ou crie uma conta para registrar um ponto.");
      return;
    }

    goToSection("mapa");
    showToast("Clique no local desejado do mapa para adicionar o ponto.");
  }

  function continueReportFlow() {
    if (!wantsToReport || !getSession()) return;
    wantsToReport = false;
    goToSection("mapa");
    showToast("Clique no local desejado do mapa para adicionar o ponto.");
  }

  // AUTENTICAÇÃO COM O BANCO DE DADOS

  function updateAuthUI() {
    const session = getSession();
    const nome = session?.usuario?.nome;

    $("#open-login").hidden = Boolean(session);
    $("#logout-button").hidden = !session;
    $("#user-label").hidden = !session;
    $("#user-label").textContent = session ? `Olá, ${nome}` : "";
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

    $("#auth-title").textContent = login
      ? "Entre na sua conta"
      : "Crie sua conta";

    $("#auth-description").textContent = login
      ? "Acesse para registrar e organizar suas ocorrências."
      : "Preencha os dados para criar uma conta.";

    setAuthFeedback("");
  }

  $("#open-login").addEventListener("click", () => openAuth("login"));
  $("#tab-login").addEventListener("click", () => setAuthMode("login"));
  $("#tab-register").addEventListener("click", () => setAuthMode("register"));

  $("#register-form").addEventListener("submit", async event => {
    event.preventDefault();

    const nome = $("#register-name").value.trim();
    const email = $("#register-email").value.trim().toLowerCase();
    const senha = $("#register-password").value;

    if (nome.length < 2) return setAuthFeedback("Digite seu nome.");
    if (senha.length < 8) {
      return setAuthFeedback("A senha precisa ter pelo menos 8 caracteres.");
    }

    try {
      await api("/usuarios", {
        method: "POST",
        body: JSON.stringify({ nome, email, senha })
      });

      setAuthFeedback("Conta criada! Agora entre com seu e-mail e senha.", true);
      $("#register-form").reset();
      setAuthMode("login");
      $("#login-email").value = email;
    } catch (error) {
      setAuthFeedback(error.message);
    }
  });

  $("#login-form").addEventListener("submit", async event => {
    event.preventDefault();

    const email = $("#login-email").value.trim().toLowerCase();
    const senha = $("#login-password").value;

    try {
      const data = await api("/login", {
        method: "POST",
        body: JSON.stringify({ email, senha })
      });

      saveSession({
        token: data.token,
        usuario: data.usuario
      });

      updateAuthUI();
      closeModal($("#auth-modal"));
      $("#login-form").reset();

      showToast(`Bem-vindo(a), ${data.usuario.nome}!`);
      continueReportFlow();
      await carregarOcorrencias();
    } catch (error) {
      setAuthFeedback(error.message);
    }
  });

  $("#logout-button").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_SESSION);
    updateAuthUI();
    showToast("Você saiu da conta.");
  });

  // CATEGORIAS DO BANCO

  async function carregarCategorias() {
    try {
      categoriasBanco = await api("/categorias");
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
    }
  }

  function encontrarCategoriaId(nome) {
    const texto = String(nome || "").toLowerCase();

    let categoria;

    if (texto.includes("água") || texto.includes("agua")) {
      categoria = categoriasBanco.find(c => c.nome === "Abastecimento de água");
    } else if (texto.includes("lixo") || texto.includes("resíduo")) {
      categoria = categoriasBanco.find(c => c.nome === "Lixo e resíduos");
    } else if (texto.includes("drenagem") || texto.includes("bueiro")) {
      categoria = categoriasBanco.find(c => c.nome === "Drenagem e bueiros");
    } else if (texto.includes("alagamento")) {
      categoria = categoriasBanco.find(c => c.nome === "Alagamento");
    } else if (texto.includes("esgoto")) {
      categoria = categoriasBanco.find(c => c.nome === "Esgoto");
    } else {
      categoria = categoriasBanco.find(c => c.nome === "Outro");
    }

    return categoria?.id || null;
  }

  // GOOGLE MAPS

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
      showMapMessage("Adicione sua chave do Google Maps em js/config.js para ativar o mapa.");
      return;
    }

    if (window.google?.maps) {
      initMap();
      return;
    }

    if ($("#google-maps-script")) return;

    window.initAlertaSaniMap = initMap;

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=initAlertaSaniMap&language=pt-BR&region=BR`;
    script.async = true;
    script.defer = true;
    script.onerror = () => showMapMessage(
      "Não foi possível carregar o Google Maps. Confira a chave e as configurações da API."
    );

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

    carregarOcorrencias();
  }

  function updateSelectedLocationText() {
    const label = $("#selected-location");

    if (!pendingLocation) {
      label.textContent = "Nenhum local selecionado. Clique em um ponto do mapa para escolher.";
      return;
    }

    label.textContent =
      `Local selecionado: ${pendingLocation.lat.toFixed(5)}, ${pendingLocation.lng.toFixed(5)}`;
  }

  // OCORRÊNCIAS DO BANCO

  function categoryColor(category) {
    const nome = String(category || "").toLowerCase();

    if (nome.includes("água") || nome.includes("agua") || nome.includes("esgoto")) {
      return "#f73100ff";
    }

    if (nome.includes("lixo") || nome.includes("resíduo")) {
      return "#ff9900ff";
    }

    if (nome.includes("drenagem") || nome.includes("alagamento")) {
      return "#03c26fff";
    }

    return "#003ec4ff";
  }

  function clearMarkers() {
    mapMarkers.forEach(marker => marker.setMap(null));
    mapMarkers = [];
  }

  async function carregarOcorrencias() {
    try {
      const points = await api("/ocorrencias");

      pontosCarregados = points.map(point => ({
        id: point.id,
        title: point.titulo,
        category: point.categoria || "Outro",
        description: point.descricao,
        lat: Number(point.latitude),
        lng: Number(point.longitude),
        createdAt: point.criado_em,
        status: point.status
      }));

      renderPoints();
    } catch (error) {
      console.error("Erro ao carregar ocorrências:", error);
      showToast("Não foi possível carregar os pontos do banco.");
    }
  }

  function renderPoints() {
    if (!mapReady) return;

    clearMarkers();

    pontosCarregados.forEach(point => {
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
          scale: 13
        }
      });

      const info = new google.maps.InfoWindow({
        content: `<div style="max-width:220px;font-family:Arial,sans-serif">
          <strong>${escapeHTML(point.title)}</strong>
          <p style="margin:6px 0;color:#176b5b;font-size:12px">${escapeHTML(point.category)}</p>
          <p style="margin:0;font-size:12px">${escapeHTML(point.description)}</p>
          <p style="margin:6px 0 0;font-size:11px">Status: ${escapeHTML(point.status)}</p>
        </div>`
      });

      marker.addListener("click", () => info.open({ anchor: marker, map }));

      mapMarkers.push({ id: point.id, marker });
    });

    renderOccurrenceList(pontosCarregados);

    $("#points-count").textContent =
      `${pontosCarregados.length} ${pontosCarregados.length === 1 ? "ponto" : "pontos"} no mapa`;

    $("#side-count").textContent = pontosCarregados.length;
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

    [...points].forEach(point => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "occurrence-item";

      item.innerHTML = `<span class="category-tag">${escapeHTML(point.category)}</span>
        <strong>${escapeHTML(point.title)}</strong>
        <span>${point.createdAt ? new Date(point.createdAt.replace(" ", "T") + (point.createdAt.includes("Z") ? "" : "Z")).toLocaleDateString("pt-BR") : ""}</span>`;

      item.addEventListener("click", () => {
        map.panTo({ lat: point.lat, lng: point.lng });
        map.setZoom(16);

        const encontrado = mapMarkers.find(m => m.id === point.id);
        if (encontrado) {
          google.maps.event.trigger(encontrado.marker, "click");
        }
      });

      list.appendChild(item);
    });
  }

  // ENVIO DE NOVA OCORRÊNCIA

  $("#report-form").addEventListener("submit", async event => {
    event.preventDefault();

    if (!getSession()) {
      closeModal($("#report-modal"));
      openAuth("login");
      return;
    }

    if (!pendingLocation) {
      showToast("Clique no mapa para selecionar o local.");
      return;
    }

    const titulo = $("#report-title-input").value.trim();
    const descricao = $("#report-description").value.trim();
    const categoria = $("#report-category").value;

    if (!titulo || !descricao) {
      showToast("Preencha o título e a descrição.");
      return;
    }

    const dados = {
      categoria_id: encontrarCategoriaId(categoria),
      titulo,
      descricao,
      endereco: "Localização marcada no mapa",
      bairro: null,
      latitude: pendingLocation.lat,
      longitude: pendingLocation.lng
    };

    try {
      await api("/ocorrencias", {
        method: "POST",
        body: JSON.stringify(dados)
      });

      const local = { ...pendingLocation };

      $("#report-form").reset();
      pendingLocation = null;
      updateSelectedLocationText();
      closeModal($("#report-modal"));

      await carregarOcorrencias();

      map.panTo(local);
      map.setZoom(15);

      showToast("Ocorrência salva no banco de dados!");
    } catch (error) {
      showToast(error.message || "Não foi possível salvar a ocorrência.");
    }
  });

  // CARREGAMENTO INICIAL

  const mapObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      loadGoogleMaps();
    }
  }, { threshold: 0.1 });

  mapObserver.observe($("#mapa"));

  $("#mobile-menu").addEventListener("click", () => {
    const nav = $(".main-nav");
    const expanded = $("#mobile-menu").getAttribute("aria-expanded") === "true";

    $("#mobile-menu").setAttribute("aria-expanded", String(!expanded));
    nav.classList.toggle("mobile-open", !expanded);
  });

  async function iniciarAplicacao() {
    updateAuthUI();
    await carregarCategorias();

    if (getSession()) {
      await carregarOcorrencias();
    }
  }

  iniciarAplicacao();
})();