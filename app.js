// ================= CONFIGURAÇÃO =================
// 1. No Google Agenda, crie uma agenda nova ("Outras agendas" > "+").
// 2. Em Configurações da agenda, copie o "ID da agenda" (parece um e-mail,
//    ex.: xxxxx@group.calendar.google.com) e cole abaixo.
// 3. apiKey é OPCIONAL — com ela, a seção "Próximos eventos" funciona.
//    Crie grátis no console.cloud.google.com (ative a Calendar API).
const CONFIG = {
  nomeTurma: "Calendário da Turma", // ex.: "3º A — Informática"
  calendarId: "e08a2e0b458f1e160be4e56aa8820316753da6ea031e66bef9a78d2b585e9dc5@group.calendar.google.com",
  apiKey: "",
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

// Se ainda não configurou o ID, avisa na tela em vez de mostrar iframe quebrado
const configurado =
  CONFIG.calendarId && !CONFIG.calendarId.startsWith("COLE");

document.getElementById("aviso-config").hidden = configurado;
if (configurado) iframe.src = urlCalendario("MONTH");

// ---- Próximos eventos (requer apiKey e agenda pública) ----

const cardProximos = document.getElementById("card-proximos");
const lista = document.getElementById("lista-proximos");
const proximosVazio = document.getElementById("proximos-vazio");

function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

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

function renderProximos(items) {
  if (!items.length) {
    proximosVazio.hidden = false;
    return;
  }

  const fmtData = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" });
  const fmtMes = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const fmtHora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  lista.innerHTML = items
    .map((ev) => {
      const inicio = ev.start.dateTime || ev.start.date;
      const data = new Date(inicio);
      const rotulo = rotuloDias(data);
      const hora = ev.start.dateTime ? ` às ${fmtHora.format(data)}` : "";
      return `
        <li>
          <span class="data">${fmtData.format(data)}<small>${fmtMes.format(data)}</small></span>
          <span class="nome">${escapar(ev.summary || "(sem título)")}${hora}</span>
          <span class="badge ${rotulo.classe}">${rotulo.texto}</span>
        </li>`;
    })
    .join("");
}

async function carregarProximos() {
  if (!configurado || !CONFIG.apiKey) return;
  cardProximos.hidden = false;

  const params = new URLSearchParams({
    key: CONFIG.apiKey,
    timeMin: new Date().toISOString(),
    maxResults: "8",
    orderBy: "startTime",
    singleEvents: "true",
    timeZone: CONFIG.timeZone,
  });

  try {
    const resp = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
        CONFIG.calendarId
      )}/events?${params}`
    );
    if (!resp.ok) throw new Error(resp.status);
    const { items = [] } = await resp.json();
    renderProximos(items);
  } catch {
    lista.innerHTML = `<li class="erro">Não foi possível carregar os eventos.</li>`;
  }
}

carregarProximos();
