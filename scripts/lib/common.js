const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');
const UPDATES_DIR = path.join(DATA_DIR, 'admin_updates');
const HISTORY_DIR = path.join(UPDATES_DIR, 'history');

const GAME_CONFIG = {
  tris: {
    file: 'tris.json',
    scriptName: 'calcular_tris.js',
    label: 'Tris'
  },
  chispazo: {
    file: 'chispazo.json',
    scriptName: 'calcular_chispazo.js',
    label: 'Chispazo',
    count: 5,
    min: 1,
    max: 28
  },
  'melate-retro': {
    file: 'melate_retro.json',
    scriptName: 'calcular_melate_retro.js',
    label: 'Melate Retro',
    count: 6,
    min: 1,
    max: 39,
    extra: { key: 'adicional', min: 1, max: 39 }
  },
  melate: {
    file: 'melate.json',
    scriptName: 'calcular_melate.js',
    label: 'Melate',
    sections: [
      { key: 'melate', count: 6, min: 1, max: 56 },
      { key: 'revancha', count: 6, min: 1, max: 56 },
      { key: 'revanchita', count: 6, min: 1, max: 56 }
    ],
    extra: { key: 'adicional', min: 1, max: 56 }
  },
  'gana-gato': {
    file: 'gana_gato.json',
    scriptName: 'calcular_gana_gato.js',
    label: 'Gana Gato',
    unsupported: true
  }
};

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function normalizeDate(value) {
  if (!value) throw new Error('Falta fecha.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  throw new Error(`Fecha no válida: ${value}`);
}

function normalizeNumbers(values, min, max, label) {
  if (!Array.isArray(values)) throw new Error(`${label} debe ser un arreglo.`);
  const seen = new Set();
  const out = values.map((raw) => {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < min || n > max) {
      throw new Error(`${label}: todos los números deben estar entre ${min} y ${max}.`);
    }
    if (seen.has(n)) {
      throw new Error(`${label}: no se permiten números repetidos.`);
    }
    seen.add(n);
    return n;
  });
  return out.sort((a, b) => a - b);
}

function loadPayload(args) {
  if (args.input) {
    return readJson(path.resolve(ROOT, args.input));
  }
  if (args.payload) {
    return JSON.parse(args.payload);
  }
  throw new Error('Debes pasar --input archivo.json o --payload "{...}".');
}

function normalizePayload(game, payload) {
  const cfg = GAME_CONFIG[game];
  if (!cfg) throw new Error(`Juego no soportado: ${game}`);
  if (cfg.unsupported) {
    return {
      ...payload,
      game,
      draw: {
        ...payload.draw,
        fecha: normalizeDate(payload.draw?.fecha),
        concurso: Number(payload.draw?.concurso)
      }
    };
  }

  const base = {
    version: payload.version || 1,
    created_at: payload.created_at || new Date().toISOString(),
    game,
    source: payload.source || 'manual',
    draft_meta: payload.draft_meta || null,
    draw: {
      fecha: normalizeDate(payload.draw?.fecha),
      concurso: Number(payload.draw?.concurso)
    }
  };

  if (!Number.isInteger(base.draw.concurso) || base.draw.concurso <= 0) {
    throw new Error('Concurso no válido.');
  }

  if (game === 'tris') {
    const resultado = String(payload.draw?.resultado || '').replace(/\D/g, '');
    if (resultado.length !== 5) throw new Error('Tris requiere exactamente 5 dígitos.');
    base.draw.resultado = resultado;
    return base;
  }

  if (cfg.sections) {
    cfg.sections.forEach((section) => {
      base.draw[section.key] = normalizeNumbers(
        payload.draw?.[section.key],
        section.min,
        section.max,
        section.key
      );
    });
    const extra = payload.draw?.[cfg.extra.key];
    if (extra !== null && extra !== undefined && extra !== '') {
      const n = Number(extra);
      if (!Number.isInteger(n) || n < cfg.extra.min || n > cfg.extra.max) {
        throw new Error(`${cfg.extra.key} fuera de rango.`);
      }
      base.draw[cfg.extra.key] = n;
    } else {
      base.draw[cfg.extra.key] = null;
    }
    return base;
  }

  base.draw.numeros = normalizeNumbers(
    payload.draw?.numeros,
    cfg.min,
    cfg.max,
    'numeros'
  );

  if (cfg.extra) {
    const extra = payload.draw?.[cfg.extra.key];
    if (extra !== null && extra !== undefined && extra !== '') {
      const n = Number(extra);
      if (!Number.isInteger(n) || n < cfg.extra.min || n > cfg.extra.max) {
        throw new Error(`${cfg.extra.key} fuera de rango.`);
      }
      base.draw[cfg.extra.key] = n;
    } else {
      base.draw[cfg.extra.key] = null;
    }
  }

  return base;
}

function buildSummary(game, normalized, currentData) {
  const latestDate =
    currentData?.adat?.historico?.[0]?.fecha ||
    currentData?.historico?.melate?.historico?.[0]?.fecha ||
    currentData?.dir5?.ultima_fecha ||
    null;

  return {
    game,
    normalized,
    current_data_file: path.join('data', GAME_CONFIG[game].file),
    latest_known_date: latestDate,
    note: 'Base generada: guarda la entrada validada, pero aún no recalcula métricas derivadas del JSON productivo.'
  };
}

function persistAdminUpdate(game, normalized, summary) {
  ensureDir(UPDATES_DIR);
  ensureDir(HISTORY_DIR);

  const latestFile = path.join(UPDATES_DIR, `${game}.latest.json`);
  const historyFile = path.join(HISTORY_DIR, `${game}.jsonl`);

  writeJson(latestFile, summary);
  fs.appendFileSync(historyFile, `${JSON.stringify(normalized)}\n`, 'utf8');

  return { latestFile, historyFile };
}

function runGameUpdate(game) {
  const cfg = GAME_CONFIG[game];
  const args = parseArgs(process.argv.slice(2));
  const payload = loadPayload(args);
  const normalized = normalizePayload(game, payload);
  const currentData = readJson(path.join(DATA_DIR, cfg.file));
  const summary = buildSummary(game, normalized, currentData);

  if (args.write) {
    const files = persistAdminUpdate(game, normalized, summary);
    console.log(`[ok] Entrada validada para ${cfg.label}`);
    console.log(`[ok] Latest: ${path.relative(ROOT, files.latestFile)}`);
    console.log(`[ok] History: ${path.relative(ROOT, files.historyFile)}`);
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
}

module.exports = {
  GAME_CONFIG,
  runGameUpdate
};
