// VERSÃO COM AUTH0

// URL da planilha continua a mesma, você disse que já editou
const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

// --- CONFIGURAÇÃO DO AUTH0 ---
const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "SbMBiA_II_yA6qakjGUnoNMB8W4HZQsnNAdQp-__SATnkJWIW8ltNNBTsOG_ClJ1",
    authorizationParams: {
        redirect_uri: window.location.origin
    }
};
let auth0Client = null;

// --- ELEMENTOS DA PÁGINA ---
// Elementos de autenticação
const loginPrompt = document.getElementById('login-prompt');
const appContent = document.getElementById('app-content');
const btnLogin = document.getElementById('btn-login-main');
const btnLogout = document.getElementById('btn-logout');
const userNameEl = document.getElementById('user-name');

// Elementos da aplicação original
const loadingIndicator = document.getElementById('loading-indicator');
const backToTopButton = document.getElementById('back-to-top');
const searchInput = document.getElementById('searchInput');
const brandFiltersContainer = document.getElementById('brand-filters');
const typeFiltersContainer = document.getElementById('type-filters');
const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
const collapsibleFilters = document.getElementById('collapsible-filters');

let filtroAtivoMarca = 'todas';
let filtroAtivoTipo = 'todas';

// --- FLUXO PRINCIPAL DE AUTENTICAÇÃO ---
window.addEventListener('load', async () => {
    try {
        auth0Client = await auth0.createAuth0Client(auth0Config);

        // Trata o retorno do login (redirect)
        if (location.search.includes("code=") && location.search.includes("state=")) {
            await auth0Client.handleRedirectCallback();
            window.history.replaceState({}, document.title, "/");
        }

        // Atualiza a UI com base no estado de login
        await updateUI();

    } catch (e) {
        console.error("Erro na inicialização do Auth0", e);
        loadingIndicator.innerHTML = '<p>Erro na autenticação. Recarregue a página.</p>';
    }
});

const updateUI = async () => {
    const isAuthenticated = await auth0Client.isAuthenticated();
    
    if (isAuthenticated) {
        loginPrompt.style.display = 'none';
        appContent.style.display = 'block';

        const user = await auth0Client.getUser();
        userNameEl.textContent = user.name || user.email;

        // LOGIN BEM-SUCEDIDO: Carrega os dados da planilha
        await carregarDados();
        window.addEventListener('scroll', handleScroll);

    } else {
        loginPrompt.style.display = 'flex';
        appContent.style.display = 'none';
        loadingIndicator.style.display = 'none';
    }
};

// --- FUNÇÕES DE LOGIN/LOGOUT ---
btnLogin.addEventListener('click', async () => {
    await auth0Client.loginWithRedirect();
});

btnLogout.addEventListener('click', async () => {
    await auth0Client.logout({
        logoutParams: {
            returnTo: window.location.origin
        }
    });
});

// --- TODO O CÓDIGO ORIGINAL DA APLICAÇÃO VAI DAQUI PARA BAIXO ---
// A única mudança é que estas funções agora só são chamadas após o login.

async function carregarDados() {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = 'Carregando lista de preços...';
    try {
        const response = await fetch(urlPlanilha);
        if (!response.ok) throw new Error('Erro ao buscar dados');
        const data = await response.text();
        const itens = processarDados(data);
        renderizarPagina(itens);
        popularFiltros(itens);
        setupEventListeners();
    } catch (error) {
        console.error("Erro Crítico:", error);
        loadingIndicator.innerHTML = '<p>Ocorreu um erro ao carregar os dados. Tente recarregar a página.</p>';
    }
}

function processarDados(csvData) {
    const linhas = csvData.trim().split(/\r?\n/).slice(1);
    return linhas.map(linha => {
        const colunas = linha.split(',');
        if (colunas.length < 5) return null;
        return {
            marca: colunas[0]?.trim() || 'Sem Marca',
            tipo: colunas[1]?.trim() || 'Outros',
            modelo: colunas[2]?.trim() || '',
            detalhes: colunas[3]?.trim() || '',
            preco: colunas[4]?.trim() || '0'
        };
    }).filter(item => item && item.marca && item.modelo && item.marca.length > 0);
}

function renderizarPagina(itens) {
    const containerLista = document.getElementById('lista-container');
    containerLista.innerHTML = '';
    const fragmentoLista = document.createDocumentFragment();
    const porMarca = itens.reduce((acc, item) => { (acc[item.marca] = acc[item.marca] || []).push(item); return acc; }, {});
    const marcas = Object.keys(porMarca).sort();

    marcas.forEach(marca => {
        const marcaContainer = document.createElement('div');
        marcaContainer.className = 'marca-container';
        marcaContainer.dataset.marca = marca;
        const tituloMarca = document.createElement('h2');
        tituloMarca.className = 'marca-titulo';
        tituloMarca.textContent = marca;
        marcaContainer.appendChild(tituloMarca);
        const porTipo = porMarca[marca].reduce((acc, item) => { (acc[item.tipo] = acc[item.tipo] || []).push(item); return acc; }, {});
        const tipos = Object.keys(porTipo).sort((a, b) => {
            if (a.toLowerCase().includes('tela')) return -1;
            if (b.toLowerCase().includes('tela')) return 1;
            return a.localeCompare(b);
        });
        tipos.forEach(tipo => {
            const table = document.createElement('table');
            table.dataset.tipo = tipo;
            table.innerHTML = `<thead><tr><th colspan="3" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço (R$)</th></tr></thead><tbody>${porTipo[tipo].sort((a, b) => a.modelo.localeCompare(b.modelo)).map(item => `<tr><td>${item.modelo}</td><td>${item.detalhes}</td><td>${item.preco}</td></tr>`).join('')}</tbody>`;
            marcaContainer.appendChild(table);
        });
        fragmentoLista.appendChild(marcaContainer);
    });
    containerLista.appendChild(fragmentoLista);
    loadingIndicator.style.display = 'none';
}

function popularFiltros(itens) {
    const marcasUnicas = [...new Set(itens.map(item => item.marca))];
    const marcas = marcasUnicas.length > 0 ? ['todas', ...marcasUnicas.sort()] : [];
    const tiposUnicos = [...new Set(itens.map(item => item.tipo))];
    const tipos = tiposUnicos.length > 0 ? ['todas', ...tiposUnicos.sort()] : [];
    brandFiltersContainer.innerHTML = marcas.map(marca => 
        `<button class="filter-pill ${marca === 'todas' ? 'active' : ''}" data-filter="${marca}">${marca === 'todas' ? 'Todas as Marcas' : marca}</button>`
    ).join('');
    typeFiltersContainer.innerHTML = tipos.map(tipo =>
        `<button class="filter-pill ${tipo === 'todas' ? 'active' : ''}" data-filter="${tipo}">${tipo === 'todas' ? 'Todos os Tipos' : tipo}</button>`
    ).join('');
}

function setupEventListeners() {
    toggleFiltersBtn.addEventListener('click', () => {
        toggleFiltersBtn.classList.toggle('open');
        collapsibleFilters.classList.toggle('open');
    });
    brandFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            filtroAtivoMarca = e.target.dataset.filter;
            brandFiltersContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            aplicarTodosOsFiltros();
        }
    });
    typeFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            filtroAtivoTipo = e.target.dataset.filter;
            typeFiltersContainer.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            aplicarTodosOsFiltros();
        }
    });
    searchInput.addEventListener('keyup', aplicarTodosOsFiltros);
}

function aplicarTodosOsFiltros() {
    const buscaTexto = searchInput.value.toUpperCase();
    document.querySelectorAll('.marca-container').forEach(containerMarca => {
        const marcaAtual = containerMarca.dataset.marca;
        let marcaTemItensVisiveis = false;
        const marcaPassaFiltro = (filtroAtivoMarca === 'todas' || marcaAtual === filtroAtivoMarca);
