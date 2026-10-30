// ================= CONFIGURAÇÃO =================
// calendarId: ID da agenda (em "Integrar agenda" nas configurações).
// scriptUrl: URL do Apps Script (/exec) — habilita criar/editar/excluir
// eventos pelo site e a lista "Próximos eventos".
const CONFIG = {
  nomeTurma: "Calendário da Turma", // ex.: "3º A — Informática"
  calendarId: "e08a2e0b458f1e160be4e56aa8820316753da6ea031e66bef9a78d2b585e9dc5@group.calendar.google.com",
  scriptUrl: "https://script.google.com/macros/s/AKfycbzDtXxzfNb8pzTnab0MMxxgUIfjiIFOatjb-hMOkZTJ_aTRXompfCpaPJJqsyOSd3MC/exec",
  timeZone: "America/Sao_Paulo",
};
// ================================================

const iframe = document.getElementById("gcal");
const botoes = document.querySelectorAll(".modos button");

document.getElementById("titulo").textContent = CONFIG.nomeTurma;
document.title = CONFIG.nomeTurma;

function urlCalendario(modo) {
  const params = new URLSearchParams({
    src: CONFIG.calendarId,
    ctz: CONFIG.timeZone,
    hl: "pt-BR",
    mode: modo,
    showTitle: "0",
    showPrint: "0",
    showCalendars: "0",
    showTabs: "0",
  });
  return `https://calendar.google.com/calendar/embed?${params}`;
}

botoes.forEach((botao) => {
  botao.addEventListener("click", () => {
    botoes.forEach((b) => b.classList.remove("ativo"));
    botao.classList.add("ativo");
    iframe.src = urlCalendario(botao.dataset.modo);
  });
});

// Link "seguir calendário": adiciona a agenda à conta Google de quem clicar
document.getElementById("link-seguir").href =
  `https://calendar.google.com/calendar/u/0?cid=${btoa(CONFIG.calendarId)}`;

const configurado =
  CONFIG.calendarId && !CONFIG.calendarId.startsWith("COLE");

document.getElementById("aviso-config").hidden = configurado;
if (configurado) iframe.src = urlCalendario("MONTH");

// ---------- comunicação com o Apps Script ----------

// Leitura via JSONP (o Apps Script não libera CORS pra fetch)
function apiGet(params) {
  return new Promise((resolve, reject) => {
    const cb = "jsonp" + Math.random().toString(36).slice(2);
    const s = document.createElement("script");
    const timeout = setTimeout(() => {
      limpar();
      reject(new Error("timeout"));
    }, 15000);
    function limpar() {
      delete window[cb];
      s.remove();
      clearTimeout(timeout);
    }
    window[cb] = (data) => {
      limpar();
      resolve(data);
    };
    s.onerror = () => {
      limpar();
      reject(new Error("falha ao carregar"));
    };
    s.src = CONFIG.scriptUrl + "?" + new URLSearchParams({ ...params, callback: cb });
    document.body.appendChild(s);
  });
}

function apiPost(dados) {
  return fetch(CONFIG.scriptUrl, {
    method: "POST",
    mode: "no-cors",
    body: new URLSearchParams(dados),
  });
}

function escapar(t) {
  const div = document.createElement("div");
  div.textContent = t == null ? "" : t;
  return div.innerHTML;
}

// ---------- lista de eventos ----------

const cardProximos = document.getElementById("card-proximos");
const lista = document.getElementById("lista-proximos");
const proximosVazio = document.getElementById("proximos-vazio");
const cardGerenciar = document.getElementById("card-gerenciar");
const listaGerenciar = document.getElementById("lista-gerenciar");
const gerenciarVazio = document.getElementById("gerenciar-vazio");

function rotuloDias(inicio) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(inicio);
  alvo.setHours(0, 0, 0, 0);
  const dias = Math.round((alvo - hoje) / 86400000);
  if (dias <= 0) return { texto: "hoje", classe: "hoje" };
  if (dias === 1) return { texto: "amanhã", classe: "amanha" };
  if (dias <= 7) return { texto: `em ${dias} dias`, classe: "semana" };
  return { texto: `em ${dias} dias`, classe: "" };
}

const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const fmtDataCompleta = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const fmtHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function renderProximos(eventos) {
  const proximos = eventos.slice(0, 8);
  proximosVazio.hidden = proximos.length > 0;
  lista.innerHTML = proximos
    .map((ev) => {
      const data = new Date(ev.inicio);
      const rotulo = rotuloDias(data);
      const hora = ev.diaInteiro ? "" : ` às ${fmtHora.format(data)}`;
      return `
        <li>
          <span class="data">${fmtData.format(data)}<small>${fmtMes.format(data)}</small></span>
          <span class="nome">${escapar(ev.titulo)}${hora}</span>
          <span class="badge ${rotulo.classe}">${rotulo.texto}</span>
        </li>`;
    })
    .join("");
}

function renderGerenciar(eventos) {
  gerenciarVazio.hidden = eventos.length > 0;
  listaGerenciar.innerHTML = eventos
    .map((ev) => {
      const data = new Date(ev.inicio);
      const hora = ev.diaInteiro ? " (dia inteiro)" : ` ${fmtHora.format(data)}`;
      return `
        <li>
          <span class="nome"><strong>${fmtDataCompleta.format(data)}</strong> — ${escapar(ev.titulo)}${hora}</span>
          <span class="acoes-item">
            <button class="btn-mini btn-editar" data-id="${escapar(ev.id)}">Editar</button>
            <button class="btn-mini btn-excluir" data-id="${escapar(ev.id)}">Excluir</button>
          </span>
        </li>`;
    })
    .join("");
}

let eventosCache = [];

async function carregarEventos() {
  if (!configurado || !CONFIG.scriptUrl) return;
  cardProximos.hidden = false;
  cardGerenciar.hidden = false;
  try {
    const data = await apiGet({ action: "listarEventos" });
    eventosCache = data.eventos || [];
    renderProximos(eventosCache);
    renderGerenciar(eventosCache);
  } catch {
    lista.innerHTML = `<li class="erro">Não foi possível carregar os eventos.</li>`;
  }
}

carregarEventos();

// ---------- criar / editar / excluir pelo site ----------

const modal = document.getElementById("modal-evento");
const form = document.getElementById("form-evento");
const btnNovo = document.getElementById("btn-novo");
const btnCancelar = document.getElementById("btn-cancelar");
const btnEnviar = document.getElementById("btn-enviar");
const feedback = document.getElementById("form-feedback");
const tituloModal = modal.querySelector("h2");

btnNovo.addEventListener("click", () => {
  if (!CONFIG.scriptUrl) {
    alert(
      "O botão de criar evento ainda não foi configurado.\n" +
      "Falta colar a URL do Apps Script em scriptUrl no arquivo app.js."
    );
    return;
  }
  abrirModal();
});

function abrirModal(evento) {
  form.reset();
  feedback.hidden = true;
  tituloModal.textContent = evento ? "Editar evento" : "Novo evento";

  if (evento) {
    const inicio = new Date(evento.inicio);
    const fim = new Date(evento.fim);
    form.elements.id.value = evento.id;
    form.elements.titulo.value = evento.titulo;
    form.elements.data.value = evento.inicio.slice(0, 10);
    form.elements.hora.value = evento.diaInteiro ? "" : fmtHora.format(inicio);
    form.elements.duracao.value = evento.diaInteiro
      ? 60
      : Math.max(5, Math.round((fim - inicio) / 60000));
    form.elements.descricao.value = evento.descricao || "";
  } else {
    form.elements.id.value = "";
  }

  modal.showModal();
}

btnCancelar.addEventListener("click", () => modal.close());

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  btnEnviar.disabled = true;
  btnEnviar.textContent = "Salvando...";
  feedback.hidden = false;
  feedback.className = "feedback";
  feedback.textContent = "";

  const dados = Object.fromEntries(new FormData(form).entries());
  dados.action = dados.id ? "editarEvento" : "criarEvento";
  if (!dados.id) delete dados.id;

  try {
    await apiPost(dados);
    feedback.classList.add("ok");
    feedback.textContent = "Salvo! Atualizando o calendário...";
    setTimeout(() => {
      modal.close();
      iframe.src = iframe.src;
      carregarEventos();
    }, 1500);
  } catch {
    feedback.classList.add("erro");
    feedback.textContent = "Não deu pra enviar. Confere sua internet e tenta de novo.";
  }

  btnEnviar.disabled = false;
  btnEnviar.textContent = "Adicionar";
});

listaGerenciar.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  const evento = eventosCache.find((ev) => ev.id === id);

  if (btn.classList.contains("btn-editar")) {
    if (evento) abrirModal(evento);
    return;
  }

  if (btn.classList.contains("btn-excluir") && evento) {
    if (!confirm(`Excluir "${evento.titulo}"?`)) return;
    btn.disabled = true;
    try {
      await apiPost({ action: "excluirEvento", id });
      setTimeout(() => {
        iframe.src = iframe.src;
        carregarEventos();
      }, 1200);
    } catch {
      btn.disabled = false;
    }
  }
});
