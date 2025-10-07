// VERSÃO FINAL COM ORDENAÇÃO ALFABÉTICA DOS PRODUTOS

const urlPlanilha = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTRm6lEWk_MP0PSDmMNOpHwmu7fiQM4TisoWz78fkEkG_nsG-aeOoU-yKq4IEM9TUFwcPVdE93dKum0/pub?output=csv';

// Elementos da página
const loadingIndicator = document.getElementById('loading-indicator');
const backToTopButton = document.getElementById('back-to-top');
const searchInput = document.getElementById('searchInput');
const brandFiltersContainer = document.getElementById('brand-filters');
const typeFiltersContainer = document.getElementById('type-filters');
const toggleFiltersBtn = document.getElementById('toggle-filters-btn');
const collapsibleFilters = document.getElementById('collapsible-filters');

let filtroAtivoMarca = 'todas';
let filtroAtivoTipo = 'todas';

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    window.addEventListener('scroll', handleScroll);
});

async function carregarDados() {
    loadingIndicator.style.display = 'flex';
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
            // A LINHA ABAIXO É A ÚNICA QUE MUDOU
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
        if (marcaPassaFiltro) {
            containerMarca.querySelectorAll('table').forEach(tabelaTipo => {
                const tipoAtual = tabelaTipo.dataset.tipo;
                let tipoTemItensVisiveis = false;
                const tipoPassaFiltro = (filtroAtivoTipo === 'todas' || tipoAtual === filtroAtivoTipo);
                if (tipoPassaFiltro) {
                    tabelaTipo.querySelectorAll('tbody tr').forEach(linha => {
                        const textoLinha = linha.textContent.toUpperCase();
                        if (textoLinha.includes(buscaTexto)) {
                            linha.style.display = "";
                            tipoTemItensVisiveis = true;
                        } else {
                            linha.style.display = "none";
                        }
                    });
                }
                if (tipoTemItensVisiveis) {
                    tabelaTipo.style.display = "";
                    marcaTemItensVisiveis = true;
                } else {
                    tabelaTipo.style.display = "none";
                }
            });
        }
        containerMarca.style.display = marcaTemItensVisiveis ? "" : "none";
    });
}

function handleScroll() {
    if (window.scrollY > 300) {
        backToTopButton.classList.add('visible');
    } else {
        backToTopButton.classList.remove('visible');
    }
}
