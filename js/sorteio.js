import { supabaseUrl, supabaseKey } from '../config/config.js';

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ----- UTILITIES -----

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️', loading: '⏳' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || '🔔'}</span>
        <span class="toast-message">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('active'), 10);
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => toast.remove(), 400);
    }, 4000);
}

function askConfirmation({ title, message, icon, onConfirm }) {
    const modal = document.getElementById('action-modal');
    if (!modal) return;
    document.getElementById('action-modal-title').textContent = title;
    document.getElementById('action-modal-message').textContent = message;
    document.getElementById('action-modal-icon').textContent = icon || '❓';
    modal.classList.add('active');
    document.getElementById('action-confirm-btn').onclick = () => {
        onConfirm();
        modal.classList.remove('active');
    };
    document.getElementById('action-cancel-btn').onclick = () => modal.classList.remove('active');
}

function shortenName(fullName) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 2) return fullName.trim();
    return `${parts[0]} ${parts[parts.length - 1]}`;
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function formatNumber(num) {
    return String(num).padStart(3, '0');
}

// ----- DRAW ALGORITHM -----

function generateWinners(participants) {
    // participants: [{ reservation_id, number, customer_name }, ...]
    // Each entry is one number/chance
    // No repeated number, no repeated winner

    const pool = shuffleArray(participants);
    const winners = [];
    const usedNumbers = new Set();
    const usedNames = new Set();

    for (const entry of pool) {
        if (winners.length >= 4) break;
        if (usedNumbers.has(entry.number)) continue;
        const nameKey = entry.customer_name.trim().toLowerCase();
        if (usedNames.has(nameKey)) continue;

        winners.push({
            position: winners.length + 1,
            reservation_id: entry.reservation_id,
            number: entry.number,
            customer_name: entry.customer_name
        });
        usedNumbers.add(entry.number);
        usedNames.add(nameKey);
    }

    return winners;
}

// ----- SLOT MACHINE ANIMATION -----

function animateSlot(containerEl, participants, winner, position) {
    const emojis = ['🥇', '🥈', '🥉', '🎁'];
    const labels = ['1\u00ba Lugar', '2\u00ba Lugar', '3\u00ba Lugar', '4\u00ba Lugar'];

    const item = document.createElement('div');
    item.className = 'prize-item';
    item.innerHTML = `
        <div class="prize-header">${emojis[position]} ${labels[position]}</div>
        <div class="prize-slot animating" id="slot-${position}">
            <span class="prize-display">---</span>
        </div>
    `;
    containerEl.appendChild(item);

    const slotEl = item.querySelector('.prize-slot');
    const displayEl = item.querySelector('.prize-display');
    const duration = 2000;
    const start = Date.now();
    const tickInterval = 50;

    return new Promise(resolve => {
        function tick() {
            const elapsed = Date.now() - start;
            if (elapsed < duration) {
                const rand = participants[Math.floor(Math.random() * participants.length)];
                displayEl.innerHTML = `<strong>${formatNumber(rand.number)}</strong> ${rand.customer_name}`;
                setTimeout(tick, tickInterval);
            } else {
                const numStr = formatNumber(winner.number);
                displayEl.innerHTML = `<strong class="winner-number">${numStr}</strong> <span class="winner-name">${winner.customer_name}</span>`;
                slotEl.classList.remove('animating');
                slotEl.classList.add('winner-selected');
                resolve();
            }
        }
        tick();
    });
}

function fireConfetti() {
    if (typeof confetti !== 'undefined') {
        confetti({
            particleCount: 120,
            spread: 70,
            origin: { y: 0.55 }
        });
        setTimeout(() => {
            confetti({
                particleCount: 60,
                spread: 100,
                origin: { y: 0.5 }
            });
        }, 400);
    }
}

// ----- FETCH PARTICIPANTS -----

async function fetchPaidParticipants() {
    const { data, error } = await supabase
        .from('raffle_selected_numbers')
        .select(`
            number,
            reservation_id,
            raffle_reservations!inner (
                customer_name,
                status
            )
        `)
        .eq('raffle_reservations.status', 'paid');

    if (error) {
        console.error('Erro ao buscar participantes:', error);
        showToast('Erro ao carregar participantes.', 'error');
        return [];
    }

    return data.map(item => ({
        reservation_id: item.reservation_id,
        number: item.number,
        customer_name: item.raffle_reservations
            ? item.raffle_reservations.customer_name
            : 'Desconhecido'
    }));
}

// ----- SIMULATION -----

let simulationInProgress = false;

async function runSimulation() {
    if (simulationInProgress) return;
    simulationInProgress = true;

    const btn = document.getElementById('btn-simulate');
    const btnAgain = document.getElementById('btn-simulate-again');
    const resultsEl = document.getElementById('simulation-results');

    btn.disabled = true;
    btn.textContent = 'Simulando...';

    const participants = await fetchPaidParticipants();

    if (participants.length < 4) {
        showToast('É necessário pelo menos 4 números pagos para simular.', 'error');
        btn.disabled = false;
        btn.textContent = 'Gerar Simulação';
        simulationInProgress = false;
        return;
    }

    const winners = generateWinners(participants);

    if (winners.length < 4) {
        showToast('Não foi possível gerar 4 vencedores distintos.', 'error');
        btn.disabled = false;
        btn.textContent = 'Gerar Simulação';
        simulationInProgress = false;
        return;
    }

    // Show results area
    resultsEl.classList.remove('hidden');
    resultsEl.innerHTML = '<div class="simulation-title">🎲 Resultado da Simulação</div>';

    // Animate each prize sequentially
    for (let i = 0; i < winners.length; i++) {
        // eslint-disable-next-line no-loop-func
        await animateSlot(resultsEl, participants, winners[i], i);
        await new Promise(r => setTimeout(r, 300));
    }

    // Confetti!
    fireConfetti();

    btn.classList.add('hidden');
    btnAgain.classList.remove('hidden');
    btn.disabled = false;
    simulationInProgress = false;
}

// ----- OFFICIAL DRAW -----

let officialDrawInProgress = false;

async function runOfficialDraw() {
    if (officialDrawInProgress) return;

    // Check raffle status first
    const { data: settings } = await supabase
        .from('raffle_settings')
        .select('raffle_closed')
        .single();

    if (settings?.raffle_closed) {
        showToast('A rifa já foi encerrada. Verifique o histórico.', 'error');
        return;
    }

    // Open confirmation modal
    document.getElementById('official-draw-modal').classList.add('active');
}

async function confirmOfficialDraw() {
    if (officialDrawInProgress) return;
    officialDrawInProgress = true;

    const modal = document.getElementById('official-draw-modal');
    modal.classList.remove('active');

    const btn = document.getElementById('btn-official-draw');
    const displayEl = document.getElementById('official-winners-display');

    btn.disabled = true;
    btn.textContent = 'Processando...';
    showToast('Realizando sorteio oficial...', 'loading');

    let participants;

    try {
        participants = await fetchPaidParticipants();
    } catch (err) {
        showToast('Erro ao buscar participantes.', 'error');
        btn.disabled = false;
        btn.textContent = 'Realizar Sorteio Oficial';
        officialDrawInProgress = false;
        return;
    }

    if (participants.length < 4) {
        showToast('É necessário pelo menos 4 números pagos.', 'error');
        btn.disabled = false;
        btn.textContent = 'Realizar Sorteio Oficial';
        officialDrawInProgress = false;
        return;
    }

    const winners = generateWinners(participants);

    if (winners.length < 4) {
        showToast('Não foi possível gerar 4 vencedores distintos.', 'error');
        btn.disabled = false;
        btn.textContent = 'Realizar Sorteio Oficial';
        officialDrawInProgress = false;
        return;
    }

    // Build insert data
    const winnersData = winners.map(w => ({
        position: w.position,
        reservation_id: w.reservation_id,
        number: w.number,
        customer_name: w.customer_name
    }));

    try {
        // Insert winners
        const { error: insertError } = await supabase
            .from('raffle_winners')
            .insert(winnersData);

        if (insertError) throw insertError;

        // Update raffle settings
        const { error: updateError } = await supabase
            .from('raffle_settings')
            .update({
                raffle_closed: true,
                draw_date: new Date().toISOString()
            })
            .eq('id', 1);

        if (updateError) {
            // Rollback winners
            await supabase.from('raffle_winners').delete().neq('id', 0);
            throw updateError;
        }

        showToast('Sorteio oficial realizado com sucesso!', 'success');

        // Show winners in card
        displayEl.classList.remove('hidden');
        displayEl.innerHTML = '<div class="simulation-title" style="font-size: var(--text-base);">🏆 Vencedores Oficiais</div>';
        const emojis = ['🥇', '🥈', '🥉', '🎁'];
        winners.forEach((w, i) => {
            const card = document.createElement('div');
            card.className = 'official-winner-card';
            card.innerHTML = `
                <div class="official-winner-emoji">${emojis[i]}</div>
                <div class="official-winner-info">
                    <div class="official-winner-position">${i + 1}\u00ba Lugar</div>
                    <div class="official-winner-number">${formatNumber(w.number)}</div>
                    <div class="official-winner-name">${shortenName(w.customer_name)}</div>
                </div>
            `;
            displayEl.appendChild(card);
        });

        btn.textContent = 'Rifa Encerrada';
        btn.disabled = true;

        // Check dev mode and show reset if applicable
        checkDevMode();

        fireConfetti();

    } catch (err) {
        console.error('Erro no sorteio oficial:', err);
        showToast('Erro ao realizar sorteio. Nenhum dado foi gravado.', 'error');
        btn.disabled = false;
        btn.textContent = 'Realizar Sorteio Oficial';
    }

    officialDrawInProgress = false;
}

// ----- DEV MODE -----

async function checkDevMode() {
    const warningEl = document.getElementById('dev-mode-warning');
    try {
        const { data } = await supabase
            .from('raffle_settings')
            .select('development_mode, raffle_closed')
            .single();

        if (data?.development_mode) {
            warningEl.classList.remove('hidden');
            if (data?.raffle_closed) {
                document.getElementById('btn-reset-raffle').classList.remove('hidden');
            } else {
                document.getElementById('btn-reset-raffle').classList.add('hidden');
            }
        } else {
            warningEl.classList.add('hidden');
        }
    } catch (e) {
        warningEl.classList.add('hidden');
    }
}

async function resetRaffle() {
    askConfirmation({
        title: 'Resetar Sorteio?',
        message: 'Todos os vencedores serão removidos e a rifa voltará ao estado aberto. Esta ação não pode ser desfeita.',
        icon: '🗑',
        onConfirm: async () => {
            showToast('Resetando sorteio...', 'loading');
            try {
                // Delete all winners
                const { error: delError } = await supabase
                    .from('raffle_winners')
                    .delete()
                    .neq('id', 0);

                if (delError) throw delError;

                // Update settings
                const { error: updError } = await supabase
                    .from('raffle_settings')
                    .update({
                        raffle_closed: false,
                        draw_date: null
                    })
                    .eq('id', 1);

                if (updError) throw updError;

                showToast('Sorteio resetado! Rifa está aberta novamente.', 'success');

                // Reset UI
                const btn = document.getElementById('btn-official-draw');
                btn.textContent = 'Realizar Sorteio Oficial';
                btn.disabled = false;

                document.getElementById('official-winners-display').classList.add('hidden');
                document.getElementById('btn-reset-raffle').classList.add('hidden');

                // Clear simulation too
                document.getElementById('simulation-results').classList.add('hidden');
                document.getElementById('btn-simulate').classList.remove('hidden');
                document.getElementById('btn-simulate-again').classList.add('hidden');

                loadHistory();

            } catch (err) {
                console.error('Erro ao resetar:', err);
                showToast('Erro ao resetar sorteio.', 'error');
            }
        }
    });
}

// ----- HISTORY -----

async function loadHistory() {
    const container = document.getElementById('winners-history');
    if (!container) return;

    try {
        const { data, error } = await supabase
            .from('raffle_winners')
            .select('*')
            .order('position', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<p class="history-empty">Nenhum sorteio realizado ainda.</p>';
            return;
        }

        const emojis = ['🥇', '🥈', '🥉', '🎁'];
        container.innerHTML = '';

        data.forEach(w => {
            const card = document.createElement('div');
            card.className = 'history-card';
            const idx = w.position - 1;
            const dateStr = w.created_at
                ? new Date(w.created_at).toLocaleDateString('pt-BR')
                : '';
            card.innerHTML = `
                <div class="history-emoji">${emojis[idx] || '🎫'}</div>
                <div class="history-info">
                    <div class="history-position">${w.position}\u00ba Pr\u00eamio</div>
                    <div class="history-number">${formatNumber(w.number)}</div>
                    <div class="history-name">${shortenName(w.customer_name)}</div>
                    <div class="history-date">${dateStr}</div>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        container.innerHTML = '<p class="history-empty">Erro ao carregar histórico.</p>';
    }
}

// ----- AUTH -----

async function initSorteio() {
    const loginSection = document.getElementById('sorteio-login-section');
    const dashboardSection = document.getElementById('sorteio-dashboard-section');
    if (!loginSection || !dashboardSection) return;

    const loginForm = document.getElementById('sorteio-login-form');
    const logoutBtn = document.getElementById('btn-sorteio-logout');
    const userEmailEl = document.getElementById('sorteio-user-email');

    function toggleView(isLoggedIn) {
        if (isLoggedIn) {
            loginSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
        } else {
            loginSection.classList.remove('hidden');
            dashboardSection.classList.add('hidden');
        }
    }

    async function checkSession() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: admin, error } = await supabase
                    .from('admins')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();

                if (admin && !error) {
                    userEmailEl.textContent = session.user.email;
                    toggleView(true);
                    await initDashboard();
                } else {
                    await supabase.auth.signOut();
                    toggleView(false);
                    window.location.href = 'admin.html';
                }
            } else {
                window.location.href = 'admin.html';
            }
        } catch (err) {
            console.error('Erro ao verificar sessão:', err);
            window.location.href = 'admin.html';
        }
    }

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('sorteio-email').value;
        const password = document.getElementById('sorteio-password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) showToast('Login falhou: ' + error.message, 'error');
        else checkSession();
    };

    logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    checkSession();
}

// ----- DASHBOARD SETUP -----

async function initDashboard() {
    // Fetch and display participant stats
    const participants = await fetchPaidParticipants();
    const uniqueParticipants = new Set(participants.map(p => p.reservation_id));
    document.getElementById('total-participants').textContent = uniqueParticipants.size;
    document.getElementById('total-paid-numbers').textContent = participants.length;

    // Check dev mode
    checkDevMode();

    // Load history
    loadHistory();

    // Check if raffle is already closed - adjust button state
    try {
        const { data: settings } = await supabase
            .from('raffle_settings')
            .select('raffle_closed')
            .single();

        if (settings?.raffle_closed) {
            const btn = document.getElementById('btn-official-draw');
            btn.textContent = 'Rifa Encerrada';
            btn.disabled = true;

            // Show existing winners in card
            const { data: existingWinners } = await supabase
                .from('raffle_winners')
                .select('*')
                .order('position', { ascending: true });

            if (existingWinners && existingWinners.length > 0) {
                const displayEl = document.getElementById('official-winners-display');
                displayEl.classList.remove('hidden');
                displayEl.innerHTML = '<div class="simulation-title" style="font-size: var(--text-base);">🏆 Vencedores Oficiais</div>';
                const emojis = ['🥇', '🥈', '🥉', '🎁'];
                existingWinners.forEach((w, i) => {
                    const card = document.createElement('div');
                    card.className = 'official-winner-card';
                    card.innerHTML = `
                        <div class="official-winner-emoji">${emojis[i]}</div>
                        <div class="official-winner-info">
                            <div class="official-winner-position">${w.position}\u00ba Lugar</div>
                            <div class="official-winner-number">${formatNumber(w.number)}</div>
                            <div class="official-winner-name">${shortenName(w.customer_name)}</div>
                        </div>
                    `;
                    displayEl.appendChild(card);
                });
            }
        }
    } catch (e) {
        // Settings table might not exist yet
    }

    // ---- Event Listeners ----

    document.getElementById('btn-simulate').onclick = runSimulation;
    document.getElementById('btn-simulate-again').onclick = runSimulation;

    document.getElementById('btn-official-draw').onclick = runOfficialDraw;
    document.getElementById('btn-cancel-official').onclick = () => {
        document.getElementById('official-draw-modal').classList.remove('active');
    };
    document.getElementById('btn-confirm-official').onclick = confirmOfficialDraw;

    document.getElementById('btn-reset-raffle').onclick = resetRaffle;
}

// ----- INIT -----

document.addEventListener('DOMContentLoaded', () => {
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
    initSorteio();
});
