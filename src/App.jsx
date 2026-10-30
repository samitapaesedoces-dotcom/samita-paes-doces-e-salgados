import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import './App.css'

const vendedores = [
  {
    nome: 'Samita',
    descricao: 'Pães, doces e salgados',
    telefone: '5511982747306',
  },
  {
    nome: 'Samuel',
    descricao: 'Atendimento e vendas',
    telefone: '5511971631614',
  },
]

const produtoVazio = {
  nome: '',
  descricao: '',
  preco: '',
  estoque: '0',
  ativo: true,
}

function App() {
  const [mostrarLogin, setMostrarLogin] = useState(false)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [perfil, setPerfil] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [produto, setProduto] = useState(produtoVazio)
  const [editando, setEditando] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [relatorioProduto, setRelatorioProduto] = useState([])
  const [produtoRelatorio, setProdutoRelatorio] = useState('')
  const [dataRelatorio, setDataRelatorio] = useState('')
  const [clientes, setClientes] = useState([])
  const [listaVendedores, setListaVendedores] = useState([])
  const [carrinho, setCarrinho] = useState([])
  const [itensSelecionados, setItensSelecionados] = useState([])
  const [enviandoPedido, setEnviandoPedido] = useState(false)
  const [chaveIdempotencia, setChaveIdempotencia] = useState(
  () => crypto.randomUUID()
)
  const [vendedorSelecionado, setVendedorSelecionado] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')
  const [cliente, setCliente] = useState({
  nome: '',
  telefone: '',
  vendedor_id: '',
})
const [editandoCliente, setEditandoCliente] = useState(null)
const [pedidos, setPedidos] = useState([])
const [pagamentos, setPagamentos] = useState([])
const [periodoFinanceiro, setPeriodoFinanceiro] = useState('mes')
const [valoresPagamento, setValoresPagamento] = useState({})
const [formasPagamento, setFormasPagamento] = useState({})
const totalPagoPedido = (pedidoId) =>
  pagamentos
    .filter(
      (p) => p.pedido_id === pedidoId && p.tipo === 'pagamento'
    )
    .reduce((total, p) => total + Number(p.valor), 0)

const saldoPedido = (pedido) => {
  if (pedido.status === 'cancelado') return 0

  return Math.max(
    0,
    Number(pedido.total) - totalPagoPedido(pedido.id)
  )
}
const [clienteExtrato, setClienteExtrato] = useState('')
const [pedidoSelecionado, setPedidoSelecionado] = useState(null)
const [detalhesPedido, setDetalhesPedido] = useState([])
const [carregandoDetalhes, setCarregandoDetalhes] = useState(false)
const [pedido, setPedido] = useState({
  cliente_id: '',
  vendedor_id: '',
  data_entrega: '',
  observacoes: '',
})

const [itensPedido, setItensPedido] = useState([
  { produto_id: '', quantidade: 1 },
])

const produtosSelecionados = carrinho.filter(
  (item) => itensSelecionados.includes(item.id)
)

const todosSelecionados =
  carrinho.length > 0 &&
  produtosSelecionados.length === carrinho.length 

useEffect(() => {
  let ativo = true

  async function verificarSessao() {
    const { data } = await supabase.auth.getSession()

    if (data.session && ativo) {
      await carregarPerfil(data.session.user.id, ativo)
    }
  }

  carregarVendedores()
  carregarProdutos()
  verificarSessao()

  const { data: listener } = supabase.auth.onAuthStateChange(
    (_evento, sessao) => {
      if (!sessao && ativo) setPerfil(null)
    }
  )

  return () => {
    ativo = false
    listener.subscription.unsubscribe()
  }
}, [])


  async function carregarPerfil(userId, aindaAtivo = true) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nome, papel, ativo')
      .eq('id', userId)
      .single()

    if (!aindaAtivo) return

    if (error || !data || !data.ativo) {
      await supabase.auth.signOut()
      setErro('Perfil não encontrado ou desativado.')
      return
    }

    setPerfil(data)
    setErro('')

    if (data.papel === 'admin') {
  await Promise.all([
    carregarProdutos(),
    carregarClientes(),
    carregarVendedores(),
    carregarPedidos(),
    carregarPagamentos(),
  ])
} 
else if (data.papel === 'vendedor') {
  await Promise.all([
    carregarProdutos(),
    carregarClientes(),
    carregarVendedores(),
    carregarPedidos(),
    carregarPagamentos(),
  ])
}
    }

  async function entrar(event) {
    event.preventDefault()
    setCarregando(true)
    setErro('')
    setMensagem('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setErro(error.message)
      setCarregando(false)
      return
    }

    await carregarPerfil(data.user.id)
    setSenha('')
    setCarregando(false)
  }

  
async function carregarPedidos() {
  const { data, error } = await supabase.rpc('listar_pedidos')

  if (error) {
    setErro(`Erro ao carregar pedidos: ${error.message}`)
    return
  }

  setPedidos(data || [])
}
async function atualizarStatusPedido(pedidoId, novoStatus) {
  const { error } = await supabase
    .from('orders')
    .update({ status: novoStatus })
    .eq('id', pedidoId)

  if (error) {
    setErro(`Erro ao atualizar status: ${error.message}`)
    return
  }

  await carregarPedidos()
}
async function cancelarPedido(pedidoId) {
  const confirmar = window.confirm(
    `Deseja realmente cancelar o pedido nº ${pedidoId}?`
  )

  if (!confirmar) return

  const { error } = await supabase.rpc('cancelar_pedido_seguro', {
    p_pedido_id: pedidoId,
  })

  if (error) {
    setErro(`Erro ao cancelar pedido: ${error.message}`)
    return
  }

  await carregarPedidos()
  window.location.reload()
}
async function carregarPagamentos() {
  const { data, error } = await supabase
    .from('customer_payments')
    .select('id, pedido_id, valor, forma, status, tipo, vencimento, pago_em, criado_em')
    .order('criado_em', { ascending: false })

  if (error) {
    setErro(`Erro ao carregar pagamentos: ${error.message}`)
    return
  }

  setPagamentos(data || [])
}
async function atualizarPagamento(id, alteracoes) {
  setErro('')
  setMensagem('')

  const pagamento = pagamentos.find((p) => p.id === id)

  if (!pagamento) return

  const { error } = await supabase.rpc('registrar_pagamento', {
    p_pedido_id: pagamento.pedido_id,
    p_valor: Number(alteracoes.valor || pagamento.valor),
    p_forma: alteracoes.forma || pagamento.forma,
  })

  if (error) {
    setErro(`Erro ao registrar pagamento: ${error.message}`)
    return
  }

  setMensagem('Pagamento registrado com sucesso!')
  await carregarPagamentos()
}
async function verDetalhesPedido(id) {
  setErro('')
  setMensagem('')
  setCarregandoDetalhes(true)
  setPedidoSelecionado(id)
  setDetalhesPedido([])

  const { data, error } = await supabase.rpc(
    'detalhes_pedido',
    { p_pedido_id: id }
  )

  if (error) {
    setErro(`Erro ao carregar detalhes: ${error.message}`)
  } else {
    setDetalhesPedido(data || [])
  }

  setCarregandoDetalhes(false)
}

async function buscarRelatorioProduto(produtoId, data) {
  setErro('')
  setMensagem('')

  const { data: resultado, error } = await supabase.rpc(
    'relatorio_diario_produto',
    {
      p_produto_id: produtoId,
      p_data: data,
    }
  )

  if (error) {
    setErro(`Erro ao gerar relatório: ${error.message}`)
    return
  }

  setRelatorioProduto(resultado || [])
}

function imprimirRelatorioProduto() {
  if (relatorioProduto.length === 0) return

  const escapar = (valor) =>
    String(valor ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[c])

  const moeda = (valor) =>
    Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  const nomeProduto = produtos.find(
    (p) => String(p.id) === String(produtoRelatorio)
  )?.nome || 'Produto'

  const linhas = relatorioProduto.map((venda) => `
    <tr>
      <td>${escapar(venda.cliente_nome)}</td>
      <td>${venda.pedido_id}</td>
      <td>${venda.quantidade}</td>
      <td>${moeda(venda.preco_unitario)}</td>
      <td>${moeda(venda.subtotal_produto)}</td>
      <td>${moeda(venda.total_pedido)}</td>
    </tr>
  `).join('')

  const janela = window.open('', '_blank')

  if (!janela) {
    setErro('Permita a abertura de pop-ups para imprimir.')
    return
  }

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Relatório diário - ${escapar(nomeProduto)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          color: #333;
        }
        h1, h2 { color: #70452f; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 9px;
          text-align: left;
        }
        th { background: #f5eee8; }
        .resumo {
          margin-top: 25px;
          padding: 15px;
          background: #f5eee8;
        }
        @media print {
          body { padding: 10px; }
        }
      </style>
    </head>
    <body>
      <h1>Samita</h1>
      <p>Pães, Doces e Salgados</p>
      <hr>

      <h2>Relatório diário de vendas</h2>
      <p><strong>Produto:</strong> ${escapar(nomeProduto)}</p>
      <p><strong>Data:</strong> ${escapar(new Date(dataRelatorio + 'T12:00:00').toLocaleDateString('pt-BR'))}</p>

      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Pedido</th>
            <th>Quantidade</th>
            <th>Valor unitário</th>
            <th>Total do produto</th>
            <th>Total do pedido</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>

      <div class="resumo">
        <h2>Resumo do dia</h2>
        <p><strong>Quantidade vendida:</strong> ${relatorioProduto[0].quantidade_total_dia}</p>
        <p><strong>Total arrecadado com o produto:</strong> ${moeda(relatorioProduto[0].valor_total_produto_dia)}</p>
      </div>
    </body>
    </html>
  `)

  janela.document.close()
  janela.focus()
  janela.print()
}

function imprimirPedido(item) {
  const escapar = (valor) =>
    String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[caractere])

  const formatarMoeda = (valor) =>
    Number(valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })

  const produtosHTML = detalhesPedido.map((produto) => `
    <tr>
      <td>${escapar(produto.nome_produto)}</td>
      <td>${escapar(produto.quantidade)}</td>
      <td>${formatarMoeda(produto.preco_unitario)}</td>
      <td>${formatarMoeda(produto.subtotal)}</td>
    </tr>
  `).join('')

  const janela = window.open('', '_blank')

  if (!janela) {
    setErro('Permita a abertura de pop-ups para imprimir o pedido.')
    return
  }

  janela.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Pedido nº ${escapar(item.id)}</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 30px;
          color: #333;
        }
        h1, h2 { color: #70452f; }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px;
          text-align: left;
        }
        th { background: #f5eee8; }
        .total {
          text-align: right;
          font-size: 20px;
          margin-top: 20px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <h1>Samita</h1>
      <p>Pães, Doces e Salgados</p>
      <hr>

      <h2>Pedido nº ${escapar(item.id)}</h2>

      <p><strong>Cliente:</strong> ${escapar(item.nome_cliente)}</p>
      <p><strong>Vendedor:</strong> ${escapar(item.nome_vendedor)}</p>
      <p><strong>Data do pedido:</strong> ${escapar(new Date(item.criado_em).toLocaleString('pt-BR'))}</p>
      <p><strong>Entrega:</strong> ${item.data_entrega ? escapar(new Date(item.data_entrega).toLocaleString('pt-BR')) : 'Não definida'}</p>

      <h2>Produtos</h2>

      <table>
        <thead>
          <tr>
            <th>Produto</th>
            <th>Quantidade</th>
            <th>Preço unitário</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>${produtosHTML}</tbody>
      </table>

      <p class="total">Total: ${formatarMoeda(item.total)}</p>

      <p><strong>Observações:</strong> ${escapar(item.observacoes || 'Nenhuma')}</p>
    </body>
    </html>
  `)

  janela.document.close()
  janela.focus()
  janela.print()
}

  async function carregarProdutos() {
  setCarregando(true)
  setErro('')

  const { data, error } = await supabase
    .from('products')
    .select('id, nome, descricao, preco, estoque, ativo, criado_em')
    .order('criado_em', { ascending: false })

  console.log('Produto completo:', JSON.stringify(data, null, 2))
  console.log('Erro ao carregar:', error)

  if (error) {
    setErro(`Não foi possível carregar os produtos: ${error.message}`)
  } else {
    setProdutos(data || [])
  }

  setCarregando(false)
}

function adicionarAoCarrinho(produto) {
  const jaExiste = carrinho.some(
    (item) => item.id === produto.id
  )

  if (!jaExiste && produto.estoque > 0) {
    setItensSelecionados((atual) =>
      atual.includes(produto.id)
        ? atual
        : [...atual, produto.id]
    )
  }

  setCarrinho((atual) => {
    const existente = atual.find(
      (item) => item.id === produto.id
    )

    if (existente) {
      if (existente.quantidade >= produto.estoque) {
        return atual
      }

      return atual.map((item) =>
        item.id === produto.id
          ? { ...item, quantidade: item.quantidade + 1 }
          : item
      )
    }

    if (produto.estoque <= 0) {
      return atual
    }

    return [...atual, { ...produto, quantidade: 1 }]
  })
}

async function finalizarPedido() {
  if (enviandoPedido) return

  if (!nomeCliente.trim()) {
    alert('Informe seu nome.')
    return
  }

  const telefone = telefoneCliente.replace(/\D/g, '')

  if (telefone.length !== 10 && telefone.length !== 11) {
    alert('Informe um telefone válido.')
    return
  }

  if (!vendedorSelecionado) {
    alert('Escolha seu vendedor.')
    return
  }

  if (produtosSelecionados.length === 0) {
  alert('Selecione pelo menos um produto para comprar.')
  return
}

const itens = produtosSelecionados.map((item) => ({
  produto_id: item.id,
  quantidade: item.quantidade
}))

  setEnviandoPedido(true)

  try {
    const { data, error } = await supabase.rpc(
      'registrar_pedido_publico',
      {
        p_nome: nomeCliente.trim(),
        p_telefone: telefone,
        p_vendedor_id: vendedorSelecionado,
        p_itens: itens,
        p_forma_pagamento: formaPagamento,
        p_chave_idempotencia: chaveIdempotencia
      }
    )

    if (error) {
      alert(`Não foi possível finalizar o pedido: ${error.message}`)
      return
    }

    alert(`Pedido nº ${data} enviado com sucesso!`)

    setCarrinho((atual) =>
  atual.filter(
    (item) => !itensSelecionados.includes(item.id)
  )
)
setItensSelecionados([])
    setNomeCliente('')
    setTelefoneCliente('')
    setVendedorSelecionado('')
    setFormaPagamento('pix')
    setChaveIdempotencia(crypto.randomUUID())

    await carregarProdutos()
  } finally {
    setEnviandoPedido(false)
  }
}

  function atualizarCampo(campo, valor) {
    setProduto((anterior) => ({ ...anterior, [campo]: valor }))
  }

  function prepararEdicao(item) {
    setProduto({
      nome: item.nome || '',
      descricao: item.descricao || '',
      preco: String(item.preco ?? ''),
      estoque: String(item.estoque ?? 0),
      ativo: item.ativo,
    })
    setEditando(item.id)
    setErro('')
    setMensagem('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelarEdicao() {
    setProduto(produtoVazio)
    setEditando(null)
    setErro('')
    setMensagem('')
  }

  async function salvarProduto(event) {
    event.preventDefault()
    setCarregando(true)
    setErro('')
    setMensagem('')

    const preco = Number(String(produto.preco).replace(',', '.'))
    const estoque = Number(produto.estoque)

    if (!produto.nome.trim()) {
      setErro('Informe o nome do produto.')
      setCarregando(false)
      return
    }

    if (!Number.isFinite(preco) || preco < 0) {
      setErro('Informe um preço válido.')
      setCarregando(false)
      return
    }

    if (!Number.isInteger(estoque) || estoque < 0) {
      setErro('O estoque deve ser um número inteiro igual ou maior que zero.')
      setCarregando(false)
      return
    }

    const dados = {
      nome: produto.nome.trim(),
      descricao: produto.descricao.trim(),
      preco,
      estoque,
      ativo: produto.ativo,
    }

    let resultado

    if (editando !== null) {
      resultado = await supabase
        .from('products')
        .update(dados)
        .eq('id', editando)
    } else {
      resultado = await supabase
        .from('products')
        .insert(dados)
    }

    if (resultado.error) {
      setErro(`Não foi possível salvar: ${resultado.error.message}`)
      setCarregando(false)
      return
    }

    setMensagem(editando !== null
      ? 'Produto atualizado com sucesso!'
      : 'Produto cadastrado com sucesso!')

    setProduto(produtoVazio)
    setEditando(null)

    await carregarProdutos()
    await carregarPedidos()
    await carregarPagamentos()
    setCarregando(false)
  }

  async function alternarAtivo(item) {
    setErro('')
    setMensagem('')

    const { error } = await supabase
      .from('products')
      .update({ ativo: !item.ativo })
      .eq('id', item.id)

    if (error) {
      setErro(`Não foi possível alterar a disponibilidade: ${error.message}`)
      return
    }

    setMensagem(
      item.ativo
        ? 'Produto desativado.'
        : 'Produto ativado.'
    )

    await carregarProdutos()
  }

  async function sair() {
    await supabase.auth.signOut()
    setPerfil(null)
    setProdutos([])
    setEmail('')
    setSenha('')
    cancelarEdicao()
    setMostrarLogin(false)
  }
  
async function carregarClientes() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, nome, telefone, vendedor_id, criado_em')
    .order('criado_em', { ascending: false })

  if (error) {
    setErro(`Erro ao carregar clientes: ${error.message}`)
    return
  }

  setClientes(data || [])
}

async function carregarVendedores() {
  const { data, error } = await supabase.rpc(
    'listar_vendedores_publicos'
  )

  if (error) {
    console.error('Erro ao carregar vendedores:', error)
    return
  }

  setListaVendedores(data || [])
}

async function salvarCliente(event) {
  event.preventDefault()
  setErro('')
  setMensagem('')
  setCarregando(true)

  const nome = cliente.nome.trim()
  const telefone = cliente.telefone.trim()
  const telefoneNumeros = telefone.replace(/\D/g, '')

  if (!nome) {
    setErro('Informe o nome do cliente.')
    setCarregando(false)
    return
  }

  if (telefone && ![10, 11].includes(telefoneNumeros.length)) {
    setErro('Informe um telefone válido com DDD.')
    setCarregando(false)
    return
  }

  if (
    telefoneNumeros &&
    clientes.some(
      (item) =>
        String(item.id) !== String(editandoCliente) &&
        item.telefone?.replace(/\D/g, '') === telefoneNumeros
    )
  ) {
    setErro('Já existe um cliente cadastrado com esse telefone.')
    setCarregando(false)
    return
  }

  if (perfil.papel === 'admin' && !cliente.vendedor_id) {
    setErro('Selecione o vendedor responsável.')
    setCarregando(false)
    return
  }

  const dados = {
    nome,
    telefone: telefone || null,
    vendedor_id:
      perfil.papel === 'vendedor'
        ? perfil.id
        : cliente.vendedor_id,
  }

  let resultado

  if (editandoCliente !== null) {
    resultado = await supabase
      .from('customers')
      .update(dados)
      .eq('id', editandoCliente)
  } else {
    resultado = await supabase
      .from('customers')
      .insert(dados)
  }

  if (resultado.error) {
    setErro(`Não foi possível salvar: ${resultado.error.message}`)
    setCarregando(false)
    return
  }

  setMensagem(
    editandoCliente !== null
      ? 'Cliente atualizado com sucesso!'
      : 'Cliente cadastrado com sucesso!'
  )

  setCliente({
    nome: '',
    telefone: '',
    vendedor_id: '',
  })

  setEditandoCliente(null)

  await carregarClientes()
  setCarregando(false)
}

function editarCliente(item) {
  setCliente({
    nome: item.nome || '',
    telefone: item.telefone || '',
    vendedor_id: item.vendedor_id || '',
  })

  setEditandoCliente(item.id)
  setErro('')
  setMensagem('')

  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function excluirCliente(id) {
  const confirmar = window.confirm(
    'Tem certeza que deseja excluir este cliente?'
  )

  if (!confirmar) return

  setErro('')
  setMensagem('')
  setCarregando(true)

  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id)

  if (error) {
    setErro(`Erro ao excluir cliente: ${error.message}`)
    setCarregando(false)
    return
  }

  setMensagem('Cliente excluído com sucesso!')
  await carregarClientes()
  setCarregando(false)
}


async function salvarPedido(event) {
  event.preventDefault()
  setErro('')
  setMensagem('')
  setCarregando(true)

  if (!pedido.cliente_id) {
    setErro('Selecione um cliente.')
    setCarregando(false)
    return
  }

  const itensValidos = itensPedido.filter(
    (item) => item.produto_id && Number(item.quantidade) > 0
  )

  if (itensValidos.length === 0) {
    setErro('Adicione pelo menos um produto.')
    setCarregando(false)
    return
  }

  const dados = {
    p_cliente_id: Number(pedido.cliente_id),
    p_itens: itensValidos.map((item) => ({
      produto_id: Number(item.produto_id),
      quantidade: Number(item.quantidade),
    })),
    p_vendedor_id:
      perfil.papel === 'admin' ? pedido.vendedor_id : null,
    p_data_entrega: pedido.data_entrega
      ? new Date(pedido.data_entrega).toISOString()
      : null,
    p_observacoes: pedido.observacoes.trim() || null,
  }

  if (perfil.papel === 'admin' && !pedido.vendedor_id) {
    setErro('Selecione o vendedor responsável.')
    setCarregando(false)
    return
  }

  const { data, error } = await supabase.rpc(
    'registrar_venda',
    dados
  )

  if (error) {
    setErro(`Não foi possível registrar a venda: ${error.message}`)
    setCarregando(false)
    return
  }

  setMensagem(`Pedido nº ${data} registrado com sucesso!`)

  setPedido({
    cliente_id: '',
    vendedor_id: '',
    data_entrega: '',
    observacoes: '',
  })

  setItensPedido([{ produto_id: '', quantidade: 1 }])

  await carregarProdutos()
  setCarregando(false)
}

const pedidosFiltrados = pedidos.filter((pedido) => {
  if (pedido.status === 'cancelado') return false

  const dataPedido = new Date(pedido.criado_em)
  const hoje = new Date()

  if (periodoFinanceiro === 'hoje') {
    return dataPedido.toDateString() === hoje.toDateString()
  }

  if (periodoFinanceiro === 'semana') {
    const inicioSemana = new Date(hoje)
    inicioSemana.setHours(0, 0, 0, 0)
    inicioSemana.setDate(
      hoje.getDate() - ((hoje.getDay() + 6) % 7)
    )

    return dataPedido >= inicioSemana && dataPedido <= hoje
  }

  if (periodoFinanceiro === 'mes') {
    return (
      dataPedido.getMonth() === hoje.getMonth() &&
      dataPedido.getFullYear() === hoje.getFullYear()
    )
  }

  return true
})

if (perfil) {
  return (
    <main className="site">


        <header className="topo">
          <div className="marca">
            <div className="simbolo">SP</div>
            <div>
              <h1>Samita</h1>
              <p>Pães, Doces e Salgados</p>
            </div>
          </div>
          <button className="botao-entrar" onClick={sair}>
            Sair da conta
          </button>
          </header>

<section className="painel-produtos">
  <h2>
    {editando !== null ? 'Editar produto' : 'Cadastrar produto'}
  </h2>

  <form className="form-produto" onSubmit={salvarProduto}>
    <label>Nome do produto *</label>
    <input
      value={produto.nome}
      onChange={(e) => atualizarCampo('nome', e.target.value)}
      placeholder="Nome do produto"
      required
    />

    <label>Descrição</label>
    <textarea
      value={produto.descricao}
      onChange={(e) => atualizarCampo('descricao', e.target.value)}
      placeholder="Descrição do produto"
    />

    <label>Preço (R$) *</label>
    <input
      type="number"
      min="0"
      step="0.01"
      value={produto.preco}
      onChange={(e) => atualizarCampo('preco', e.target.value)}
      placeholder="0,00"
      required
    />

    <label>Estoque *</label>
    <input
      type="number"
      min="0"
      step="1"
      value={produto.estoque}
      onChange={(e) => atualizarCampo('estoque', e.target.value)}
      required
    />

    <label className="campo-checkbox">
      <input
        type="checkbox"
        checked={produto.ativo}
        onChange={(e) => atualizarCampo('ativo', e.target.checked)}
      />
      Produto disponível para venda
    </label>

    {erro && <p className="erro-login">{erro}</p>}
    {mensagem && <p className="sucesso-login">{mensagem}</p>}

    <button className="botao-principal" disabled={carregando}>
      {carregando
        ? 'Salvando...'
        : editando !== null
          ? 'Salvar alterações'
          : 'Cadastrar produto'}
    </button>

    {editando !== null && (
      <button
        type="button"
        className="botao-voltar"
        onClick={cancelarEdicao}
      >
        Cancelar edição
      </button>
    )}
  </form>

  <div className="titulo-lista">
    <h2>Produtos cadastrados ({produtos.length})</h2>
    <button
      type="button"
      className="botao-voltar"
      onClick={carregarProdutos}
      disabled={carregando}
    >
      Atualizar produtos
    </button>
  </div>

  {produtos.length === 0 ? (
    <p>Nenhum produto cadastrado.</p>
  ) : (
    <div className="itens-produtos">
      {produtos.map((item) => (
        <article className="item-produto" key={item.id}>
          <div className="produto-info">
            <h3>{item.nome}</h3>
            <p>{item.descricao || 'Sem descrição'}</p>
            <p>
              Preço: {Number(item.preco).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
            <p>Estoque: {item.estoque}</p>
            <span className={`estado ${item.ativo ? 'ativo' : ''}`}>
              {item.ativo ? 'Disponível' : 'Indisponível'}
            </span>
          </div>

          <div className="acoes-produto">
            <button
              type="button"
              className="botao-voltar"
              onClick={() => prepararEdicao(item)}
            >
              Editar
            </button>

            <button
              type="button"
              className="botao-voltar"
              onClick={() => alternarAtivo(item)}
            >
              {item.ativo ? 'Desativar' : 'Ativar'}
            </button>
          </div>
        </article>
      ))}
    </div>
  )}
</section>

<section className="painel-produtos">
  <h2>Resumo financeiro</h2>

  <div className="filtro-periodo">
    <label>Filtrar por período:</label>

    <select
      value={periodoFinanceiro}
      onChange={(e) => setPeriodoFinanceiro(e.target.value)}
    >
      <option value="hoje">Hoje</option>
      <option value="semana">Esta semana</option>
      <option value="mes">Este mês</option>
      <option value="todos">Todo o período</option>
    </select>
  </div>

  <div className="resumo-produtos">
    <div>
      <span>Total vendido</span>
      <strong>
        {pedidosFiltrados
          .reduce((total, p) => total + Number(p.total), 0)
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </strong>
    </div>

    <div>
      <span>Total recebido</span>
      <strong>
        {pagamentos
          .filter((p) =>
            p.tipo === 'pagamento' &&
            p.status === 'pago' &&
            pedidosFiltrados.some((pedido) =>
              pedido.id === p.pedido_id
            )
          )
          .reduce((total, p) => total + Number(p.valor), 0)
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </strong>
    </div>

    <div>
      <span>Total pendente</span>
      <strong>
        {pedidosFiltrados
          .reduce((total, p) => total + saldoPedido(p), 0)
          .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </strong>
    </div>

    <div>
      <span>Quantidade de vendas</span>
      <strong>
        {pedidosFiltrados.length}
      </strong>
    </div>
  </div>
</section>

<section className="painel-produtos">
  <h2>Relatório diário por produto</h2>

  <label htmlFor="produto-relatorio">Selecione o produto</label>
  <select
    id="produto-relatorio"
    value={produtoRelatorio}
    onChange={(e) => {
      setProdutoRelatorio(e.target.value)
      setRelatorioProduto([])
    }}
  >
    <option value="">Escolha um produto</option>
    {produtos.map((item) => (
      <option key={item.id} value={item.id}>
        {item.nome}
      </option>
    ))}
  </select>

  <label htmlFor="data-relatorio">Data das vendas</label>
  <input
    id="data-relatorio"
    type="date"
    value={dataRelatorio}
    onChange={(e) => {
      setDataRelatorio(e.target.value)
      setRelatorioProduto([])
    }}
  />

  <button
    type="button"
    className="botao-principal"
    disabled={!produtoRelatorio || !dataRelatorio}
    onClick={() =>
      buscarRelatorioProduto(
        Number(produtoRelatorio),
        dataRelatorio
      )
    }
  >
    Gerar relatório
  </button>

  {relatorioProduto.length > 0 && (
    <div className="lista-produtos">
      <h3>
        {produtos.find(
          (p) => String(p.id) === String(produtoRelatorio)
        )?.nome}
      </h3>

      {relatorioProduto.map((venda) => (
        <article className="item-produto" key={venda.pedido_id}>
          <div className="produto-info">
            <h4>Cliente: {venda.cliente_nome}</h4>
            <p>Pedido nº {venda.pedido_id}</p>
            <p>Quantidade: {venda.quantidade}</p>
            <p>
              Valor unitário: {Number(venda.preco_unitario).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
              
            </p>
            <p>
              Total do produto: {Number(venda.subtotal_produto).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
            
            <p>
              Total do pedido do cliente: {Number(venda.total_pedido).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>
          </div>
        </article>
      ))}

      <div className="resumo-produtos">
        <div>
          <span>Quantidade total vendida</span>
          <strong>{relatorioProduto[0].quantidade_total_dia}</strong>
        </div>

        <div>
          <span>Total arrecadado com o produto</span>
          <strong>
            {Number(relatorioProduto[0].valor_total_produto_dia).toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
          </strong>
        </div>
      </div>
      <button
  type="button"
  className="botao-principal"
  onClick={imprimirRelatorioProduto}
>
  Imprimir relatório
</button>
    </div>
  )}

  {relatorioProduto.length === 0 && (
    <p>Nenhum resultado carregado. Selecione o produto e a data.</p>
  )}
</section>

<section className="painel-produtos">
  <div className="titulo-lista">
    <h2>Controle de pagamentos ({pagamentos.length})</h2>

    <button
      type="button"
      className="botao-voltar"
      onClick={carregarPagamentos}
    >
      Atualizar pagamentos
    </button>
  </div>
  <label htmlFor="cliente-extrato">Selecione o cliente</label>

<select
  id="cliente-extrato"
  value={clienteExtrato}
  onChange={(e) => setClienteExtrato(e.target.value)}
>
  <option value="">Escolha um cliente</option>

  {clientes.map((item) => (
    <option key={item.id} value={item.id}>
      {item.nome}
    </option>
  ))}
</select>

{clienteExtrato && (
  <>
    <div className="resumo-produtos">
      <div>
        <span>Total comprado</span>
        <strong>
          {pedidos
            .filter((p) =>
  String(p.cliente_id) === clienteExtrato &&
  p.status !== 'cancelado'
)
            .reduce((total, p) => total + Number(p.total), 0)
            .toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
        </strong>
      </div>

      <div>
        <span>Total pago</span>
        <strong>
          {pagamentos
            .filter((pg) =>
              pg.tipo === 'pagamento' &&
              pedidos.some((p) =>
                p.id === pg.pedido_id &&
                String(p.cliente_id) === clienteExtrato &&
                p.status !== 'cancelado'
              )
            )
            .reduce((total, pg) => total + Number(pg.valor), 0)
            .toLocaleString('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            })}
        </strong>
      </div>

      <div>
        <span>Saldo devedor</span>
        <strong>
          {pedidos
            .filter((p) => String(p.cliente_id) === clienteExtrato)
            .reduce((total, p) => total + saldoPedido(p), 0)
            .toLocaleString('pt-BR', { 
              style: 'currency',
              currency: 'BRL',
            })}
        </strong>
      </div>
    </div>

    <div className="lista-produtos">
      <h3>Histórico do cliente</h3>

      {pedidos.filter(
  (p) =>
    String(p.cliente_id) === clienteExtrato &&
    p.status !== 'cancelado'
)
      .length === 0 ? (
        <p>Nenhum pedido encontrado para este cliente.</p>
      ) : (
        pedidos
          .filter((p) => String(p.cliente_id) === clienteExtrato)
          .map((p) => {
            const pagamentosPedido = pagamentos.filter(
              (pg) =>
                pg.pedido_id === p.id &&
                pg.tipo === 'pagamento'
            )

            return (
              <article className="item-produto" key={p.id}>
                <div className="produto-info">
                  <h4>Pedido nº {p.id}</h4>

                  <p>
                    Data: {new Date(p.criado_em).toLocaleDateString('pt-BR')}
                  </p>

                  <p>
                    Valor: {Number(p.total).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>

                  <p>
                    Total pago: {totalPagoPedido(p.id).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>

                  <p>
                    Saldo: {saldoPedido(p).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>

                  <p><strong>Pagamentos registrados:</strong></p>

                  {pagamentosPedido.length === 0 ? (
                    <p>Nenhum pagamento registrado.</p>
                  ) : (
                    pagamentosPedido.map((pg) => (
                      <p key={pg.id}>
                        {Number(pg.valor).toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                        {' — '}
                        {pg.forma}
                        {' — '}
                        {pg.pago_em
                          ? new Date(pg.pago_em).toLocaleDateString('pt-BR')
                          : 'Data não registrada'}
                      </p>
                    ))
                  )}
                </div>
              </article>
            )
          })
      )}
    </div>
  </>
)}

{pagamentos.filter(
  (p) =>
    p.tipo === 'cobranca' &&
    pedidos.some(
      (pedido) =>
        pedido.id === p.pedido_id &&
        pedido.status !== 'cancelado'
    )
)
.length === 0 ? (
  <p>Nenhuma cobrança registrada.</p>
) : (
  <div className="itens-produtos">
    {pagamentos
      .filter(
  (p) =>
    p.tipo === 'cobranca' &&
    pedidos.some(
      (pedido) =>
        pedido.id === p.pedido_id &&
        pedido.status !== 'cancelado'
    )
)
      .map((cobranca) => {
        const pedidoRelacionado = pedidos.find(
          (p) => p.id === cobranca.pedido_id
        )

        const saldo = saldoPedido({
          id: cobranca.pedido_id,
          total: cobranca.valor,
        })

        return (
          <article className="item-produto" key={cobranca.id}>
            <div className="produto-info">
              <h3>Pedido nº {cobranca.pedido_id}</h3>

              <p>
                Cliente: {pedidoRelacionado?.nome_cliente || 'Não encontrado'}
              </p>

              <p>
                Valor da venda: {Number(cobranca.valor).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>

              <p>
                Total pago: {(Number(cobranca.valor) - saldo).toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </p>

              <strong>
                Saldo devedor: {saldo.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </strong>

              {saldo > 0 && (
                <>
                  <label>Valor recebido</label>
                  <input
                    type="number"
                    min="0.01"
                    max={saldo}
                    step="0.01"
                    value={valoresPagamento[cobranca.pedido_id] || ''}
                    onChange={(e) =>
                      setValoresPagamento({
                        ...valoresPagamento,
                        [cobranca.pedido_id]: e.target.value,
                      })
                    }
                    placeholder="Digite o valor"
                  />

                  <label>Forma de pagamento</label>
                  <select
                    value={formasPagamento[cobranca.pedido_id] || 'pix'}
                    onChange={(e) =>
                      setFormasPagamento({
                        ...formasPagamento,
                        [cobranca.pedido_id]: e.target.value,
                      })
                    }
                  >
                    <option value="pix">Pix</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="deixar na conta (fiado)">Deixar na conta (Fiado)</option>
                  </select>

                  <button
                    type="button"
                    onClick={async () => {
                      const valor = Number(valoresPagamento[cobranca.pedido_id])

                      if (!valor || valor <= 0 || valor > saldo) {
                        setErro('Informe um valor válido dentro do saldo devedor.')
                        return
                      }

                      const { error } = await supabase.rpc('registrar_pagamento', {
                        p_pedido_id: cobranca.pedido_id,
                        p_valor: valor,
                        p_forma: formasPagamento[cobranca.pedido_id] || 'pix',
                      })

                      if (error) {
                        setErro(`Erro ao registrar pagamento: ${error.message}`)
                        return
                      }

                      setMensagem('Pagamento registrado com sucesso!')
                      setValoresPagamento({
                        ...valoresPagamento,
                        [cobranca.pedido_id]: '',
                      })

                      await carregarPagamentos()
                    }}
                  >
                    Registrar pagamento
                  </button>
                </>
              )}

              <h4>Pagamentos realizados</h4>

              {pagamentos
                .filter(
                  (p) =>
                    p.pedido_id === cobranca.pedido_id &&
                    p.tipo === 'pagamento'
                )
                .map((p) => (
                  <p key={p.id}>
                    {Number(p.valor).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })} — {p.forma} — {new Date(p.pago_em).toLocaleDateString('pt-BR')}
                  </p>
                ))}
            </div>
          </article>
        )
      })}
  </div>
)}

</section>


<section className="painel-produtos">
  <div className="titulo-lista">
    <h2>Histórico de vendas ({pedidos.length})</h2>

    <button
      type="button"
      className="botao-voltar"
      onClick={carregarPedidos}
      disabled={carregando}
    >
      Atualizar histórico
    </button>
  </div>

  {pedidos.length === 0 ? (
    <p>Nenhuma venda registrada ainda.</p>
  ) : (
    <div className="itens-produtos">
      {pedidos.map((item) => (
        <article className="item-produto" key={item.id}>
          <div className="produto-info">

            {perfil.papel === 'admin' &&
            item.status !== 'cancelado' ? (
              <button
                type="button"
                className="botao-voltar"
                onClick={() => cancelarPedido(item.id)}
              >
                Cancelar pedido
              </button>
            ) : perfil.papel === 'admin' ? (
              <>
                <select
                  value={item.status}
                  onChange={(e) =>
                    atualizarStatusPedido(item.id, e.target.value)
                  }
                >
                  <option value="recebido">Recebido</option>
                  <option value="em_preparacao">Em preparação</option>
                  <option value="pronto">Pronto</option>
                  <option value="entregue">Entregue</option>
                </select>

                <button
                  type="button"
                  className="botao-voltar"
                  onClick={() => cancelarPedido(item.id)}
                >
                  Cancelar pedido
                </button>
              </>
            ) : (
              <span className="estado ativo">{item.status}</span>
            )}

            <h3>Pedido nº {item.id}</h3>
{perfil.papel === 'admin' ? (
  <>
    {item.status !== 'cancelado' ? (
      <select
        value={item.status}
        onChange={(e) =>
          atualizarStatusPedido(item.id, e.target.value)
        }
      >
        <option value="recebido">Recebido</option>
        <option value="em_preparacao">Em preparação</option>
        <option value="pronto">Pronto</option>
        <option value="entregue">Entregue</option>
      </select>
    ) : (
      <span className="estado">Cancelado</span>
    )}

    {item.status !== 'cancelado' && (
      <button
        type="button"
        className="botao-voltar"
        onClick={() => cancelarPedido(item.id)}
      >
        Cancelar pedido
      </button>
    )}
  </>
) : (
  <span className="estado ativo">{item.status}</span>
)}

            <p>Cliente: {item.nome_cliente}</p>

            {perfil.papel === 'admin' && (
              <p>Vendedor: {item.nome_vendedor}</p>
            )}

            <p>
              Total: {Number(item.total).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              })}
            </p>

            <p>
              Data do pedido: {new Date(item.criado_em).toLocaleString('pt-BR')}
            </p>

            <p>
              Entrega: {item.data_entrega
                ? new Date(item.data_entrega).toLocaleString('pt-BR')
                : 'Não definida'}
            </p>

            {item.observacoes && (
              <p>Observações: {item.observacoes}</p>
            )}

            <button
              type="button"
              className="botao-voltar"
              onClick={() => verDetalhesPedido(item.id)}
            >
              Ver detalhes
            </button>

            {pedidoSelecionado === item.id && (
              <div className="detalhes-pedido">
                <h4>Produtos do pedido</h4>

                {carregandoDetalhes ? (
                  <p>Carregando detalhes...</p>
                ) : detalhesPedido.length === 0 ? (
                  <p>Nenhum produto encontrado.</p>
                ) : (
                  detalhesPedido.map((produto) => (
                    <div
                      key={produto.produto_id}
                      className="item-produto"
                    >
                      <div className="produto-info">
                        <h4>{produto.nome_produto}</h4>
                        <p>Quantidade: {produto.quantidade}</p>
                        <p>
                          Preço unitário: {Number(produto.preco_unitario).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </p>
                        <strong>
                          Subtotal: {Number(produto.subtotal).toLocaleString('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                          })}
                        </strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {!carregandoDetalhes && detalhesPedido.length > 0 && (
  <button
    type="button"
    className="botao-principal"
    onClick={() => imprimirPedido(item)}
  >
    Imprimir pedido
  </button>
)}
          </div>
        </article>
      ))}
    </div>
  )}
</section>


{perfil.papel === 'admin' || perfil.papel === 'vendedor' ? (
  <section className="painel-produtos">
    <h2>
      {editandoCliente !== null ? 'Editar cliente' : 'Cadastrar cliente'}
    </h2>

    <form className="form-produto" onSubmit={salvarCliente}>
      <label htmlFor="nome-cliente">Nome do cliente *</label>
      <input
        id="nome-cliente"
        value={cliente.nome}
        onChange={(e) =>
          setCliente({ ...cliente, nome: e.target.value })
        }
        placeholder="Nome completo"
        required
      />

      <label htmlFor="telefone-cliente">Telefone</label>
      <input
        id="telefone-cliente"
        type="tel"
        value={cliente.telefone}
        onChange={(e) =>
          setCliente({ ...cliente, telefone: e.target.value })
        }
        placeholder="(11) 99999-9999"
      />

      {perfil.papel === 'admin' && (
        <>
          <label htmlFor="vendedor-cliente">
            Vendedor responsável *
          </label>
          <select
            id="vendedor-cliente"
            value={cliente.vendedor_id}
            onChange={(e) =>
              setCliente({ ...cliente, vendedor_id: e.target.value })
            }
            required
          >
            <option value="">Selecione um vendedor</option>
            {listaVendedores.map((vendedor) => (
              <option key={vendedor.id} value={vendedor.id}>
                {vendedor.nome}
              </option>
            ))}
          </select>
        </>
      )}

      {erro && <p className="erro-login">{erro}</p>}
      {mensagem && <p className="sucesso-login">{mensagem}</p>}

      <button className="botao-principal" disabled={carregando}>
        {carregando
          ? 'Salvando...'
          : editandoCliente !== null
            ? 'Salvar alterações'
            : 'Cadastrar cliente'}
      </button>
    </form>

    {editandoCliente !== null && (
      <button
        type="button"
        className="botao-voltar"
        onClick={() => {
          setCliente({
            nome: '',
            telefone: '',
            vendedor_id: '',
          })
          setEditandoCliente(null)
          setErro('')
          setMensagem('')
        }}
      >
        Cancelar edição
      </button>
    )}

    <div className="titulo-lista">
      <h2>Clientes cadastrados ({clientes.length})</h2>
      <button
        type="button"
        className="botao-voltar"
        onClick={carregarClientes}
        disabled={carregando}
      >
        Atualizar lista
      </button>
    </div>

    {clientes.length === 0 ? (
      <p>Nenhum cliente cadastrado ainda.</p>
    ) : (
      <div className="itens-produtos">
        {clientes.map((item) => {
          const responsavel = listaVendedores.find(
            (v) => v.id === item.vendedor_id
          )

          return (
            <article className="item-produto" key={item.id}>
              <div className="produto-info">
                <h3>{item.nome}</h3>
                <p>Telefone: {item.telefone || 'Não informado'}</p>

                {perfil.papel === 'admin' && (
                  <p>
                    Vendedor: {responsavel?.nome || 'Vendedor não encontrado'}
                  </p>
                )}
              </div>

              <div className="acoes-produto">
                <button
                  type="button"
                  className="botao-voltar"
                  onClick={() => editarCliente(item)}
                >
                  Editar
                </button>

                <button
                  type="button"
                  className="botao-voltar"
                  onClick={() => excluirCliente(item.id)}
                  disabled={carregando}
                >
                  Excluir
                </button>
              </div>
            </article>
          )
        })}
      </div>
    )}
  </section>
) : null}

      </main>
    )
  }

  return (
    <main className="site">
      <header className="topo">
        <div className="marca">
          <div className="simbolo">SP</div>
          <div>
            <h1>Samita</h1>
            <p>Pães, Doces e Salgados</p>
          </div>
        </div>

        <div className="acoes-topo">
          <a
            className="instagram"
            href="https://www.instagram.com/samita_paes_doces/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram ↗
          </a>
          <button
            className="botao-entrar"
            onClick={sair}
          >
            Sair da conta
          </button>
          <button
            className="botao-entrar"
            onClick={() => {
              setMostrarLogin(!mostrarLogin)
              setErro('')
            }}
          >
            Entrar
          </button>
        </div>
      </header>

      {mostrarLogin && (
        <section className="area-login">
          <form className="painel-login" onSubmit={entrar}>
            <h2>Entrar na minha conta</h2>
            <p>Informe seus dados de acesso.</p>

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />

            <label htmlFor="senha">Senha</label>
            <input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />

            {erro && <p className="erro-login">{erro}</p>}

            <button className="botao-principal" disabled={carregando}>
              {carregando ? 'Entrando...' : 'Entrar'}
            </button>
            <button
              type="button"
              className="botao-voltar"
              onClick={() => setMostrarLogin(false)}
            >
              Voltar ao início
            </button>
          </form>
        </section>
      )}

      <section className="destaque">
        <span className="etiqueta">FEITO COM CARINHO ♡</span>
        <h2>Delícias que deixam<br />seu dia mais <em>doce.</em></h2>
        <p>Pães fresquinhos, doces especiais e salgados deliciosos para você.</p>
        <a className="botao-principal" href="#produtos">
  Fazer meu pedido ↓
</a>
        <div className="decoracao" aria-hidden="true">🥐 🧁 🍞</div>
      </section>


<section className="vendedores" id="produtos">
  <span className="subtitulo">NOSSO CATÁLOGO</span>
  <h2>Conheça nossos produtos</h2>
  <p className="explicacao">
    Escolha seus produtos favoritos e adicione ao carrinho.
  </p>

  {carregando ? (
    <p>Carregando produtos...</p>
  ) : (
    <div className="cartoes">
      {produtos
        .filter((produto) => produto.ativo)
        .map((produto) => (
          <article className="cartao" key={produto.id}>
            <h3>{produto.nome}</h3>

            <p>{produto.descricao}</p>

            <h3>
              {Number(produto.preco).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}
            </h3>

            <p>
              {produto.estoque > 0
                ? `${produto.estoque} unidades disponíveis`
                : 'Produto indisponível'}
            </p>

            <button
              className="botao-whatsapp"
              disabled={produto.estoque <= 0}
              onClick={() => adicionarAoCarrinho(produto)}
            >
              {produto.estoque > 0
                ? 'Adicionar ao carrinho'
                : 'Indisponível'}
            </button>
          </article>
        ))}
    </div>
  )}
</section>


<section className="vendedores" id="carrinho">
  <span className="subtitulo">SEU PEDIDO</span>
  <h2>Meu carrinho</h2>

  {carrinho.length === 0 ? (
    <p className="explicacao">
      Seu carrinho está vazio.
    </p>
  ) : (
    <>
<label className="campo-checkbox">
  <input
    type="checkbox"
    checked={todosSelecionados}
    onChange={(e) =>
      setItensSelecionados(
        e.target.checked
          ? carrinho.map((item) => item.id)
          : []
      )
    }
  />
  Selecionar todos
</label>

<div className="cartoes">
  {carrinho.map((item) => (
          <article className="cartao" key={item.id}>
            <label className="campo-checkbox">
  <input
    type="checkbox"
    checked={itensSelecionados.includes(item.id)}
    onChange={(e) =>
      setItensSelecionados((atual) =>
        e.target.checked
          ? [...atual, item.id]
          : atual.filter((id) => id !== item.id)
      )
    }
  />
  Comprar agora
</label>
            <h3>{item.nome}</h3>

            <p>
              {Number(item.preco).toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              })}
            </p>

            <p>Quantidade: {item.quantidade}</p>

            <button
              onClick={() => {
  const vaiRemoverItem = item.quantidade === 1

  setCarrinho((atual) =>
    atual
      .map((produto) =>
        produto.id === item.id
          ? {
              ...produto,
              quantidade: produto.quantidade - 1
            }
          : produto
      )
      .filter((produto) => produto.quantidade > 0)
  )

  if (vaiRemoverItem) {
    setItensSelecionados((atual) =>
      atual.filter((id) => id !== item.id)
    )
  }
}}
            >
              Remover 1 unidade
            </button>
          </article>
        ))}
      </div>

      <h3>
  Total selecionado: {produtosSelecionados.reduce(
    (total, item) =>
      total + Number(item.preco) * item.quantidade,
    0
  ).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  })}
</h3>

<p>
  {carrinho.length - produtosSelecionados.length} produto(s)
  deixado(s) para depois.
</p>

    <button
  onClick={() => {
    setCarrinho([])
    setItensSelecionados([])
  }}
>
  Esvaziar carrinho
</button>  
    </>
  )}
</section>


<section className="vendedores" id="finalizar">
  <span className="subtitulo">FINALIZAR PEDIDO</span>
  <h2>Seus dados</h2>

  <div className="cartao">
    <label>Seu nome:</label>
    <input
      type="text"
      placeholder="Digite seu nome"
      value={nomeCliente}
      onChange={(e) => setNomeCliente(e.target.value)}
    />

    <label>Seu telefone:</label>
    <input
      type="tel"
      placeholder="(11) 99999-9999"
      value={telefoneCliente}
      onChange={(e) => setTelefoneCliente(e.target.value)}
    />

    <label>Escolha seu vendedor:</label>
    <select
      value={vendedorSelecionado}
      onChange={(e) => setVendedorSelecionado(e.target.value)}
    >
      <option value="">Selecione um vendedor</option>
      {listaVendedores.map((vendedor) => (
        <option key={vendedor.id} value={vendedor.id}>
          {vendedor.nome}
        </option>
      ))}
    </select>

    <label>Forma de pagamento:</label>
    <select
      value={formaPagamento}
      onChange={(e) => setFormaPagamento(e.target.value)}
    >
      <option value="pix">PIX</option>
      <option value="dinheiro">Dinheiro</option>
      <option value="deixar na conta">Deixar na conta (fiado)</option>
    </select>
      </div>

  <button
  className="botao-principal"
  onClick={finalizarPedido}disabled={produtosSelecionados.length === 0 || enviandoPedido}
  
>
  {enviandoPedido ? 'Enviando pedido...' : 'Confirmar pedido'}
</button>
</section>

      <section className="vendedores" id="vendedores">
        <span className="subtitulo">NOSSO ATENDIMENTO</span>
        <h2>Com quem você costuma comprar?</h2>
        <p className="explicacao">
          Escolha seu vendedor para entrar em contato pelo WhatsApp.
        </p>

        <div className="cartoes">
          {vendedores.map((vendedor, indice) => (
            <article className="cartao" key={vendedor.nome}>
              <div className="avatar">{vendedor.nome[0]}</div>
              <span className="numero">VENDEDOR {indice + 1}</span>
              <h3>{vendedor.nome}</h3>
              <p>{vendedor.descricao}</p>
              <a
                className="botao-whatsapp"
                href={`https://wa.me/${vendedor.telefone}?text=${encodeURIComponent(
                  'Olá! Gostaria de conhecer os produtos e fazer um pedido.'
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Conversar no WhatsApp ↗
              </a>
            </article>
          ))}
        </div>
      </section>

      <footer>
        <div className="marca marca-rodape">
          <div className="simbolo">SP</div>
          <div>
            <h3>Samita</h3>
            <p>Pães, Doces e Salgados</p>
          </div>
        </div>
        <p>Feito com carinho para adoçar seus momentos. ♡</p>
        <a
          href="https://www.instagram.com/samita_paes_doces/"
          target="_blank"
          rel="noreferrer"
        >
          @samita_paes_doces
        </a>
        <small>© 2026 Samita Pães, Doces e Salgados</small>
      </footer>
    </main>
  )
}

export default App