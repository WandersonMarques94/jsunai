// VERSÃO FINAL COM ORDENAÇÃO NATURAL (ALFANUMÉRICA)

const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

const isDevelopmentMode = window.location.protocol === 'file:';

const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a",
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0].split('#')[0]
    }
};
let auth0Client = null;

let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters;

// --- FUNÇÃO DE ORDENAÇÃO ESPECIAL (APENAS PARA IPHONES) ---
function getIphoneSortKey(modelo) {
    const match = modelo.match(/iPhone\s*(\d+|XR|XS|X|SE)/i);
    if (!match) return 999;
    let coreModel = match[1].toUpperCase();
    const order = {'6': 6, '6S': 6.5, '7': 7, '8': 8, 'SE': 9, 'X': 10, 'XR': 10.1, 'XS': 10.2, '11': 11, '12': 12, '13': 13, '14': 14 };
    let baseValue = order[coreModel] || parseInt(coreModel) || 998;
    if (modelo.toLowerCase().includes('plus')) baseValue += 0.01;
    if (modelo.toLowerCase().includes('pro')) baseValue += 0.02;
    if (modelo.toLowerCase().includes('max')) baseValue += 0.03;
    return baseValue;
}

// --- FLUXO PRINCIPAL E FUNÇÕES ---

window.addEventListener('load', async () => {
    initializeDOMElements();

    if (isDevelopmentMode) {
        console.warn("MODO DE DESENVOLVIMENTO ATIVADO - LOGIN IGNORADO");
        loginPrompt.style.display = 'none';
        appContent.style.display = 'block';
        loadingIndicator.style.display = 'flex';
        await carregarDados();
        window.addEventListener('scroll', handleScroll);
    } else {
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
        const tipos = Object.keys(porTipo).sort();

        tipos.forEach(tipo => {
            const items = porTipo[tipo];

            // **** LÓGICA DE ORDENAÇÃO SIMPLIFICADA E CORRIGIDA ****
            items.sort((a, b) => {
                if (marca === 'Apple') {
                    // Mantém a exceção para iPhones
                    return getIphoneSortKey(a.modelo) - getIphoneSortKey(b.modelo);
                }
                // Para todas as outras marcas, usa a ordenação natural que você sugeriu!
                return a.modelo.localeCompare(b.modelo, undefined, { numeric: true, sensitivity: 'base' });
            });

            // O código abaixo para renderizar a tabela permanece o mesmo
            const table = document.createElement('table');
            table.dataset.tipo = tipo;
            table.innerHTML = `<thead><tr><th colspan="3" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço (R$)</th></tr></thead><tbody>${items.map(item => `<tr data-modelo="${item.modelo.toUpperCase()}" data-detalhes="${item.detalhes.toUpperCase()}"><td>${item.modelo}</td><td>${item.detalhes}</td><td>${item.preco}</td></tr>`).join('')}</tbody>`;
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
    
    document.querySelectorAll('.marca-container').forEach(marcaContainer => {
        let marcaVisivel = false;
        marcaContainer.querySelectorAll('table').forEach(tabela => {
            let tabelaVisivel = false;
            tabela.querySelectorAll('tbody tr').forEach(linha => {
                const textoLinha = linha.textContent.toUpperCase();
                const passaBusca = textoLinha.includes(buscaTexto);
                
                const passaFiltroMarca = (filtroAtivoMarca === 'todas' || marcaContainer.dataset.marca === filtroAtivoMarca);
                const passaFiltroTipo = (filtroAtivoTipo === 'todas' || tabela.dataset.tipo === filtroAtivoTipo);
                
                if (passaBusca && passaFiltroMarca && passaFiltroTipo) {
                    linha.style.display = "";
                    tabelaVisivel = true;
                    marcaVisivel = true;
                } else {
                    linha.style.display = "none";
                }
            });
            tabela.style.display = tabelaVisivel ? "" : "none";
        });
        marcaContainer.style.display = marcaVisivel ? "" : "none";
    });
}

function handleScroll() {
    if (window.scrollY > 300) {
        backToTopButton.classList.add('visible');
    } else {
        backToTopButton.classList.remove('visible');
    }
}