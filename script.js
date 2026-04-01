// --- CONFIGURAÇÕES GERAIS ---
const avisoAtivado = 0;
const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQn8t8Uk0mXe7dz6Acwn_hs_KWbY4gdLwzg6j190EkTNgI1xfLUiEWVWxzNNARAPlmMwUsO0NwDwEe0/pub?output=csv';

// O SEU MOTOR GOOGLE APPS SCRIPT
const urlAPI = 'https://script.google.com/macros/s/AKfycbye3jwTZx_4JmG98bmgyf8EsGAOZ4opvRrPdGSPATmKMEFNjiAxToS4CO8KXcpG-JVXNQ/exec';

// LISTA DE EMAILS ADMINISTRADORES (Quem pode editar os preços)
// Coloque aqui o seu email de testes e o email do dono da loja
const emailsAdmins = ['desbloqueiounai@gmail.com', 'wandersonmv@live.com', 'samuel_unai22@icloud.com'];
let isAdmin = false; 
let modoEdicao = false; // Controla se o modal está a criar ou editar

const isDevelopmentMode = window.location.protocol === 'file:';
const auth0Config = {
    domain: "jsunai.us.auth0.com",
    clientId: "TvTxOmzG7Z4kskPYGg4XVapGoKQ9eS1a",
    authorizationParams: {
        redirect_uri: window.location.href.split('?')[0].split('#')[0],
        scope: "openid profile email" // <-- ISTO É O QUE FALTAVA
    }
};

// --- VARIÁVEIS GLOBAIS ---
let auth0Client = null;
let loginPrompt, appContent, btnLogin, btnLogout, userNameEl,
    loadingIndicator, backToTopButton, searchInput, brandFiltersContainer,
    typeFiltersContainer, toggleFiltersBtn, collapsibleFilters,
    filtroAtivoMarca = 'todas', filtroAtivoTipo = 'todas';

// --- INICIALIZAÇÃO DA PÁGINA ---
window.addEventListener('load', async () => {
    initializeDOMElements();
    if (isDevelopmentMode) {
        console.warn("MODO DEV - ADMIN FORÇADO");
        isAdmin = true; // Força admin localmente para si
        iniciarApp("Administrador Local");
    } else {
        try {
            auth0Client = await auth0.createAuth0Client(auth0Config);
            if (location.search.includes("code=") && location.search.includes("state=")) {
                await auth0Client.handleRedirectCallback();
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            await updateUI();
        } catch (e) {
            console.error("ERRO AUTH0:", e);
            loadingIndicator.innerHTML = '<p>Erro na autenticação.</p>';
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
    const isAuthenticated = await auth0Client.isAuthenticated();
    if (isAuthenticated) {
        const user = await auth0Client.getUser();
        // VERIFICA SE É ADMIN
        isAdmin = emailsAdmins.includes(user.email);
        iniciarApp(user.name || user.email);
    } else {
        loginPrompt.style.display = 'flex';
        appContent.style.display = 'none';
        loadingIndicator.style.display = 'none';
    }
};

async function iniciarApp(nomeUtilizador) {
    loginPrompt.style.display = 'none';
    appContent.style.display = 'block';
    userNameEl.textContent = nomeUtilizador;
    
    // Mostra botão de adicionar se for Admin
    if(isAdmin) document.getElementById('btn-add-peca').style.display = 'block';
    
    await carregarDados();
    window.addEventListener('scroll', handleScroll);
}

const login = async () => { await auth0Client.loginWithRedirect({ authorizationParams: { ui_locales: 'pt' } }); };
const logout = async () => { await auth0Client.logout({ logoutParams: { returnTo: window.location.href.split('?')[0].split('#')[0] } }); };

// --- LÓGICA DE DADOS (LER DA PLANILHA) ---
async function carregarDados() {
    loadingIndicator.style.display = 'flex';
    loadingIndicator.querySelector('p').textContent = 'A carregar catálogo...';
    try {
        const response = await fetch(urlPlanilha);
        if (!response.ok) throw new Error(`Erro na rede: ${response.status}`);
        const data = await response.text();
        const itens = processarDados(data);
        renderizarPagina(itens);
        popularFiltros(itens);
        setupEventListeners();
    } catch (error) {
        console.error("ERRO AO CARREGAR DADOS:", error);
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
    }).filter(item => item && item.marca && item.tipo); 
}

function renderizarPagina(itens) {
    const containerLista = document.getElementById('lista-container');
    containerLista.innerHTML = '';
    const porMarca = itens.reduce((acc, item) => { (acc[item.marca] = acc[item.marca] || []).push(item); return acc; }, {});
    const marcas = Object.keys(porMarca).sort();

    marcas.forEach(marca => {
        const marcaContainer = document.createElement('div');
        marcaContainer.className = 'marca-container';
        marcaContainer.dataset.marca = marca;
        marcaContainer.innerHTML = `<h2 class="marca-titulo">${marca}</h2>`;

        const porTipo = porMarca[marca].reduce((acc, item) => { (acc[item.tipo] = acc[item.tipo] || []).push(item); return acc; }, {});
        const tipos = Object.keys(porTipo).sort();

        tipos.forEach(tipo => {
            const items = porTipo[tipo];
            items.sort((a, b) => a.modelo.localeCompare(b.modelo, 'pt-BR', { numeric: true, sensitivity: 'base' }));

            // Se for Admin, adiciona coluna extra
            const thAdmin = isAdmin ? `<th>Ações</th>` : '';
            
            const table = document.createElement('table');
            table.dataset.tipo = tipo;
            let tbodyHtml = items.map(item => {
                // Escapar aspas para não quebrar o HTML do botão
                const esc = (str) => str.replace(/'/g, "\\'");
                const acoesHtml = isAdmin ? `
                    <td class="admin-acoes">
                        <button class="btn-acao" onclick="abrirModalEditar('${esc(item.marca)}', '${esc(item.tipo)}', '${esc(item.modelo)}', '${esc(item.detalhes)}', '${item.preco}')">✏️</button>
                        <button class="btn-acao" onclick="excluirItem('${esc(item.marca)}', '${esc(item.tipo)}', '${esc(item.modelo)}', '${esc(item.detalhes)}')">🗑️</button>
                    </td>` : '';
                return `<tr><td>${item.modelo}</td><td>${item.detalhes}</td><td>R$ ${item.preco}</td>${acoesHtml}</tr>`;
            }).join('');

            table.innerHTML = `<thead><tr><th colspan="${isAdmin ? 4 : 3}" class="tipo-titulo">${tipo}</th></tr><tr><th>Modelo</th><th>Detalhes / Qualidade</th><th>Preço</th>${thAdmin}</tr></thead><tbody>${tbodyHtml}</tbody>`;
            marcaContainer.appendChild(table);
        });
        containerLista.appendChild(marcaContainer);
    });
    loadingIndicator.style.display = 'none';
}


// --- LÓGICA DE GESTÃO DO ADMINISTRADOR (CRUD VIA API) ---

function abrirModalCriar() {
    modoEdicao = false;
    document.getElementById('modal-title').textContent = "Adicionar Nova Peça";
    document.getElementById('admin-form').reset();
    document.getElementById('admin-modal').style.display = 'flex';
}

function abrirModalEditar(marca, tipo, modelo, detalhes, preco) {
    modoEdicao = true;
    document.getElementById('modal-title').textContent = "Editar Preço / Peça";
    
    // Guarda dados originais ocultos
    document.getElementById('old-marca').value = marca;
    document.getElementById('old-tipo').value = tipo;
    document.getElementById('old-modelo').value = modelo;
    document.getElementById('old-detalhes').value = detalhes;

    // Preenche para edição
    document.getElementById('input-marca').value = marca;
    document.getElementById('input-tipo').value = tipo;
    document.getElementById('input-modelo').value = modelo;
    document.getElementById('input-detalhes').value = detalhes;
    document.getElementById('input-preco').value = preco;

    document.getElementById('admin-modal').style.display = 'flex';
}

function fecharModal() {
    document.getElementById('admin-modal').style.display = 'none';
}

// FUNÇÃO PARA ENVIAR DADOS (CRIAR E EDITAR)
async function salvarItem(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-salvar-modal');
    btn.disabled = true;
    btn.textContent = "A Guardar na Nuvem...";

    const payload = {
        action: modoEdicao ? 'update' : 'create',
        marca: document.getElementById('input-marca').value,
        tipo: document.getElementById('input-tipo').value,
        modelo: document.getElementById('input-modelo').value,
        detalhes: document.getElementById('input-detalhes').value,
        preco: document.getElementById('input-preco').value
    };

    if (modoEdicao) {
        payload.old_marca = document.getElementById('old-marca').value;
        payload.old_tipo = document.getElementById('old-tipo').value;
        payload.old_modelo = document.getElementById('old-modelo').value;
        payload.old_detalhes = document.getElementById('old-detalhes').value;
    }

    await enviarParaAPI(payload);
    
    fecharModal();
    btn.disabled = false;
    btn.textContent = "💾 Guardar Alterações";
}

// FUNÇÃO PARA APAGAR
async function excluirItem(marca, tipo, modelo, detalhes) {
    if(!confirm(`Tem a certeza que deseja apagar a peça: ${marca} ${modelo}?`)) return;
    
    loadingIndicator.querySelector('p').textContent = 'A remover peça...';
    loadingIndicator.style.display = 'flex';

    const payload = {
        action: 'delete',
        old_marca: marca, old_tipo: tipo, old_modelo: modelo, old_detalhes: detalhes
    };

    await enviarParaAPI(payload);
}

// COMUNICADOR SEGURO COM O GOOGLE SCRIPT
async function enviarParaAPI(payload) {
    try {
        await fetch(urlAPI, {
            method: 'POST',
            mode: 'no-cors', // Evita bloqueios de segurança do browser
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        // Como o 'no-cors' não permite ler a resposta, esperamos 1 segundo para a Google processar
        await new Promise(r => setTimeout(r, 1500));
        await carregarDados(); // Recarrega a tabela atualizada
    } catch (e) {
        alert("Ocorreu um erro ao comunicar com a base de dados.");
        console.error(e);
        loadingIndicator.style.display = 'none';
    }
}

// --- FILTROS (MANTIDOS IGUAIS) ---
function popularFiltros(itens) {
    // Código inalterado...
    const marcasUnicas = [...new Set(itens.map(item => item.marca))];
    const marcas = ['todas', ...marcasUnicas.sort()];
    const tiposUnicos = [...new Set(itens.map(item => item.tipo))];
    const tipos = ['todas', ...tiposUnicos.sort()];
    brandFiltersContainer.innerHTML = marcas.map(marca => `<button class="filter-pill ${marca === 'todas' ? 'active' : ''}" data-filter="${marca}">${marca === 'todas' ? 'Todas as Marcas' : marca}</button>`).join('');
    typeFiltersContainer.innerHTML = tipos.map(tipo => `<button class="filter-pill ${tipo === 'todas' ? 'active' : ''}" data-filter="${tipo}">${tipo === 'todas' ? 'Todos os Tipos' : tipo}</button>`).join('');
}

function setupEventListeners() {
    toggleFiltersBtn.addEventListener('click', () => {
        toggleFiltersBtn.classList.toggle('open');
        collapsibleFilters.classList.toggle('open');
    });
    brandFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        filtroAtivoMarca = e.target.dataset.filter;
        brandFiltersContainer.querySelector('.active')?.classList.remove('active');
        e.target.classList.add('active');
        aplicarTodosOsFiltros();
    });
    typeFiltersContainer.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        filtroAtivoTipo = e.target.dataset.filter;
        typeFiltersContainer.querySelector('.active')?.classList.remove('active');
        e.target.classList.add('active');
        aplicarTodosOsFiltros();
    });
    searchInput.addEventListener('keyup', aplicarTodosOsFiltros);
}

function aplicarTodosOsFiltros() {
    const buscaTexto = searchInput.value.toUpperCase();
    document.querySelectorAll('.marca-container').forEach(marcaContainer => {
        const marcaAtual = marcaContainer.dataset.marca;
        const passaFiltroMarca = (filtroAtivoMarca === 'todas' || marcaAtual === filtroAtivoMarca);
        let marcaTemItensVisiveis = false;
        if (passaFiltroMarca) {
            marcaContainer.querySelectorAll('table').forEach(tabela => {
                const tipoAtual = tabela.dataset.tipo;
                const passaFiltroTipo = (filtroAtivoTipo === 'todas' || tipoAtual === filtroAtivoTipo);
                let tipoTemItensVisiveis = false;
                if (passaFiltroTipo) {
                    tabela.querySelectorAll('tbody tr').forEach(item => {
                        if (item.textContent.toUpperCase().includes(buscaTexto)) {
                            item.style.display = "";
                            tipoTemItensVisiveis = true;
                        } else {
                            item.style.display = "none";
                        }
                    });
                }
                if (tipoTemItensVisiveis) {
                    tabela.style.display = "";
                    marcaTemItensVisiveis = true;
                } else {
                    tabela.style.display = "none";
                }
            });
        }
        marcaContainer.style.display = marcaTemItensVisiveis ? "" : "none";
    });
}

function handleScroll() {
    if (window.scrollY > 300) { backToTopButton.classList.add('visible'); } 
    else { backToTopButton.classList.remove('visible'); }
}