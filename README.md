# 🎟️ Rifa Online GMJ - Sistema de Gestão e Vendas

Este é um sistema completo e funcional para venda de rifas online, desenvolvido com foco em performance, experiência do usuário (UX) e facilidade de gestão. O projeto utiliza uma arquitetura **Serverless** baseada no **Supabase**, garantindo atualizações em tempo real e segurança.

---

## 🚀 Principais Funcionalidades

### 📱 Para o Usuário
- **Grade Interativa:** 1.000 números (001 a 1000) com estados visuais (disponível, pendente, pago).
- **Cálculo de Preço Automático:** Lógica de bundles promocionais integrada (Ex: 1 por R$ 5,00 ou 3 por R$ 12,00).
- **Reserva Simplificada:** Carrinho de números com formulário de reserva intuitivo.
- **Fluxo de Pagamento:** Página dedicada com instruções de PIX e integração de QR Code.
- **Realtime:** A grade de números é atualizada instantaneamente quando outros usuários fazem reservas.

### 🔐 Para o Administrador
- **Dashboard de Vendas:** Visão geral da arrecadação total e status das reservas.
- **Análise de Arrecadação:** Gráfico de linha (Chart.js) mostrando a evolução diária das vendas.
- **Gestão de Reservas:** Interface para confirmar pagamentos ou cancelar reservas, liberando os números automaticamente.
- **Segurança:** Acesso restrito via Supabase Auth e Row Level Security (RLS) no banco de dados.

---

## 🛠️ Stack Tecnológica

- **Frontend:** HTML5, Vanilla CSS (Mobile-First com Design System Fluído), Vanilla JS (ES6+).
- **Backend as a Service (BaaS):** [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth).
- **Gráficos:** [Chart.js](https://www.chartjs.org/) para o dashboard administrativo.
- **Tipografia:** Inter (Google Fonts).

---

## 📂 Estrutura do Projeto

```text
├── index.html          # Página principal (Grade de números)
├── admin.html          # Painel administrativo (Restrito)
├── pagamento.html      # Página de instruções de pagamento
├── config/
│   └── config.js       # Configurações de API do Supabase
├── css/
│   └── style.css       # Design System e estilos globais
├── js/
│   └── script.js       # Lógica central (Vendas, Admin, Realtime)
└── assets/             # Imagens, ícones e recursos visuais
```

---

## ⚙️ Configuração e Instalação

### 1. Requisitos do Supabase
Para o funcionamento correto, é necessário criar as seguintes tabelas no seu projeto Supabase:

#### Tabela `raffle_reservations`
- `id` (uuid, primary key)
- `customer_name` (text)
- `customer_phone` (text)
- `status` (text) - Default: 'pending'
- `total_amount` (numeric)
- `indication` (text, nullable)
- `confirmed_at` (timestamp, nullable)
- `admin_confirmed_by` (uuid, nullable)

#### Tabela `raffle_selected_numbers`
- `reservation_id` (uuid, foreign key para `raffle_reservations`)
- `number` (integer)

#### Tabela `admins`
- `id` (uuid, vinculada ao Auth)
- `email` (text)

### 2. Configuração do Frontend
Edite o arquivo `config/config.js` com suas credenciais:

```javascript
export const supabaseUrl = 'SUA_URL_DO_SUPABASE';
export const supabaseKey = 'SUA_CHAVE_PUBLICA_ANON_KEY';
```

### 3. Segurança (RLS)
Certifique-se de configurar as políticas de **Row Level Security** no Supabase:
- **Select:** Público para todas as tabelas.
- **Insert:** Público para `raffle_reservations` e `raffle_selected_numbers`.
- **Update/Delete:** Apenas para usuários autenticados presentes na tabela `admins`.

---

## 🎨 Design System
O projeto utiliza um sistema de design proprietário baseado em unidades fluídas (`clamp`), garantindo que a interface se adapte perfeitamente de dispositivos mobile pequenos (320px) até telas desktop 4K sem quebras de layout.