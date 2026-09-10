import { supabaseUrl, supabaseKey } from '../config/config.js';

// Inicialização do Supabase
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Total de números da rifa (compartilhado entre index e admin)
const TOTAL_SYSTEM_NUMBERS = 500;

// --- UTILITÁRIOS GLOBAIS ---

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        info: 'ℹ️',
        loading: '⏳'
    };

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

    const titleEl = document.getElementById('action-modal-title');
    const msgEl = document.getElementById('action-modal-message');
    const iconEl = document.getElementById('action-modal-icon');
    const confirmBtn = document.getElementById('action-confirm-btn');
    const cancelBtn = document.getElementById('action-cancel-btn');

    titleEl.textContent = title;
    msgEl.textContent = message;
    iconEl.textContent = icon || '❓';

    modal.classList.add('active');

    confirmBtn.onclick = () => {
        onConfirm();
        modal.classList.remove('active');
    };

    cancelBtn.onclick = () => modal.classList.remove('active');
}

function maskPhone(value) {
    if (!value) return "";
    return value
        .replace(/\D/g, '')
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
        .replace(/(-\d{4})\d+?$/, '$1');
}

// --- LÓGICA DA PÁGINA INICIAL (index.html) ---

async function initIndex() {
    const grid = document.getElementById('raffle-grid');
    const searchInput = document.getElementById('search-number');
    if (!grid || !searchInput) return;

    const availableCountEl = document.getElementById('available-count');
    const pendingCountEl = document.getElementById('pending-count');
    const paidCountEl = document.getElementById('paid-count');
    const reservationModal = document.getElementById('reservation-modal');
    const reservationForm = document.getElementById('reservation-form');
    const closeModalBtn = document.getElementById('close-modal');
    
    const confirmOrderModal = document.getElementById('confirm-order-modal');
    const orderSummaryEl = document.getElementById('order-summary');
    const cancelOrderBtn = document.getElementById('cancel-order-btn');
    const finalConfirmBtn = document.getElementById('final-confirm-btn');

    const selectionBar = document.getElementById('selection-bar');
    const selectedCountEl = document.getElementById('selected-count');
    const selectedTotalEl = document.getElementById('selected-total');

    const loadMoreContainer = document.getElementById('load-more-container');
    const btnLoadMore = document.getElementById('btn-load-more');

    let occupiedNumbers = [];
    let selectedNumbers = [];
    const PRICE_SINGLE = 5.00;
    const PRICE_BUNDLE_3 = 12.00;
    const NUMBERS_PER_PAGE = 100;
    let visibleNumbersCount = NUMBERS_PER_PAGE;

    function calculateTotal(count) {
        const bundlesOf3 = Math.floor(count / 3);
        const remaining = count % 3;
        return (bundlesOf3 * PRICE_BUNDLE_3) + (remaining * PRICE_SINGLE);
    }

    const phoneInput = document.getElementById('customer-phone');
    if (phoneInput) {
        phoneInput.oninput = (e) => {
            e.target.value = maskPhone(e.target.value);
        };
    }

    async function fetchOccupiedNumbers() {
        try {
            const { data, error } = await supabase
                .from('raffle_selected_numbers')
                .select(`
                    number,
                    raffle_reservations ( 
                        status,
                        customer_name
                    )
                `);

            if (error) throw error;

            occupiedNumbers = data
                .map(item => ({
                    number: item.number,
                    status: item.raffle_reservations ? item.raffle_reservations.status : 'available',
                    customer_name: item.raffle_reservations ? item.raffle_reservations.customer_name : null
                }))
                .filter(n => n.status !== 'cancelled');

            renderGrid();
            updateStats();
        } catch (err) {
            console.error("Erro ao carregar números ocupados:", err);
            showToast('Erro ao carregar dados do sistema.', 'error');
        }
    }

    function renderGrid() {
        const filterVal = searchInput.value.trim();
        const fragment = document.createDocumentFragment();
        let renderedCount = 0;

        for (let i = 1; i <= TOTAL_SYSTEM_NUMBERS; i++) {
            const paddedNumber = String(i).padStart(3, '0');
            
            // Se estiver buscando, filtra
            if (filterVal && !paddedNumber.includes(filterVal)) continue;

            // Se NÃO estiver buscando, respeita o limite de carregamento (paginação)
            if (!filterVal && renderedCount >= visibleNumbersCount) break;

            const occupied = occupiedNumbers.find(n => n.number === i);
            const isSelected = selectedNumbers.includes(i);
            
            const card = document.createElement('div');
            card.className = 'number-card';
            
            const numSpan = document.createElement('span');
            numSpan.textContent = paddedNumber;
            card.appendChild(numSpan);

            if (occupied && (occupied.status === 'pending' || occupied.status === 'paid')) {
                card.classList.add(occupied.status);

                // Adicionar nome do comprador se estiver pago
                if (occupied.status === 'paid' && occupied.customer_name) {
                    const firstName = occupied.customer_name.split(' ')[0];
                    const nameEl = document.createElement('span');
                    nameEl.className = 'buyer-name';
                    nameEl.textContent = firstName;
                    card.appendChild(nameEl);
                }

                card.onclick = () => showToast(`O número ${paddedNumber} já está ocupado.`, 'info');
            } else if (!raffleClosed) {
                card.classList.add('available');
                if (isSelected) card.classList.add('selected');
                card.onclick = () => toggleNumberSelection(i);
            } else {
                card.classList.add('available');
                card.classList.add('blocked');
            }
            fragment.appendChild(card);
            renderedCount++;
        }

        grid.innerHTML = '';
        if (renderedCount === 0) {
            grid.innerHTML = '<div class="grid-full text-center p-3 text-muted">Nenhum número encontrado.</div>';
        } else {
            grid.appendChild(fragment);
        }

        // Mostrar/Esconder botão "Ver mais"
        if (!filterVal && visibleNumbersCount < TOTAL_SYSTEM_NUMBERS) {
            loadMoreContainer.classList.remove('hidden');
        } else {
            loadMoreContainer.classList.add('hidden');
        }
    }

    if (btnLoadMore) {
        btnLoadMore.onclick = () => {
            visibleNumbersCount += NUMBERS_PER_PAGE;
            renderGrid();
        };
    }

    function toggleNumberSelection(number) {
        const index = selectedNumbers.indexOf(number);
        if (index > -1) {
            selectedNumbers.splice(index, 1);
        } else {
            selectedNumbers.push(number);
        }
        updateSelectionUI();
        renderGrid();
    }

    function updateSelectionUI() {
        const count = selectedNumbers.length;
        const total = calculateTotal(count);

        if (count > 0) selectionBar.classList.add('active');
        else selectionBar.classList.remove('active');

        if (selectedCountEl) selectedCountEl.textContent = count;
        if (selectedTotalEl) selectedTotalEl.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;
    }

    function updateStats() {
        const pending = occupiedNumbers.filter(n => n.status === 'pending').length;
        const paid = occupiedNumbers.filter(n => n.status === 'paid').length;
        if (availableCountEl) availableCountEl.textContent = TOTAL_SYSTEM_NUMBERS - (pending + paid);
        if (pendingCountEl) pendingCountEl.textContent = pending;
        if (paidCountEl) paidCountEl.textContent = paid;
    }

    // --- RAFFLE CLOSED STATE ---
    let raffleClosed = false;

    async function checkRaffleClosed() {
        try {
            const { data, error } = await supabase
                .from('raffle_settings')
                .select('raffle_closed')
                .single();
            if (!error && data?.raffle_closed) {
                raffleClosed = true;
                showRaffleClosedUI();
                return true;
            }
        } catch (e) {}
        return false;
    }

    async function showRaffleClosedUI() {
        const closedSection = document.getElementById('raffle-closed-section');
        if (closedSection) closedSection.classList.remove('hidden');

        // Hide selection bar
        if (selectionBar) selectionBar.classList.remove('active');

        // Hide load more
        if (loadMoreContainer) loadMoreContainer.classList.add('hidden');

        await fetchAndDisplayWinners();
    }

    async function fetchAndDisplayWinners() {
        const list = document.getElementById('winners-list');
        if (!list) return;

        try {
            const { data, error } = await supabase
                .from('raffle_winners')
                .select('*')
                .order('position', { ascending: true });

            if (error) throw error;

            if (!data || data.length === 0) {
                list.innerHTML = '<p class="text-muted text-center p-3">Nenhum vencedor registrado.</p>';
                return;
            }

            list.innerHTML = '';
            data.forEach(w => {
                const card = document.createElement('div');
                card.className = 'winner-card';
                const emoji = ['🥇', '🥈', '🥉', '🎁'][w.position - 1] || '🎫';
                card.innerHTML = `
                    <div class="winner-emoji">${emoji}</div>
                    <div class="winner-info">
                        <div class="winner-position">${w.position}\u00ba Pr\u00eamio</div>
                        <div class="winner-number">${String(w.number).padStart(3, '0')}</div>
                        <div class="winner-name">${shortenName(w.customer_name)}</div>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (err) {
            console.error('Erro ao carregar vencedores:', err);
            if (list) list.innerHTML = '<p class="text-muted text-center p-3">Erro ao carregar vencedores.</p>';
        }
    }

    function shortenName(fullName) {
        if (!fullName) return '';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length <= 2) return fullName.trim();
        return parts[0] + ' ' + parts[parts.length - 1];
    }

    // Early check - if closed, skip interactive setup
    const isClosed = await checkRaffleClosed();
    if (isClosed) {
        await fetchOccupiedNumbers();
        return;
    }

    const btnClearSelection = document.getElementById('btn-clear-selection');
    if (btnClearSelection) btnClearSelection.onclick = () => {
        selectedNumbers.length = 0;
        updateSelectionUI();
        renderGrid();
    };

    document.getElementById('btn-open-reservation').onclick = () => {
        if (selectedNumbers.length === 0) {
            showToast('Selecione pelo menos um número.', 'info');
            return;
        }
        reservationModal.classList.add('active');
    };

    // --- Alternância automático / manual ---
    const autoSection = document.getElementById('auto-section');
    const manualSection = document.getElementById('manual-section');
    const btnToggleMode = document.getElementById('btn-toggle-mode');

    if (btnToggleMode) {
        btnToggleMode.onclick = () => {
            const goingManual = autoSection.classList.contains('hidden');
            autoSection.classList.toggle('hidden');
            manualSection.classList.toggle('hidden');
            btnToggleMode.textContent = goingManual ? 'Escolher Manualmente' : '↩ Voltar p/ Automático';
        };
    }

    // --- Seleção automática (rife-me style) ---
    const autoQtyInput = document.getElementById('auto-qty');
    const qtyMinusBtn = document.getElementById('qty-minus');
    const qtyPlusBtn = document.getElementById('qty-plus');
    const btnAutoPay = document.getElementById('btn-auto-pay');

    function getFreeNumbers() {
        const occupied = new Set(
            occupiedNumbers
                .filter(n => n.status === 'pending' || n.status === 'paid')
                .map(n => n.number)
        );
        const selected = new Set(selectedNumbers);
        const free = [];
        for (let i = 1; i <= TOTAL_SYSTEM_NUMBERS; i++) {
            if (!occupied.has(i) && !selected.has(i)) free.push(i);
        }
        return free;
    }

    function pickRandom(count) {
        const free = getFreeNumbers();
        if (free.length === 0) {
            showToast('Nenhum número livre disponível.', 'info');
            return 0;
        }
        const take = Math.min(count, free.length);
        for (let i = 0; i < take; i++) {
            const j = i + Math.floor(Math.random() * (free.length - i));
            [free[i], free[j]] = [free[j], free[i]];
        }
        free.slice(0, take).forEach(n => {
            selectedNumbers.push(n);
        });
        updateSelectionUI();
        renderGrid();
        return take;
    }

    if (qtyMinusBtn) qtyMinusBtn.onclick = () => {
        autoQtyInput.value = Math.max(1, (parseInt(autoQtyInput.value) || 1) - 1);
    };
    if (qtyPlusBtn) qtyPlusBtn.onclick = () => {
        autoQtyInput.value = Math.min(TOTAL_SYSTEM_NUMBERS, (parseInt(autoQtyInput.value) || 1) + 1);
    };
    if (btnAutoPay) btnAutoPay.onclick = () => {
        const qty = Math.max(1, parseInt(autoQtyInput.value) || 1);
        const added = pickRandom(qty);
        if (added > 0) {
            showToast(`${added} número(s) adicionado(s).`, 'success');
        }
    };
    document.querySelectorAll('.btn-auto-quick').forEach(btn => {
        btn.onclick = () => {
            const qty = parseInt(btn.dataset.qty) || 5;
            const added = pickRandom(qty);
            showToast(added > 0 ? `${added} número(s) adicionado(s).` : 'Nenhum número livre.', added > 0 ? 'success' : 'info');
        };
    });

    closeModalBtn.onclick = () => {
        reservationModal.classList.remove('active');
        reservationForm.reset();
    };

    reservationForm.onsubmit = (e) => {
        e.preventDefault();
        
        const name = document.getElementById('customer-name').value.trim();
        const phone = document.getElementById('customer-phone').value.trim();
        
        if (!name || !phone) {
            showToast('Preencha seu nome e telefone.', 'info');
            return;
        }

        const totalValue = calculateTotal(selectedNumbers.length);
        const totalFormatted = totalValue.toFixed(2).replace('.', ',');

        orderSummaryEl.innerHTML = `
            <p class="mb-05"><strong>Nome:</strong> ${name}</p>
            <p class="mb-05"><strong>WhatsApp:</strong> ${phone}</p>
            <p class="mb-05"><strong>Números:</strong> ${selectedNumbers.map(n => String(n).padStart(3, '0')).join(', ')}</p>
            <p class="mt-1 text-lg text-accent font-800">Total: R$ ${totalFormatted}</p>
        `;

        reservationModal.classList.remove('active');
        confirmOrderModal.classList.add('active');
    };

    cancelOrderBtn.onclick = () => {
        confirmOrderModal.classList.remove('active');
        reservationModal.classList.add('active');
    };

    finalConfirmBtn.onclick = async () => {
        const name = document.getElementById('customer-name').value.trim();
        const phone = document.getElementById('customer-phone').value.trim();
        const indication = document.getElementById('indication').value.trim();

        if (selectedNumbers.length === 0) {
            showToast('Nenhum número selecionado.', 'error');
            confirmOrderModal.classList.remove('active');
            return;
        }

        finalConfirmBtn.disabled = true;
        finalConfirmBtn.textContent = 'Processando...';
        showToast('Salvando sua reserva...', 'loading');

        try {
            const { data, error } = await supabase.rpc('create_raffle_reservation', {
                p_customer_name: name,
                p_customer_phone: phone,
                p_indication: indication,
                p_numbers: selectedNumbers
            });

            if (error) throw error;

            const result = data;

            if (!result.success) {
                if (result.error_type === 'numbers_unavailable') {
                    const unavailable = result.unavailable_numbers || [];
                    showToast(`${result.message} Tente selecionar outros.`, 'error');
                    fetchOccupiedNumbers();
                    selectedNumbers = selectedNumbers.filter(n => !unavailable.includes(n));
                    updateSelectionUI();
                    renderGrid();
                } else {
                    showToast(result.message, 'error');
                }
                finalConfirmBtn.disabled = false;
                finalConfirmBtn.textContent = 'Finalizar';
                return;
            }

            // Sucesso!
            localStorage.setItem('last_reserved_numbers', JSON.stringify(selectedNumbers));
            localStorage.setItem('last_reserved_total', result.total_amount);
            
            showToast('Reserva realizada com sucesso!', 'success');
            
            setTimeout(() => {
                window.location.href = 'pagamento.html';
            }, 1000);

        } catch (error) {
            console.error("Erro na reserva:", error);
            showToast('Erro ao processar reserva. Tente novamente.', 'error');
            
            fetchOccupiedNumbers(); 
            finalConfirmBtn.disabled = false;
            finalConfirmBtn.textContent = 'Finalizar';
            confirmOrderModal.classList.remove('active');
        }
    };

    searchInput.oninput = () => renderGrid();

    // Realtime subscriptions
    supabase.channel('public-room')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_reservations' }, () => fetchOccupiedNumbers())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'raffle_selected_numbers' }, () => fetchOccupiedNumbers())
        .subscribe();

    fetchOccupiedNumbers();
}

// --- LÓGICA DA PÁGINA DE PAGAMENTO (pagamento.html) ---

function initPayment() {
    const listDisplay = document.getElementById('reserved-numbers-list');
    const totalDisplay = document.getElementById('reserved-total-display');
    const copyBtn = document.getElementById('btn-copy-pix');
    if (!listDisplay) return;

    const lastNumbers = JSON.parse(localStorage.getItem('last_reserved_numbers') || '[]');
    const lastTotal = localStorage.getItem('last_reserved_total') || '0';

    if (lastNumbers.length > 0) {
        listDisplay.textContent = lastNumbers.map(n => String(n).padStart(3, '0')).join(' / ');
        totalDisplay.textContent = `R$ ${parseFloat(lastTotal).toFixed(2).replace('.', ',')}`;
    }

    if (copyBtn) {
        copyBtn.onclick = () => {
            const pixCode = document.getElementById('pix-copy-paste').textContent.trim();
            navigator.clipboard.writeText(pixCode);
            showToast('Código PIX copiado!', 'success');
        };
    }
}

// --- LÓGICA DO PAINEL ADMIN (admin.html) ---

async function initAdmin() {
    const loginSection = document.getElementById('admin-login-section');
    const dashboardSection = document.getElementById('admin-dashboard-section');
    if (!loginSection || !dashboardSection) return;

    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('btn-logout');
    const pendingList = document.getElementById('pending-reservations-list');
    const paidList = document.getElementById('paid-reservations-list');
    const adminEmailEl = document.getElementById('admin-user-email');
    const pendingCountEl = document.getElementById('admin-pending-count');
    const paidCountEl = document.getElementById('admin-paid-count');
    const soldNumbersCountEl = document.getElementById('admin-sold-numbers-count');
    const availableCountEl = document.getElementById('admin-available-count');
    const totalRevenueEl = document.getElementById('admin-total-revenue');
    const progressPercentEl = document.getElementById('admin-progress-percent');
    const progressBarEl = document.getElementById('admin-progress-bar');
    const adminSearchEl = document.getElementById('admin-search');
    const exportBtn = document.getElementById('btn-export-csv');

    let revenueChart = null;
    let indicationsChart = null;
    let allReservations = [];

    function toggleAdminView(isLoggedIn) {
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
                    adminEmailEl.textContent = session.user.email;
                    toggleAdminView(true);
                    fetchAdminData();
                } else {
                    await supabase.auth.signOut();
                    toggleAdminView(false);
                }
            } else {
                toggleAdminView(false);
            }
        } catch (err) {
            console.error("Erro ao verificar sessão:", err);
            toggleAdminView(false);
        }
    }

    async function fetchAdminData() {
        const { data, error } = await supabase
            .from('raffle_reservations')
            .select('*, raffle_selected_numbers(number)')
            .order('created_at', { ascending: false });

        if (error) {
            showToast('Erro ao carregar dados do dashboard.', 'error');
            return;
        }

        allReservations = data;

        const pending = data.filter(r => r.status === 'pending');
        const paid = data.filter(r => r.status === 'paid');
        const allActive = data.filter(r => r.status !== 'cancelled');

        const totalRevenue = paid.reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0);
        const soldNumbers = paid.reduce((acc, curr) => acc + (curr.raffle_selected_numbers ? curr.raffle_selected_numbers.length : 0), 0);
        const available = Math.max(0, TOTAL_SYSTEM_NUMBERS - soldNumbers);
        const progress = Math.min(100, Math.round((soldNumbers / TOTAL_SYSTEM_NUMBERS) * 100));

        if (pendingCountEl) pendingCountEl.textContent = pending.length;
        if (paidCountEl) paidCountEl.textContent = paid.length;
        if (soldNumbersCountEl) soldNumbersCountEl.textContent = soldNumbers;
        if (availableCountEl) availableCountEl.textContent = available;
        if (totalRevenueEl) totalRevenueEl.textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;
        if (progressPercentEl) progressPercentEl.textContent = `${progress}%`;
        if (progressBarEl) progressBarEl.style.width = `${progress}%`;

        renderLists();
        updateRevenueChart(paid);
        updateIndicationsChart(allActive);
    }

    function matchesQuery(res, q) {
        if (!q) return true;
        const haystack = [
            res.customer_name,
            res.customer_phone,
            res.indication,
            ...(res.raffle_selected_numbers || []).map(n => String(n.number).padStart(3, '0'))
        ].join(' ').toLowerCase();
        return haystack.includes(q);
    }

    function renderLists() {
        const q = adminSearchEl.value.trim().toLowerCase();
        const filtered = allReservations.filter(r => r.status !== 'cancelled' && matchesQuery(r, q));
        renderPendingList(filtered.filter(r => r.status === 'pending'));
        renderPaidList(filtered.filter(r => r.status === 'paid'));
    }

    function exportCSV() {
        const paid = allReservations.filter(r => r.status === 'paid');
        if (paid.length === 0) {
            showToast('Nenhum pagamento para exportar.', 'info');
            return;
        }
        const esc = (v) => {
            const s = String(v ?? '');
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const header = ['Nome', 'Telefone', 'Indicação', 'Números', 'Valor (R$)', 'Data'];
        const rows = paid.map(res => {
            const numbers = (res.raffle_selected_numbers || []).map(n => String(n.number).padStart(3, '0')).join('; ');
            const date = new Date(res.confirmed_at || res.updated_at).toLocaleDateString('pt-BR');
            return [
                esc(res.customer_name),
                esc(res.customer_phone),
                esc(res.indication || ''),
                esc(numbers),
                parseFloat(res.total_amount).toFixed(2).replace('.', ','),
                esc(date)
            ].join(',');
        });
        const csv = [header.join(','), ...rows].join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rifa-pagos-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showToast('CSV exportado!', 'success');
    }

    function updateIndicationsChart(reservations) {
        const canvas = document.getElementById('indicationsChart');
        if (!canvas) return;

        const counts = {};
        reservations.forEach(r => {
            if (r.indication && r.indication.trim() !== "") {
                const name = r.indication.trim();
                counts[name] = (counts[name] || 0) + 1;
            }
        });

        // Ordenar e pegar top 10
        const sorted = Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        const labels = sorted.map(i => i[0]);
        const values = sorted.map(i => i[1]);

        if (indicationsChart) indicationsChart.destroy();
        indicationsChart = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Indicações',
                    data: values,
                    backgroundColor: '#0a3ca7',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 },
                        grid: { color: '#f4f4f5' }
                    },
                    y: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function updateRevenueChart(paidItems) {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        const dailyData = {};
        const labels = [];
        const values = [];

        // 1. Determinar a data inicial (mínimo 7 dias atrás ou a data da primeira venda)
        let startDate = new Date();
        startDate.setDate(startDate.getDate() - 6);

        paidItems.forEach(item => {
            const itemDate = new Date(item.confirmed_at || item.updated_at);
            if (itemDate < startDate) startDate = itemDate;
        });

        // Resetar para o início do dia para comparação consistente
        startDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 2. Preencher o mapa com zeros e criar labels ordenados
        let current = new Date(startDate);
        while (current <= today) {
            const dateStr = current.toLocaleDateString('pt-BR');
            dailyData[dateStr] = 0;
            labels.push(dateStr);
            current.setDate(current.getDate() + 1);
        }

        // 3. Somar os valores das vendas confirmadas
        paidItems.forEach(item => {
            const dateStr = new Date(item.confirmed_at || item.updated_at).toLocaleDateString('pt-BR');
            if (dailyData[dateStr] !== undefined) {
                dailyData[dateStr] += parseFloat(item.total_amount);
            }
        });

        // 4. Gerar os valores na ordem das labels
        labels.forEach(label => {
            values.push(dailyData[label]);
        });

        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vendas (R$)',
                    data: values,
                    borderColor: '#0a3ca7',
                    backgroundColor: 'rgba(10, 60, 167, 0.1)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 4,
                    pointBackgroundColor: '#0a3ca7'
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { 
                        beginAtZero: true,
                        grid: { color: '#f4f4f5' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    }

    function renderPendingList(items) {
        if (!pendingList) return;
        pendingList.innerHTML = '';
        if (items.length === 0) {
            pendingList.innerHTML = '<p style="color: var(--gray-400);">Nenhuma reserva pendente.</p>';
            return;
        }

        items.forEach(res => {
            const numbers = res.raffle_selected_numbers.map(n => String(n.number).padStart(3, '0')).join(', ');
            const el = document.createElement('div');
            el.className = 'admin-item';
            el.innerHTML = `
                <div class="admin-item-info">
                    <h4 style="font-weight: 800; margin-bottom: 0.5rem;">${res.customer_name}</h4>
                    <p style="font-size: 0.875rem; color: var(--accent); font-weight: 700;">Números: ${numbers}</p>
                    <p style="font-size: 0.875rem; color: var(--gray-500);">📱 ${res.customer_phone}</p>
                    <p style="font-size: 0.875rem; color: var(--success); font-weight: 700; margin-top: 0.5rem;">Total: R$ ${parseFloat(res.total_amount).toFixed(2).replace('.', ',')}</p>
                </div>
                <div class="admin-actions" style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="btn btn-accent btn-sm btn-confirm">Confirmar</button>
                    <button class="btn btn-outline btn-sm btn-cancel" style="color: var(--error); border-color: var(--error); padding: 0.4rem;">Cancelar</button>
                </div>
            `;

            el.querySelector('.btn-confirm').onclick = () => {
                askConfirmation({
                    title: 'Confirmar Pagamento?',
                    message: `Deseja marcar o pedido de ${res.customer_name} como pago?`,
                    icon: '💰',
                    onConfirm: () => confirmPayment(res.id)
                });
            };

            el.querySelector('.btn-cancel').onclick = () => {
                askConfirmation({
                    title: 'Cancelar Reserva?',
                    message: `Os números ${numbers} ficarão disponíveis novamente.`,
                    icon: '⚠️',
                    onConfirm: () => cancelReservation(res.id)
                });
            };

            pendingList.appendChild(el);
        });
    }

    function renderPaidList(items) {
        if (!paidList) return;
        paidList.innerHTML = '';
        if (items.length === 0) {
            paidList.innerHTML = '<p class="text-muted" style="padding: 1rem;">Nenhum pagamento confirmado.</p>';
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'paid-table-wrap';

        const table = document.createElement('table');
        table.className = 'paid-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Nome</th>
                    <th>Números</th>
                    <th>Indicação</th>
                    <th>Valor</th>
                    <th>Data</th>
                </tr>
            </thead>
            <tbody></tbody>
        `;
        const tbody = table.querySelector('tbody');

        items.forEach(res => {
            const numbers = res.raffle_selected_numbers.map(n => String(n.number).padStart(3, '0')).join(', ');
            const amount = parseFloat(res.total_amount).toFixed(2).replace('.', ',');
            const date = new Date(res.confirmed_at || res.updated_at).toLocaleDateString('pt-BR');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Nome"><span class="paid-name">${res.customer_name}</span></td>
                <td class="paid-numbers" data-label="Números">${numbers}</td>
                <td data-label="Indicação">${res.indication || '-'}</td>
                <td class="paid-amount" data-label="Valor">R$ ${amount}</td>
                <td class="paid-date" data-label="Data">${date}</td>
            `;

            tbody.appendChild(tr);
        });

        wrap.appendChild(table);
        paidList.appendChild(wrap);
    }

    async function confirmPayment(id) {
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
            .from('raffle_reservations')
            .update({ 
                status: 'paid', 
                confirmed_at: new Date().toISOString(), 
                admin_confirmed_by: user.id 
            })
            .eq('id', id);

        if (error) showToast('Erro ao confirmar.', 'error');
        else { 
            showToast('Pago confirmado!', 'success'); 
            fetchAdminData(); 
        }
    }

    async function cancelReservation(id) {
        const { error } = await supabase
            .from('raffle_reservations')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) showToast('Erro ao cancelar.', 'error');
        else { 
            showToast('Cancelado!', 'success'); 
            fetchAdminData(); 
        }
    }

    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) showToast('Login falhou: ' + error.message, 'error');
        else checkSession();
    };

    logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.reload();
    };

    if (adminSearchEl) adminSearchEl.addEventListener('input', renderLists);
    if (exportBtn) exportBtn.addEventListener('click', exportCSV);

    checkSession();
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    // Forçar scroll para o topo e desativar restauração automática do navegador
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    initIndex();
    initPayment();
    initAdmin();
});
