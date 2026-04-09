import { TICKERS, normalizeTicker } from './data/tickers';

type LaunchMode = 'analysis' | 'backtest' | 'ai';
type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';

const STORAGE_KEY = 'graph.launchpad.preferences';

const tickerInput = document.getElementById('ticker-input') as HTMLInputElement;
const tfInput = document.getElementById('tf-input') as HTMLSelectElement;
const testBtn = document.getElementById('test-btn') as HTMLButtonElement;
const openAnalysisBtn = document.getElementById('open-analysis-btn') as HTMLButtonElement;
const openBacktestBtn = document.getElementById('open-backtest-btn') as HTMLButtonElement;
const openAiBtn = document.getElementById('open-ai-btn') as HTMLButtonElement;
const filterInput = document.getElementById('filter-input') as HTMLInputElement;
const statusBox = document.querySelector('.lab-status') as HTMLDivElement;
const statusText = document.getElementById('status-text') as HTMLDivElement;
const listEl = document.getElementById('ticker-list') as HTMLDivElement;
const selectedModePill = document.getElementById('selected-mode-pill') as HTMLDivElement;
const modeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.mode-card'));

const search = new URLSearchParams(window.location.search);
const saved = readPreferences();
const qSymbol = normalizeTicker(search.get('symbol') || search.get('ticker'));
const qTf = search.get('tf') || search.get('timeframe');
const qMode = normalizeMode(search.get('destination') || search.get('mode'));

let selectedTicker = qSymbol || saved.symbol || 'THYAO';
let selectedMode: LaunchMode = qMode || saved.mode || 'analysis';

tickerInput.value = selectedTicker;
tfInput.value = normalizeTimeframe(qTf || saved.tf || '1h');
setMode(selectedMode);

function normalizeTimeframe(raw: string): TimeFrame {
    const allowed = new Set<TimeFrame>(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']);
    return allowed.has(raw as TimeFrame) ? raw as TimeFrame : '1h';
}

function normalizeMode(raw: string | null | undefined): LaunchMode | null {
    if (!raw) return null;
    return raw === 'backtest'
        ? 'backtest'
        : raw === 'analysis'
            ? 'analysis'
            : raw === 'ai'
                ? 'ai'
                : null;
}

function readPreferences(): { symbol?: string; tf?: TimeFrame; mode?: LaunchMode } {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function persistPreferences(): void {
    try {
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                symbol: selectedTicker,
                tf: tfInput.value,
                mode: selectedMode,
            })
        );
    } catch {
        // Ignore localStorage failures.
    }
}

function setMode(mode: LaunchMode): void {
    selectedMode = mode;
    modeButtons.forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });
    selectedModePill.textContent = mode === 'analysis'
        ? 'Analiz modu secili'
        : mode === 'backtest'
            ? 'Backtest workspace secili'
            : 'AI Copilot secili';
    persistPreferences();
}

function setStatus(message: string, kind: 'neutral' | 'ok' | 'err' = 'neutral'): void {
    statusText.textContent = message;
    statusBox.classList.remove('ok', 'err');
    if (kind === 'ok') statusBox.classList.add('ok');
    if (kind === 'err') statusBox.classList.add('err');
}

function renderList(): void {
    const needle = (filterInput.value || '').trim().toUpperCase();
    const visible = needle.length === 0
        ? TICKERS
        : TICKERS.filter((ticker) => ticker.includes(needle));

    listEl.innerHTML = '';
    if (visible.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ticker-empty';
        empty.textContent = 'Filtreye uyan hisse yok.';
        listEl.appendChild(empty);
        return;
    }

    visible.forEach((ticker) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `ticker-item${ticker === selectedTicker ? ' active' : ''}`;
        button.textContent = ticker;
        button.addEventListener('click', () => {
            selectedTicker = ticker;
            tickerInput.value = ticker;
            persistPreferences();
            renderList();
        });
        listEl.appendChild(button);
    });
}

function getFormTicker(): string | null {
    const normalized = normalizeTicker(tickerInput.value);
    if (!normalized) {
        setStatus('Hisse kodu gerekli.', 'err');
        return null;
    }

    selectedTicker = normalized;
    tickerInput.value = normalized;
    persistPreferences();
    renderList();
    return normalized;
}

async function testData(): Promise<void> {
    const symbol = getFormTicker();
    if (!symbol) return;
    const tf = normalizeTimeframe(tfInput.value || '1h');
    setStatus(`${symbol} (${tf}) verisi kontrol ediliyor...`);

    try {
        const url = `/api/v1/candles?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}&limit=50`;
        const res = await fetch(url);
        const raw = await res.text();
        if (!res.ok) {
            setStatus(`Istek basarisiz: HTTP ${res.status} ${raw.slice(0, 140)}`, 'err');
            return;
        }

        const payload = JSON.parse(raw) as { data?: Array<{ t: number }>; hasMore?: boolean };
        const rows = payload.data?.length || 0;
        if (rows === 0) {
            setStatus(`${symbol} (${tf}) icin veri bulunamadi.`, 'err');
            return;
        }

        const first = payload.data![0].t;
        const last = payload.data![rows - 1].t;
        const firstIso = new Date(first * 1000).toISOString().slice(0, 16).replace('T', ' ');
        const lastIso = new Date(last * 1000).toISOString().slice(0, 16).replace('T', ' ');
        setStatus(`${symbol} ${tf} hazir. ${rows} bar bulundu (${firstIso} -> ${lastIso}).`, 'ok');
    } catch (err) {
        setStatus(`Veri testi basarisiz: ${(err as Error).message}`, 'err');
    }
}

function deriveBacktestFrames(triggerTf: TimeFrame): { trendTf: string; setupTf: string; triggerTf: string } {
    const map: Record<TimeFrame, { trendTf: string; setupTf: string; triggerTf: string }> = {
        '1m': { trendTf: '1h', setupTf: '15m', triggerTf: '1m' },
        '5m': { trendTf: '4h', setupTf: '1h', triggerTf: '5m' },
        '15m': { trendTf: '1d', setupTf: '4h', triggerTf: '15m' },
        '1h': { trendTf: '1d', setupTf: '4h', triggerTf: '1h' },
        '4h': { trendTf: '1w', setupTf: '1d', triggerTf: '4h' },
        '1d': { trendTf: '1w', setupTf: '1d', triggerTf: '4h' },
        '1w': { trendTf: '1M', setupTf: '1w', triggerTf: '1d' },
        '1M': { trendTf: '1M', setupTf: '1w', triggerTf: '1d' },
    };
    return map[triggerTf];
}

function openAnalysis(): void {
    const symbol = getFormTicker();
    if (!symbol) return;
    const tf = normalizeTimeframe(tfInput.value || '1h');
    const url = `/chart.html?symbol=${encodeURIComponent(symbol)}&tf=${encodeURIComponent(tf)}`;
    window.location.href = url;
}

function openBacktest(): void {
    const symbol = getFormTicker();
    if (!symbol) return;
    const frames = deriveBacktestFrames(normalizeTimeframe(tfInput.value || '1h'));
    const params = new URLSearchParams({
        symbol,
        trendTf: frames.trendTf,
        setupTf: frames.setupTf,
        triggerTf: frames.triggerTf,
    });
    window.location.href = `/backtest.html?${params.toString()}`;
}

function openAi(): void {
    window.location.href = '/ai.html';
}

testBtn.addEventListener('click', () => {
    void testData();
});

openAnalysisBtn.addEventListener('click', openAnalysis);
openBacktestBtn.addEventListener('click', openBacktest);
openAiBtn.addEventListener('click', openAi);
filterInput.addEventListener('input', renderList);
tfInput.addEventListener('change', persistPreferences);

modeButtons.forEach((button) => {
    button.addEventListener('click', () => {
        const nextMode = normalizeMode(button.dataset.mode);
        if (nextMode) setMode(nextMode);
    });
});

tickerInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (selectedMode === 'analysis') {
        openAnalysis();
        return;
    }
    if (selectedMode === 'ai') {
        openAi();
        return;
    }
    openBacktest();
});

renderList();
