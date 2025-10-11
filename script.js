// VERSÃO FINAL COM ORDENAÇÃO CRONOLÓGICA PARA APPLE

const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

// DETECÇÃO DE MODO DE DESENVOLVIMENTO
const isDevelopmentMode = window.location.protocol === 'file:';

// --- CONFIGURAÇÃO DO AUTH0 ---
const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a",
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0].split('#')[0]
    }
};
let auth0Client = null;

// --- ELEMENTOS DA PÁGINA ---
let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters;

// --- FLUXO PRINCIPAL ---
window.addEventListener('load', async () => {
    initializeDOMElements();

    if (isDevelopmentMode) {
        // PULA O LOGIN SE ESTIVER EM MODO DE DESENVOLVIMENTO
        console.warn("MODO DE DESENVOLVIMENTO ATIVADO - LOGIN IGNORADO");
        loginPrompt.style.display = 'none';
        appContent.style.display = 'block';
        loadingIndicator.style.display = 'flex';
        await carregarDados();
        window.addEventListener('scroll', handleScroll);
    } else {
        // FLUXO NORMAL COM AUTH0
        try {
            auth0Client = await auth0.createAuth0Client(auth0Config);

            if (location.search.includes("code=") && location.search.includes("state=")) {
                await auth0Client.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            await updateUI();
        } catch (e) {
            console.error("ERRO CRÍTICO NA INICIALIZAÇÃO DO AUTH0:", e);
            loadingIndicator.innerHTML = '<p>Erro na autenticação. Verifique o console (F12).</p>';
            loadingIndicator.style.display = 'flex';
        }
    }
});

function initializeDOMElements() {
    loginPrompt = document.getElementById('login-prompt');
    appContent = document.getElementById('app-content');
    btnLogin = document.getElementById('btn-login-main');
    btnLogout = document.getElementById('btn-logout');
    userNameEl = document.getElementById('user-name');
    loadingIndicator = document.getElementById('loading-indicator');
    backToTopButton = document.getElementById('back-to-top');
    searchInput = document.getElementById('searchInput');
    brandFiltersContainer = document.getElementById('brand-filters');
    typeFiltersContainer = document.getElementById('type-filters');
    toggleFiltersBtn = document.getElementById('toggle-filters-btn');
    collapsibleFilters = document.getElementById('collapsible-filters');

    btnLogin.addEventListener('click', login);
    btnLogout.addEventListener('click', logout);
}

const updateUI = async () => {
    try {
        const isAuthenticated = await auth0Client.isAuthenticated();
        
        if (isAuthenticated) {
            loginPrompt.style.display = 'none';
            appContent.style.display = 'block';
            const user = await auth0Client.getUser();
            userNameEl.textContent = user.name || user.email;
            await carregarDados();
            window.addEventListener('scroll', handleScroll);
        } else {
            loginPrompt.style.display = 'flex';
            appContent.style.display = 'none';
            loadingIndicator.style.display = 'none';
            document.getElementById('login-prompt').classList.add('show');
        }
    } catch (e) {
        console.error("ERRO ao atualizar UI:", e);
    }
};

const login = async () => {
    await auth0Client.loginWithRedirect({
        authorizationParams: { ui_locales: 'pt' }
    });
};

const logout = async () => {
    await auth0Client.logout({
        logoutParams: { returnTo: window.location.href.split('?')[0].split('#')[0] }
    });
};

// --- FUNÇÃO DE ORDENAÇÃO PARA IPHONES ---
function getIphoneSortKey(modelo) {
    // Extrai o modelo principal (ex: "11", "XR", "8")
    const match = modelo.match(/iPhone\s*(\d+|XR|XS|X|SE)/i);
    if (!match) return 99; // Modelos desconhecidos vão para o final

    let coreModel = match[1].toUpperCase();
    let baseValue = 0;

    // Define um valor base para cada modelo principal para garantir a ordem cronológica
    const order = {
        '6': 6, '6S': 6.5,
        '7': 7,
        '8': 8,
        'SE': 9, // SE (2ª/3ª gen) veio depois do 8
        'X': 10,
        'XR': 10.1,
        'XS': 10.2,
        '11': 11,
        '12': 12,
        '13': 13,
        '14': 14
        // Adicionar futuros modelos aqui (15, 16...)
    };

    if (order[coreModel]) {
        baseValue = order[coreModel];
    } else if (!isNaN(parseInt(coreModel))) {
        baseValue = parseInt(coreModel); // Lida com modelos futuros como 15, 16...
    }

    // Adiciona pequenos valores decimais para ordenar os submodelos (Plus, Pro, Max)
    if (modelo.toLowerCase().includes('plus')) baseValue += 0.01;
    if (modelo.toLowerCase().includes('pro')) baseValue += 0.02;
    if (modelo.toLowerCase().includes('max')) baseValue += 0.03;
    
    return baseValue;
}


// --- CÓDIGO DA APLICAÇÃO (CARREGAMENTO E RENDERIZAÇÃO) ---

async function carregarDados() {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = 'Carregando lista de preços...';
    try {
        const response = await fetch(urlPlanilha);
        if (!response.ok) throw new Error(`Erro na rede ao buscar planilha: status ${response.status}`);
        const data = await response.text();
        const itens = processarDados(data);
        renderizarPagina(itens);
        popularFiltros(itens);
        setupEventListeners();
    } catch (error) {
        console.error("ERRO CRÍTICO ao carregar dados da planilha:", error);
        loadingIndicator.innerHTML = '<p>Ocorreu um erro ao carregar os dados. Verifique o link da planilha.</p>';
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

// **** A PRINCIPAL MUDANÇA ESTÁ AQUI DENTRO ****
function renderizarPagina(itens) {
    const containerLista = document.getElementById('lista-container');
    containerLista.innerHTML = '';
    const fragmentoLista = document.createDocumentFragment();
    const porMarca = itens.reduce((acc, item) => { (acc[item.marca] = acc[item.marca] || []).push(item); return acc; }, {});
    const marcas = Object.keys(porMarca).sort();

    marcas.forEach(marca => {
        const marcaContainer = document.createElement('div');
        // A lógica para renderizar tabela ou cartão continua sendo decidida pelo seu CSS
        marcaContainer.className = 'marca-container-card' in document.body.style ? 'marca-container-card' : 'marca-container';
        marcaContainer.dataset.marca = marca;
        
        const tituloMarca = document.createElement('h2');
        tituloMarca.className = 'marca-titulo-card' in document.body.style ? 'marca-titulo-card' : 'marca-titulo';
        tituloMarca.textContent = marca;
        marcaContainer.appendChild(tituloMarca);

        const porTipo = porMarca[marca].reduce((acc, item) => { (acc[item.tipo] = acc[item.tipo] || []).push(item); return acc; }, {});
        const tipos = Object.keys(porTipo).sort();

        tipos.forEach(tipo => {
            const items = porTipo[tipo];

            // AQUI ESTÁ A NOVA LÓGICA DE ORDENAÇÃO
            if (marca === 'Apple') {
                // Se for Apple, usa a ordenação cronológica
                items.sort((a, b) => getIphoneSortKey(a.modelo) - getIphoneSortKey(b.modelo));
            } else {
                // Para todas as outras marcas, usa a ordenação alfabética padrão
                items.sort((a, b) => a.modelo.localeCompare(b.modelo));
            }

            // O código abaixo é uma versão "agnóstica" que funciona tanto para tabelas quanto para cartões
            // Verificamos qual classe de container existe para decidir como renderizar
            if (document.querySelectorAll('.items-grid-card').length > 0) { // Modo Cartão
                const tipoContainer = document.createElement('div');
                tipoContainer.className = 'tipo-container-card';
                tipoContainer.dataset.tipo = tipo;
                const tituloTipo = document.createElement('h3');
                tituloTipo.className = 'tipo-titulo-card';
                tituloTipo.textContent = tipo;
                tipoContainer.appendChild(tituloTipo);
                const itemsGrid = document.createElement('div');
                itemsGrid.className = 'items-grid-card';
                items.forEach(item => {
                    const itemCard = document.createElement('div');
                    itemCard.className = 'item-card';
                    itemCard.innerHTML = `
                        <div class="item-card-modelo">${item.modelo}</div>
                        <div class="item-card-detalhes">${item.detalhes}</div>
                        <div class="item-card-preco">R$ ${item.preco}</div>
                    `;
                    itemsGrid.appendChild(itemCard);
                });
                tipoContainer.appendChild(itemsGrid);
                marcaContainer.appendChild(tipoContainer);
            } else { // Modo Tabela (Padrão)
                const table = document.createElement('table');
                table.dataset.tipo = tipo;
                table.innerHTML = `<thead><tr><th colspan="3" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço (R$)</th></tr></thead><tbody>${items.map(item => `<tr data-modelo="${item.modelo.toUpperCase()}" data-detalhes="${item.detalhes.toUpperCase()}"><td>${item.modelo}</td><td>${item.detalhes}</td><td>${item.preco}</td></tr>`).join('')}</tbody>`;
                marcaContainer.appendChild(table);
            }
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
    
    // Lógica para Tabela
    document.querySelectorAll('.marca-container table tbody tr').forEach(linha