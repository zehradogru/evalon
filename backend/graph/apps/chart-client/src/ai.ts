import { TICKERS, normalizeTicker } from './data/tickers';

type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M';
type ChatRole = 'user' | 'assistant' | 'tool' | 'system';
type DrawerView = 'context' | 'assets' | 'activity';

type AiSessionMessage = {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    created_at: number;
    name?: string | null;
    metadata?: {
        suggestedActions?: string[];
        savedAssets?: Array<{ asset_id?: string; title?: string; kind?: string }>;
    };
};

type AiToolResult = {
    tool: string;
    arguments: Record<string, unknown>;
    result?: unknown;
    error?: string;
};

type AiMessageResponse = {
    sessionId: string;
    message: AiSessionMessage;
    plan?: unknown;
    toolResults: AiToolResult[];
    savedAssets: Array<Record<string, unknown>>;
    errors: string[];
    drafts?: Record<string, unknown>;
};

type AiAssetsResponse = {
    userId: string;
    counts: Record<string, number>;
    assets: Record<string, Array<{ title?: string; description?: string; updated_at?: number; kind?: string }>>;
};

type CreateSessionResponse = {
    sessionId: string;
    userId: string;
    createdAt: number;
    title?: string | null;
    messages: AiSessionMessage[];
};

const STORAGE_KEY = 'graph.ai.workspace.v1';
const DEFAULT_USER_ID = 'demo';

const sessionPill = document.getElementById('ai-session-pill') as HTMLDivElement;
const statusEl = document.getElementById('ai-status') as HTMLDivElement;
const suggestionLabelEl = document.getElementById('ai-suggestion-label') as HTMLSpanElement;
const suggestionsEl = document.getElementById('ai-suggestions') as HTMLDivElement;
const messagesEl = document.getElementById('ai-messages') as HTMLDivElement;
const composerEl = document.getElementById('ai-composer') as HTMLFormElement;
const inputEl = document.getElementById('ai-input') as HTMLTextAreaElement;
const sendBtn = document.getElementById('ai-send') as HTMLButtonElement;
const newSessionBtn = document.getElementById('ai-new-session') as HTMLButtonElement;
const contextPreviewEl = document.getElementById('ai-context-preview') as HTMLDivElement;
const openAnalysisLink = document.getElementById('ai-open-analysis') as HTMLAnchorElement;
const openBacktestLink = document.getElementById('ai-open-backtest') as HTMLAnchorElement;

const openContextBtn = document.getElementById('ai-open-context') as HTMLButtonElement;
const openAssetsBtn = document.getElementById('ai-open-assets') as HTMLButtonElement;
const openActivityBtn = document.getElementById('ai-open-activity') as HTMLButtonElement;
const drawerEl = document.getElementById('ai-drawer') as HTMLDivElement;
const drawerBackdropEl = document.getElementById('ai-drawer-backdrop') as HTMLDivElement;
const closeDrawerBtn = document.getElementById('ai-close-drawer') as HTMLButtonElement;
const drawerTitleEl = document.getElementById('ai-drawer-title') as HTMLHeadingElement;
const drawerKickerEl = document.getElementById('ai-drawer-kicker') as HTMLParagraphElement;

const tickerInput = document.getElementById('ai-ticker') as HTMLInputElement;
const timeframeInput = document.getElementById('ai-timeframe') as HTMLSelectElement;
const symbolsInput = document.getElementById('ai-symbols') as HTMLInputElement;
const autoSaveInput = document.getElementById('ai-auto-save') as HTMLInputElement;
const tickerDatalist = document.getElementById('ai-ticker-list') as HTMLDataListElement;

const assetsSummaryEl = document.getElementById('ai-assets-summary') as HTMLDivElement;
const assetsListEl = document.getElementById('ai-assets-list') as HTMLDivElement;
const toolResultsEl = document.getElementById('ai-tool-results') as HTMLDivElement;

const drawerViews: Record<DrawerView, HTMLDivElement> = {
    context: document.getElementById('ai-drawer-view-context') as HTMLDivElement,
    assets: document.getElementById('ai-drawer-view-assets') as HTMLDivElement,
    activity: document.getElementById('ai-drawer-view-activity') as HTMLDivElement,
};

const search = new URLSearchParams(window.location.search);
const saved = readWorkspaceState();

let currentSessionId = '';
let currentMessages: Array<{ role: ChatRole; content: string; createdAt?: number; metadata?: Record<string, unknown> }> = [];
let latestToolResults: AiToolResult[] = [];
let latestDrafts: Record<string, unknown> = {};
let latestErrors: string[] = [];
let latestSuggestedActions: string[] = [];
let sending = false;

bootstrap().catch((error) => {
    renderSystemMessage(`Workspace acilamadi: ${(error as Error).message}`);
    setStatus('AI workspace baslatilamadi.');
});

async function bootstrap(): Promise<void> {
    hydrateContext();
    renderTickerOptions();
    bindEvents();
    updateNavLinks();
    renderContextPreview();
    setSuggestedActions(defaultStarterSuggestions(), 'Hizli baslangic');
    renderMessages();
    await ensureSession();
    await loadAssets();
}

function hydrateContext(): void {
    const queryTicker = normalizeTicker(search.get('symbol') || search.get('ticker'));
    const queryTf = normalizeTimeframe(search.get('tf') || search.get('timeframe'));
    tickerInput.value = queryTicker || saved.ticker || '';
    timeframeInput.value = queryTf || saved.timeframe || '';
    symbolsInput.value = saved.selectedSymbols || '';
    autoSaveInput.checked = saved.autoSave ?? true;
}

function bindEvents(): void {
    composerEl.addEventListener('submit', (event) => {
        event.preventDefault();
        void sendCurrentMessage();
    });

    inputEl.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void sendCurrentMessage();
        }
    });

    newSessionBtn.addEventListener('click', () => {
        void resetSession();
    });

    openContextBtn.addEventListener('click', () => {
        openDrawer('context');
    });
    openAssetsBtn.addEventListener('click', () => {
        openDrawer('assets');
    });
    openActivityBtn.addEventListener('click', () => {
        openDrawer('activity');
    });
    closeDrawerBtn.addEventListener('click', closeDrawer);
    drawerBackdropEl.addEventListener('click', closeDrawer);

    [tickerInput, timeframeInput, symbolsInput, autoSaveInput].forEach((element) => {
        element.addEventListener('change', () => {
            persistWorkspaceState();
            updateNavLinks();
            renderContextPreview();
        });
    });

    tickerInput.addEventListener('blur', () => {
        tickerInput.value = normalizeTicker(tickerInput.value) || tickerInput.value.trim().toUpperCase();
        persistWorkspaceState();
        updateNavLinks();
        renderContextPreview();
    });
}

async function ensureSession(): Promise<void> {
    if (currentSessionId) return;

    const response = await fetch('/api/v1/ai/sessions', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            userId: DEFAULT_USER_ID,
            title: 'AI copilot session',
        }),
    });
    if (!response.ok) {
        throw new Error(`Session olusturulamadi: HTTP ${response.status}`);
    }

    const payload = await response.json() as CreateSessionResponse;
    currentSessionId = payload.sessionId;
    currentMessages = [];
    latestToolResults = [];
    latestDrafts = {};
    latestErrors = [];
    sessionPill.textContent = shortSessionId(currentSessionId);
    setStatus('Yeni oturum hazir.');
    renderMessages();
    renderActivity();
}

async function resetSession(): Promise<void> {
    currentSessionId = '';
    currentMessages = [];
    latestToolResults = [];
    latestDrafts = {};
    latestErrors = [];
    closeDrawer();
    setSuggestedActions(defaultStarterSuggestions(), 'Hizli baslangic');
    renderMessages();
    renderActivity();
    await ensureSession();
    await loadAssets();
}

async function loadAssets(): Promise<void> {
    const response = await fetch(`/api/v1/ai/assets?userId=${encodeURIComponent(DEFAULT_USER_ID)}`);
    if (!response.ok) {
        assetsSummaryEl.textContent = 'Kayitli taslaklar yuklenemedi.';
        assetsListEl.innerHTML = '';
        return;
    }
    const payload = await response.json() as AiAssetsResponse;
    renderAssets(payload);
}

async function sendCurrentMessage(prefilled?: string): Promise<void> {
    const content = (prefilled ?? inputEl.value).trim();
    if (!content || sending) return;

    await ensureSession();
    sending = true;
    sendBtn.disabled = true;
    setStatus('Copilot dusunuyor...');

    currentMessages.push({
        role: 'user',
        content,
        createdAt: Date.now() / 1000,
    });
    renderMessages();
    inputEl.value = '';

    try {
        const response = await fetch(`/api/v1/ai/sessions/${encodeURIComponent(currentSessionId)}/messages`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                content,
                context: buildRequestContext(),
            }),
        });

        if (!response.ok) {
            const raw = await response.text();
            throw new Error(`HTTP ${response.status} ${raw.slice(0, 200)}`);
        }

        const payload = await response.json() as AiMessageResponse;
        latestToolResults = payload.toolResults || [];
        latestDrafts = payload.drafts || {};
        latestErrors = payload.errors || [];

        currentMessages.push({
            role: 'assistant',
            content: payload.message?.content || 'Hazir.',
            createdAt: payload.message?.created_at,
            metadata: payload.message?.metadata || {},
        });

        if (payload.errors.length > 0) {
            currentMessages.push({
                role: 'system',
                content: `Uyari:\n${payload.errors.join('\n')}`,
                createdAt: Date.now() / 1000,
            });
        }

        const suggested = normalizeActions(payload.message?.metadata?.suggestedActions);
        setSuggestedActions(
            suggested.length > 0 ? suggested : deriveFallbackSuggestions(content),
            currentMessages.length > 0 ? 'Copilot oneriyor' : 'Hizli baslangic'
        );

        renderMessages();
        renderActivity();
        setStatus(buildStatusFromResults(payload));
        persistWorkspaceState();
        await loadAssets();
    } catch (error) {
        currentMessages.push({
            role: 'system',
            content: `Mesaj gonderilemedi: ${(error as Error).message}`,
            createdAt: Date.now() / 1000,
        });
        setSuggestedActions(recoverySuggestions(), 'Tekrar dene');
        renderMessages();
        renderActivity();
        setStatus('Mesaj gonderimi basarisiz.');
    } finally {
        sending = false;
        sendBtn.disabled = false;
    }
}

function buildRequestContext(): Record<string, unknown> {
    const ticker = normalizeTicker(tickerInput.value);
    const timeframe = normalizeTimeframe(timeframeInput.value);
    return {
        user_id: DEFAULT_USER_ID,
        ticker: ticker || null,
        timeframe: timeframe || null,
        selected_symbols: parseSymbolList(symbolsInput.value),
        auto_save_drafts: autoSaveInput.checked,
    };
}

function renderMessages(): void {
    messagesEl.innerHTML = '';

    if (currentMessages.length === 0) {
        const empty = document.createElement('article');
        empty.className = 'ai-message assistant';
        empty.innerHTML = `
          <div class="ai-message-head">
            <div class="ai-role">copilot</div>
            <div class="ai-message-meta">Hazir</div>
          </div>
          <div class="ai-message-body">
            <p>Hangi hisse veya hisselerde calismak istiyorsun?</p>
            <p>Teknik analiz, rule taslagi, yeni indicator ya da backtest hedefini yaz. Gerekli detaylari ben sirayla sorayim.</p>
          </div>
        `;
        messagesEl.appendChild(empty);
        return;
    }

    currentMessages.forEach((message) => {
        const el = document.createElement('article');
        el.className = `ai-message ${message.role === 'assistant' ? 'assistant' : message.role === 'user' ? 'user' : 'system'}`;
        el.innerHTML = `
          <div class="ai-message-head">
            <div class="ai-role">${labelForRole(message.role)}</div>
            <div class="ai-message-meta">${formatEpoch(message.createdAt)}</div>
          </div>
          <div class="ai-message-body">${renderRichText(message.content)}</div>
        `;
        messagesEl.appendChild(el);
    });

    messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setSuggestedActions(actions: string[], label: string): void {
    latestSuggestedActions = normalizeActions(actions);
    suggestionLabelEl.textContent = label;
    renderSuggestions();
}

function renderSuggestions(): void {
    suggestionsEl.innerHTML = '';
    const actions = latestSuggestedActions.length > 0 ? latestSuggestedActions : defaultStarterSuggestions();

    actions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ai-suggestion-button';
        button.textContent = action;
        button.addEventListener('click', () => {
            void sendCurrentMessage(action);
        });
        suggestionsEl.appendChild(button);
    });
}

function renderAssets(payload: AiAssetsResponse): void {
    const counts = payload.counts || {};
    assetsSummaryEl.textContent = `Strategy ${counts.strategies || 0} · Rule ${counts.rules || 0} · Indicator ${counts.indicators || 0}`;
    assetsListEl.innerHTML = '';

    const entries = Object.entries(payload.assets || {})
        .flatMap(([kind, items]) => items.map((item) => ({ ...item, kind })))
        .sort((a, b) => Number(b.updated_at || 0) - Number(a.updated_at || 0))
        .slice(0, 12);

    if (entries.length === 0) {
        assetsListEl.innerHTML = '<div class="ai-empty">Henuz kayitli draft yok.</div>';
        return;
    }

    entries.forEach((asset) => {
        const card = document.createElement('article');
        card.className = 'ai-asset-card';
        card.innerHTML = `
          <strong>${escapeHtml(asset.title || 'Untitled')}</strong>
          <div class="ai-asset-meta">${escapeHtml(String(asset.kind || 'asset'))} · ${formatEpoch(asset.updated_at)}</div>
          <p>${escapeHtml(asset.description || 'Aciklama yok.')}</p>
        `;
        assetsListEl.appendChild(card);
    });
}

function renderActivity(): void {
    toolResultsEl.innerHTML = '';

    if (Object.keys(latestDrafts).length > 0) {
        const draftCard = document.createElement('article');
        draftCard.className = 'ai-tool-card success';
        draftCard.innerHTML = `
          <strong>Olusan taslaklar</strong>
          <div class="ai-tool-card-meta">${Object.keys(latestDrafts).join(', ')}</div>
          <pre>${escapeHtml(JSON.stringify(latestDrafts, null, 2))}</pre>
        `;
        toolResultsEl.appendChild(draftCard);
    }

    if (latestErrors.length > 0) {
        const errorCard = document.createElement('article');
        errorCard.className = 'ai-tool-card error';
        errorCard.innerHTML = `
          <strong>Workflow uyarilari</strong>
          <div class="ai-tool-card-meta">${latestErrors.length} hata ya da warning kaydi</div>
          <pre>${escapeHtml(latestErrors.join('\n'))}</pre>
        `;
        toolResultsEl.appendChild(errorCard);
    }

    latestToolResults.forEach((toolResult) => {
        const card = document.createElement('article');
        card.className = `ai-tool-card ${toolResult.error ? 'error' : 'success'}`;
        card.innerHTML = `
          <strong>${toolResult.tool}</strong>
          <div class="ai-tool-card-meta">${summarizeToolResult(toolResult)}</div>
          <pre>${escapeHtml(JSON.stringify(toolResult.error ? { error: toolResult.error, arguments: toolResult.arguments } : toolResult.result, null, 2))}</pre>
        `;
        toolResultsEl.appendChild(card);
    });

    if (toolResultsEl.childElementCount === 0) {
        toolResultsEl.innerHTML = '<div class="ai-empty">Bu oturumda henuz tool aktivitesi yok.</div>';
    }
}

function renderContextPreview(): void {
    const chips: string[] = [];
    const ticker = normalizeTicker(tickerInput.value);
    const timeframe = normalizeTimeframe(timeframeInput.value);
    const symbols = parseSymbolList(symbolsInput.value);

    if (ticker) chips.push(ticker);
    if (timeframe) chips.push(`TF ${timeframe}`);
    if (symbols.length > 0) chips.push(`Ek sembol ${symbols.length}`);
    if (!ticker && !timeframe && symbols.length === 0) chips.push('Context bos');
    chips.push(autoSaveInput.checked ? 'Auto-save acik' : 'Auto-save kapali');

    contextPreviewEl.innerHTML = '';
    chips.forEach((label) => {
        const chip = document.createElement('span');
        chip.className = 'ai-context-chip';
        chip.textContent = label;
        contextPreviewEl.appendChild(chip);
    });
}

function renderTickerOptions(): void {
    tickerDatalist.innerHTML = '';
    TICKERS.forEach((ticker) => {
        const option = document.createElement('option');
        option.value = ticker;
        tickerDatalist.appendChild(option);
    });
}

function openDrawer(view: DrawerView): void {
    drawerViews.context.classList.toggle('active', view === 'context');
    drawerViews.assets.classList.toggle('active', view === 'assets');
    drawerViews.activity.classList.toggle('active', view === 'activity');

    if (view === 'assets') {
        void loadAssets();
        drawerKickerEl.textContent = 'Drafts';
        drawerTitleEl.textContent = 'Kayitli taslaklar';
    } else if (view === 'activity') {
        renderActivity();
        drawerKickerEl.textContent = 'Activity';
        drawerTitleEl.textContent = 'Tool cagrilari ve workflow notlari';
    } else {
        drawerKickerEl.textContent = 'Context';
        drawerTitleEl.textContent = 'Opsiyonel baglam';
    }

    drawerEl.classList.add('open');
    drawerEl.setAttribute('aria-hidden', 'false');
    drawerBackdropEl.classList.add('open');
}

function closeDrawer(): void {
    drawerEl.classList.remove('open');
    drawerEl.setAttribute('aria-hidden', 'true');
    drawerBackdropEl.classList.remove('open');
}

function updateNavLinks(): void {
    const ticker = normalizeTicker(tickerInput.value);
    const timeframe = normalizeTimeframe(timeframeInput.value);

    if (ticker && timeframe) {
        const params = new URLSearchParams({ symbol: ticker, tf: timeframe });
        openAnalysisLink.href = `/chart.html?${params.toString()}`;
        openBacktestLink.href = `/backtest.html?symbol=${encodeURIComponent(ticker)}&triggerTf=${encodeURIComponent(timeframe)}`;
        return;
    }

    openAnalysisLink.href = '/chart.html';
    openBacktestLink.href = '/backtest.html';
}

function buildStatusFromResults(payload: AiMessageResponse): string {
    if (payload.toolResults.length > 0) {
        return `${payload.toolResults.length} tool calisti.`;
    }
    if (payload.savedAssets.length > 0) {
        return `${payload.savedAssets.length} taslak kaydedildi.`;
    }
    return 'Yanit hazir.';
}

function defaultStarterSuggestions(): string[] {
    return [
        'Teknik analiz yapmak istiyorum',
        'Bir backtest stratejisi kurmak istiyorum',
        'Yeni bir rule taslagi olustur',
        'Yeni bir indicator taslagi olustur',
    ];
}

function recoverySuggestions(): string[] {
    return [
        'Tekrar dener misin?',
        'Bu istegi daha kisa sekilde gonder',
        'Sadece analiz istedigimi belirteyim',
        'Sadece backtest istedigimi belirteyim',
    ];
}

function deriveFallbackSuggestions(userMessage: string): string[] {
    const text = userMessage.toLowerCase();
    const ticker = normalizeTicker(tickerInput.value);

    if (!ticker) {
        return [
            'THYAO.IS icin teknik analiz yap',
            'AKBNK.IS icin backtest kur',
            'ASELS.IS icin en iyi presetleri oner',
            'Birden fazla hisse icin tarama yapmak istiyorum',
        ];
    }

    if (text.includes('backtest')) {
        return [
            `${ticker} icin hazir presetleri karsilastir`,
            `${ticker} icin blueprint olustur`,
            `${ticker} icin komisyonlu backtest baslat`,
            `${ticker} icin max DD'yi dusur`,
        ];
    }

    if (text.includes('rule') || text.includes('kural')) {
        return [
            'Bu ruleu daha sikilastir',
            'Bu ruleu trigger asamasina uyarla',
            'Bu rule icin indicator oner',
            'Bu rule ile strateji kur',
        ];
    }

    if (text.includes('indicator') || text.includes('indikat')) {
        return [
            'Bu indicator icin kullanim kuralı yaz',
            'Bu indicatoru sadeleştir',
            'Bu indicator ile strateji kur',
            'Bu indicatoru kaydet',
        ];
    }

    return [
        `${ticker} icin 1h teknik analiz yap`,
        `${ticker} icin RSI analizi yap`,
        `${ticker} icin MACD analizi yap`,
        `${ticker} icin destek direnc belirle`,
    ];
}

function normalizeActions(actions?: string[]): string[] {
    const unique: string[] = [];
    (actions || []).forEach((action) => {
        const clean = action.trim();
        if (!clean || unique.includes(clean)) return;
        unique.push(clean);
    });
    return unique.slice(0, 4);
}

function summarizeToolResult(toolResult: AiToolResult): string {
    if (toolResult.error) return `Hata: ${toolResult.error}`;

    const result = toolResult.result;
    if (!result || typeof result !== 'object') return 'Sonuc hazir';

    const dict = result as Record<string, unknown>;
    if (typeof dict.count === 'number') return `${dict.count} kayit`;
    if (typeof dict.rows === 'number') return `${dict.rows} bar`;
    if (typeof dict.runId === 'string') return `Run ${String(dict.runId).slice(0, 12)}`;
    if (typeof dict.status === 'string') return `Status ${dict.status}`;
    if (typeof dict.asset_id === 'string') return `Asset ${String(dict.asset_id).slice(0, 12)}`;
    return 'Sonuc hazir';
}

function labelForRole(role: ChatRole): string {
    if (role === 'assistant') return 'copilot';
    if (role === 'user') return 'sen';
    if (role === 'tool') return 'tool';
    return 'not';
}

function formatEpoch(epoch?: number): string {
    if (!epoch) return 'simdi';
    try {
        return new Date(epoch * 1000).toLocaleString('tr-TR', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: 'short',
        });
    } catch {
        return 'simdi';
    }
}

function renderRichText(content: string): string {
    const trimmed = content.trim();
    if (!trimmed) return '<p>Yanit bos.</p>';
    const blocks = trimmed.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
    return blocks.map((block) => {
        if (block.startsWith('```') && block.endsWith('```')) {
            return `<pre>${escapeHtml(block.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim())}</pre>`;
        }
        return `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`;
    }).join('');
}

function renderSystemMessage(message: string): void {
    currentMessages.push({ role: 'system', content: message, createdAt: Date.now() / 1000 });
    renderMessages();
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function parseSymbolList(raw: string): string[] {
    return raw
        .split(',')
        .map((item) => normalizeTicker(item))
        .filter((item): item is string => Boolean(item));
}

function normalizeTimeframe(raw: string | null | undefined): TimeFrame | null {
    if (!raw) return null;
    const allowed = new Set<TimeFrame>(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']);
    return allowed.has(raw as TimeFrame) ? raw as TimeFrame : null;
}

function shortSessionId(sessionId: string): string {
    return sessionId ? sessionId.slice(0, 12) : 'Hazir';
}

function readWorkspaceState(): {
    ticker?: string;
    timeframe?: TimeFrame;
    selectedSymbols?: string;
    autoSave?: boolean;
} {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        return JSON.parse(raw) as ReturnType<typeof readWorkspaceState>;
    } catch {
        return {};
    }
}

function persistWorkspaceState(): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ticker: normalizeTicker(tickerInput.value) || tickerInput.value,
            timeframe: normalizeTimeframe(timeframeInput.value) || undefined,
            selectedSymbols: symbolsInput.value,
            autoSave: autoSaveInput.checked,
        }));
    } catch {
        // Ignore localStorage failures.
    }
}

function setStatus(message: string): void {
    statusEl.textContent = message;
}
