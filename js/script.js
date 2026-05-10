import { supabaseUrl, supabaseKey } from '../config/config.js';

// Inicialização do Supabase
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

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

    let occupiedNumbers = [];
    let selectedNumbers = [];
    const PRICE_SINGLE = 5.00;
    const PRICE_BUNDLE_3 = 12.00;
    const TOTAL_SYSTEM_NUMBERS = 1000;

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
                    raffle_reservations ( status )
                `);

            if (error) throw error;

            occupiedNumbers = data
                .map(item => ({
                    number: item.number,
                    status: item.raffle_reservations ? item.raffle_reservations.status : 'available'
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
        grid.innerHTML = '';
        const filterVal = searchInput.value.trim();

        for (let i = 1; i <= TOTAL_SYSTEM_NUMBERS; i++) {
            const paddedNumber = String(i).padStart(3, '0');
            
            // Filtra pelo número formatado (ex: permite buscar "005")
            if (filterVal && !paddedNumber.includes(filterVal)) continue;

            const occupied = occupiedNumbers.find(n => n.number === i);
            const isSelected = selectedNumbers.includes(i);
            
            const card = document.createElement('div');
            card.className = 'number-card';
            card.textContent = paddedNumber;

            if (occupied && (occupied.status === 'pending' || occupied.status === 'paid')) {
                card.classList.add(occupied.status);
                card.onclick = () => showToast(`O número ${String(i).padStart(3, '0')} já está ocupado.`, 'info');
            } else {
                card.classList.add('available');
                if (isSelected) card.classList.add('selected');
                card.onclick = () => toggleNumberSelection(i);
            }
            grid.appendChild(card);
        }
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
    }

    document.getElementById('btn-open-reservation').onclick = () => {
        if (selectedNumbers.length === 0) {
            showToast('Selecione pelo menos um número.', 'info');
            return;
        }
        reservationModal.classList.add('active');
    };

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
        const totalAmount = calculateTotal(selectedNumbers.length);

        if (selectedNumbers.length === 0) {
            showToast('Nenhum número selecionado.', 'error');
            confirmOrderModal.classList.remove('active');
            return;
        }

        finalConfirmBtn.disabled = true;
        finalConfirmBtn.textContent = 'Processando...';
        showToast('Salvando sua reserva...', 'loading');

        try {
            // 1. Criar Reserva
            const { data: resData, error: resError } = await supabase
                .from('raffle_reservations')
                .insert([{
                    customer_name: name,
                    customer_phone: phone,
                    indication: indication || null,
                    total_amount: totalAmount
                }])
                .select()
                .single();

            if (resError) throw resError;

            // 2. Criar números vinculados
            const numbersData = selectedNumbers.map(num => ({
                reservation_id: resData.id,
                number: num
            }));

            const { error: numError } = await supabase
                .from('raffle_selected_numbers')
                .insert(numbersData);

            if (numError) {
                // Se falhou ao inserir números, apaga a reserva órfã
                await supabase.from('raffle_reservations').delete().eq('id', resData.id);
                throw numError;
            }

            // Sucesso!
            localStorage.setItem('last_reserved_numbers', JSON.stringify(selectedNumbers));
            localStorage.setItem('last_reserved_total', totalAmount);
            
            showToast('Reserva realizada com sucesso!', 'success');
            
            setTimeout(() => {
                window.location.href = 'pagamento.html';
            }, 1000);

        } catch (error) {
            console.error("Erro na reserva:", error);
            showToast('Erro ao reservar. Verifique se os números ainda estão disponíveis.', 'error');
            
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
    const totalRevenueEl = document.getElementById('admin-total-revenue');

    let revenueChart = null;

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

        const pending = data.filter(r => r.status === 'pending');
        const paid = data.filter(r => r.status === 'paid');

        const totalRevenue = paid.reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0);
        if (pendingCountEl) pendingCountEl.textContent = pending.length;
        if (paidCountEl) paidCountEl.textContent = paid.length;
        if (totalRevenueEl) totalRevenueEl.textContent = `R$ ${totalRevenue.toFixed(2).replace('.', ',')}`;

        renderPendingList(pending);
        renderPaidList(paid);
        updateRevenueChart(paid);
    }

    function updateRevenueChart(paidItems) {
        const canvas = document.getElementById('revenueChart');
        if (!canvas) return;

        const dailyData = {};
        paidItems.forEach(item => {
            const date = new Date(item.confirmed_at || item.updated_at).toLocaleDateString('pt-BR');
            dailyData[date] = (dailyData[date] || 0) + parseFloat(item.total_amount);
        });

        const labels = Object.keys(dailyData).reverse();
        const values = Object.values(dailyData).reverse();

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
            paidList.innerHTML = '<p style="color: var(--gray-400);">Nenhum pagamento confirmado.</p>';
            return;
        }

        items.forEach(res => {
            const numbers = res.raffle_selected_numbers.map(n => String(n.number).padStart(3, '0')).join(', ');
            const el = document.createElement('div');
            el.className = 'admin-item';
            el.style.borderLeft = '4px solid var(--success)';
            el.innerHTML = `
                <div class="admin-item-info">
                    <h4 style="font-weight: 800; margin-bottom: 0.5rem;">${res.customer_name} <span class="tag-accent" style="background: var(--success); color: white; margin-left: 1rem;">PAGO</span></h4>
                    <p style="font-size: 0.875rem; color: var(--accent); font-weight: 700;">Números: ${numbers}</p>
                    <p style="font-size: 0.875rem; color: var(--gray-500);">📱 ${res.customer_phone} | 👤 Indicação: ${res.indication || '-'}</p>
                    <p style="font-size: 0.875rem; color: var(--success); font-weight: 700; margin-top: 0.5rem;">Valor: R$ ${parseFloat(res.total_amount).toFixed(2).replace('.', ',')}</p>
                </div>
            `;
            paidList.appendChild(el);
        });
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

    checkSession();
}

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    initIndex();
    initPayment();
    initAdmin();
});
