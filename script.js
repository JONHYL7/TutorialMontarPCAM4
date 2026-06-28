// Estado global
const state = { step: 1, placed: {}, ramCount: 0, placedStep: 0, completionTimeoutId: null };

// Tooltip dinâmico
let tooltip = null;

// Função para criar tooltip
function createTooltip() {
  tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  document.body.appendChild(tooltip);
}

// Função para mostrar tooltip
function showTooltip(text, x, y) {
  if (!tooltip) createTooltip();
  tooltip.textContent = text;
  tooltip.style.left = (x + 10) + 'px';
  tooltip.style.top = (y - 30) + 'px';
  tooltip.classList.add('show');
}

// Função para esconder tooltip
function hideTooltip() {
  if (tooltip) tooltip.classList.remove('show');
}

// Instruções para cada etapa
const instructions = {
  1: "Instala a placa-mãe na caixa: alinha os standoffs com os furos da placa, coloca o I/O shield (se aplicável) e aparafusa a placa-mãe nos standoffs até ficar segura.",
  2: "Instala a CPU: levanta a alavanca do soquete, alinha o triângulo do CPU com o soquete, baixa o CPU com cuidado e fecha a alavanca.",
  3: "Instala a RAM: alinha o entalhe do módulo com o slot, insere verticalmente e pressiona até ouvir o clique. Instala os módulos lado a lado conforme necessário.",
  4: "Instala o armazenamento: para M.2 encaixa no slot e parafusa; para SSD/HDD coloca na baia e conecta o cabo SATA/energia.",
  5: "Instala a GPU: insere no slot PCIe até travar, parafusa ao chassis e liga os cabos de alimentação da GPU se necessário.",
  6: "Instala a PSU (fonte): posiciona a fonte, parafusa no chassis e conecta os cabos à placa-mãe, GPU e drives conforme a necessidade.",
  done: "Montagem completa! Verifica cabos, fixa tudo com parafusos, liga o sistema para teste e entra no BIOS para confirmar detecção dos componentes."
};

// Posições normalizadas (0..1) dentro da imagem da motherboard
const normalizedPositions = {
  cpu: { x: 0.42, y: 0.26, w: 0.16, h: 0.16 },
  ram: { x: 0.64, y: 0.12, w: 0.19, h: 0.44 },
  storage: { x: 0.14, y: 0.41, w: 0.50, h: 0.34 },
  gpu: { x: 0.11, y: 0.56, w: 0.74, h: 0.28 },
  psu: { x: 0.08, y: 1.25, w: 0.46, h: 0.18 },
};

function updateTargetPositions() {
  const mobo = document.getElementById('mobo');
  if (!mobo) return;
  const moboRect = mobo.getBoundingClientRect();
  const width = moboRect.width;
  const height = moboRect.height;

  Object.entries(normalizedPositions).forEach(([type, pos]) => {
    const target = document.getElementById(`t-${type}`);
    if (!target) return;
    target.style.left = `${pos.x * width}px`;
    target.style.top = `${pos.y * height}px`;
    target.style.width = `${pos.w * width}px`;
    target.style.height = `${pos.h * height}px`;
  });
}

function getPartPosition(type, ramIndex = 0) {
  const mobo = document.getElementById('mobo');
  const moboRect = mobo.getBoundingClientRect();
  const pos = normalizedPositions[type];
  if (!pos) {
    return { left: moboRect.width * 0.5, top: moboRect.height * 0.5, width: moboRect.width * 0.15, height: moboRect.height * 0.15 };
  }

  if (type === 'ram') {
    // empilhar módulos de RAM horizontalmente
    const offset = ramIndex * (pos.w * moboRect.width * 0.3);
    return {
      left: (pos.x * moboRect.width) + offset,
      top: pos.y * moboRect.height,
      width: pos.w * moboRect.width,
      height: pos.h * moboRect.height,
    };
  }

  return {
    left: pos.x * moboRect.width,
    top: pos.y * moboRect.height,
    width: pos.w * moboRect.width,
    height: pos.h * moboRect.height,
  };
}

// Função para mostrar instruções
function showInstruction() {
  const box = document.getElementById('leftBox');
  if (!box) return;
  if (state.step > 6) {
    box.innerText = instructions.done;
    return;
  }
  box.innerText = instructions[state.step] || "Siga os passos na ordem mostrada.";
}

// Função para atualizar paleta de componentes
function refreshPalette() {
  const map = { 1: ['motherboard'], 2: ['cpu'], 3: ['ram'], 4: ['storage'], 5: ['gpu'], 6: ['psu'] };
  document.querySelectorAll('.comp').forEach(c => c.style.display = 'none');
  (map[state.step] || []).forEach(type => {
    const el = document.querySelector('.comp[data-type="' + type + '"]');
    if (el) el.style.display = 'flex';
  });
  showInstruction();
}

// Função para atualizar resumo
function updateSummary() {
  const order = ['motherboard', 'cpu', 'ram', 'storage', 'gpu', 'psu'];
  const container = document.getElementById('buildList');
  container.innerHTML = '';
  order.forEach(k => {
    const status = (k === 'ram') ? (state.ramCount > 0 ? state.ramCount + ' módulo(s)' : '-') : (state.placed[k] ? 'Instalado' : '-');
    const row = document.createElement('div');
    row.className = 'build-row';
    row.innerHTML = `<div style="text-transform:uppercase">${k}</div><div style="color:var(--muted)">${status}</div>`;
    container.appendChild(row);
  });
}

// Função para criar ghost (imagem arrastada)
function createGhost(src) {
  const g = document.createElement('img');
  g.src = src;
  g.className = 'ghost';
  g.setAttribute('aria-hidden', 'true'); // Acessibilidade
  document.body.appendChild(g);
  return g;
}

// Função para processar drop de componente
function processDrop(type, mobo) {
  if (state.step === 1 && type !== 'motherboard') { showInstruction(); return; }
  if (state.step === 2 && type !== 'cpu') { showInstruction(); return; }
  if (state.step === 3 && type !== 'ram') { showInstruction(); return; }
  if (state.step === 4 && type !== 'storage') { showInstruction(); return; }
  if (state.step === 5 && type !== 'gpu') { showInstruction(); return; }
  if (state.step === 6 && type !== 'psu') { showInstruction(); return; }

  const src = document.querySelector('.comp[data-type="' + type + '"] img').src;
  const part = document.createElement('img');
  part.src = src;
  part.style.position = 'absolute';
  part.style.objectFit = 'contain';
  part.style.pointerEvents = 'none';
  part.setAttribute('alt', `Componente ${type} instalado`); // Acessibilidade

  const pos = getPartPosition(type, state.ramCount);
  part.style.left = `${pos.left}px`;
  part.style.top = `${pos.top}px`;
  part.style.width = `${pos.width}px`;
  part.style.height = `${pos.height}px`;

  mobo.appendChild(part);

  // Atualizar estado
  if (type === 'ram') { state.ramCount++; state.placed.ram = state.ramCount + ' módulo(s)'; }
  else state.placed[type] = true;

  // Esconder zona azul
  if (type === 'cpu') document.getElementById('t-cpu').style.display = 'none';
  else if (type === 'ram' && state.ramCount === 1) document.getElementById('t-ram-1').style.display = 'none';
  else if (type === 'storage') document.getElementById('t-storage').style.display = 'none';
  else if (type === 'gpu') document.getElementById('t-gpu').style.display = 'none';
  else if (type === 'psu') document.getElementById('t-psu').style.display = 'none';

  state.step++;
  refreshPalette();
  updateSummary();

  if (state.step > 6) {
    showInstruction();
    checkCompletionModal();
  }
}

// Função para mostrar modal de conclusão
function checkCompletionModal() {
  const modal = document.getElementById('completionModal');
  if (state.step > 6 && !state.completionTimeoutId) {
    state.completionTimeoutId = setTimeout(() => {
      modal.style.display = 'flex';
      state.completionTimeoutId = null;
    }, 10000); // aparece após 10s
  }
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  refreshPalette();
  updateSummary();
  updateTargetPositions();

  window.addEventListener('resize', updateTargetPositions);

  let dragging = null, ghost = null;

  // Drag start
  document.querySelectorAll('.comp').forEach(comp => {
    comp.addEventListener('dragstart', e => {
      dragging = comp;
      ghost = createGhost(comp.querySelector('img').src);
      e.dataTransfer.setData('text/plain', comp.dataset.type);
      // Mostrar tooltip com dica
      const type = comp.dataset.type;
      const tips = {
        motherboard: "Solte na caixa para instalar a placa-mãe",
        cpu: "Solte no socket da CPU",
        ram: "Solte nos slots de RAM",
        storage: "Solte na área de armazenamento",
        gpu: "Solte no slot PCIe",
        psu: "Solte na área da fonte"
      };
      showTooltip(tips[type] || "Arraste para o local correto", e.clientX, e.clientY);
    });
    comp.addEventListener('dragend', e => {
      dragging = null;
      if (ghost) { ghost.remove(); ghost = null; }
      hideTooltip(); // Esconder tooltip
    });
  });

  // Drag over
  document.addEventListener('dragover', e => {
    if (ghost) {
      ghost.style.left = e.pageX + 'px';
      ghost.style.top = e.pageY + 'px';
    }
    if (tooltip && tooltip.classList.contains('show')) {
      tooltip.style.left = (e.clientX + 10) + 'px';
      tooltip.style.top = (e.clientY - 30) + 'px';
    }
    e.preventDefault();
  });

  // Touch/mobile
  document.querySelectorAll('.comp').forEach(comp => {
    comp.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      dragging = comp;
      ghost = createGhost(comp.querySelector('img').src);
      ghost.style.left = (e.clientX) + 'px';
      ghost.style.top = (e.clientY) + 'px';
      function onMove(ev) {
        if (ghost) { ghost.style.left = (ev.clientX) + 'px'; ghost.style.top = (ev.clientY) + 'px'; }
      }
      function onUp(ev) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        if (!dragging) return;
        processPointerDrop(dragging.dataset.type, ev.clientX, ev.clientY);
        dragging = null;
      }
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });
  });

  // Função para drop via touch
  function processPointerDrop(type, clientX, clientY) {
    const caseVisual = document.getElementById('caseVisual');
    const mobo = document.getElementById('mobo');
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return;
    if (caseVisual.contains(el) && state.step === 1 && type === 'motherboard') {
      mobo.style.display = 'block';
      state.placed.motherboard = true;
      state.step++;
      updateTargetPositions();
      refreshPalette();
      updateSummary();
      showInstruction();
      return;
    }
    if (mobo.contains(el)) {
      processDrop(type, mobo);
    }
  }

  // Drop para desktop
  const caseVisual = document.getElementById('caseVisual');
  const mobo = document.getElementById('mobo');

  caseVisual.addEventListener('dragover', e => e.preventDefault());
  caseVisual.addEventListener('drop', e => {
    e.preventDefault();
    const type = dragging ? dragging.dataset.type : e.dataTransfer.getData('text/plain');
    if (state.step !== 1 || type !== 'motherboard') {
      showInstruction();
      return;
    }
    mobo.style.display = 'block';
    state.placed.motherboard = true;
    state.step++;
    updateTargetPositions();
    refreshPalette();
    updateSummary();
  });

  mobo.addEventListener('dragover', e => e.preventDefault());
  mobo.addEventListener('drop', e => {
    e.preventDefault();
    const type = dragging ? dragging.dataset.type : e.dataTransfer.getData('text/plain');
    processDrop(type, mobo);
  });

  // Botão reset
  document.getElementById('resetBtn').addEventListener('click', function() {
    state.step = 1;
    state.placed = {};
    state.ramCount = 0;
    state.placedStep = 0;
    if (state.completionTimeoutId) {
      clearTimeout(state.completionTimeoutId);
      state.completionTimeoutId = null;
    }
    mobo.style.display = 'none';
    const parts = mobo.querySelectorAll('img:not(.mobo-img)');
    parts.forEach(part => part.remove());
    document.getElementById('completionModal').style.display = 'none';
    document.getElementById('t-cpu').style.display = 'flex';
    document.getElementById('t-ram-1').style.display = 'flex';
    document.getElementById('t-storage').style.display = 'flex';
    document.getElementById('t-gpu').style.display = 'flex';
    document.getElementById('t-psu').style.display = 'flex';
    refreshPalette();
    updateSummary();
    showInstruction();
  });
});