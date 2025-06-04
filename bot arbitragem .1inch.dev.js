import React, { useState } from "react";
import { ethers } from "ethers";
import Papa from "papaparse";

const ONEINCH_API_KEY = process.env.REACT_APP_1INCH_API_KEY;
const CHAIN_ID = 56; // BNB Chain
const USDT = "0x55d398326f99059ff775485246999027b3197955";
const SYSTEM_WALLET = "0xB125CE4ecA20897b8D9A18A3F9b7455bFa84770E";
const SLIPPAGE = 1;
const MIN_PROFIT = 0.005; // 0.5%

function App() {
  const [userAddress, setUserAddress] = useState("");
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState("100");
  const [tokens, setTokens] = useState([]);
  const [goodTokens, setGoodTokens] = useState([]);
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState([]);
  const [bestArb, setBestArb] = useState(null);

  // 1. Conectar carteira
  async function connectWallet() {
    try {
      if (window.ethereum) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x38" }]
        });
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        setUserAddress(address);

        // Pega saldo USDT
        const abi = [
          "function balanceOf(address) view returns (uint256)",
          "function decimals() view returns (uint8)"
        ];
        const usdt = new ethers.Contract(USDT, abi, provider);
        const rawBalance = await usdt.balanceOf(address);
        const decimals = await usdt.decimals();
        setBalance(Number(ethers.utils.formatUnits(rawBalance, decimals)).toFixed(2));
        setStatus("Carteira conectada!");
      }
    } catch (e) {
      setStatus("Erro ao conectar: " + e.message);
    }
  }

  // 2. Buscar tokens consolidados com liquidez (CoinGecko + 1inch)
  async function fetchGoodTokens() {
    setStatus("Buscando tokens sólidos...");
    // a) Pega lista 1inch
    const url1inch = `https://api.1inch.dev/swap/v5.2/56/tokens`;
    const resp = await fetch(url1inch, {
      headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` }
    });
    const data = await resp.json();
    const tokensList = Object.values(data.tokens);
    setTokens(tokensList);

    // b) Filtra tokens por volume e marketcap via CoinGecko
    let filtrados = [];
    for (let t of tokensList) {
      try {
        // Puxa info do CoinGecko
        const cg = await fetch(`https://api.coingecko.com/api/v3/coins/binance-smart-chain/contract/${t.address}`);
        if (!cg.ok) continue;
        const info = await cg.json();
        const volume = info.market_data?.total_volume?.usd || 0;
        const mcRank = info.market_cap_rank || 9999;
        if (volume > 500000 && mcRank < 300) {
          filtrados.push({
            symbol: t.symbol,
            address: t.address,
            decimals: t.decimals
          });
        }
      } catch {
        continue;
      }
    }
    setGoodTokens(filtrados);
    setStatus(`Tokens sólidos encontrados: ${filtrados.length}`);
  }

  // 3. Buscar melhores oportunidades de arbitragem
  async function buscarArbitragem() {
    setStatus("Simulando arbitragem...");
    let melhor = null;
    let melhorLucro = 0;
    let valorUSDT = parseFloat(amount);
    let resultadoSimulacoes = [];

    for (let token of goodTokens) {
      try {
        // Simula USDT -> TOKEN
        const amountIn = (valorUSDT * 1e18).toFixed(0);
        const url1 = `https://api.1inch.dev/swap/v5.2/${CHAIN_ID}/quote?fromTokenAddress=${USDT}&toTokenAddress=${token.address}&amount=${amountIn}`;
        const res1 = await fetch(url1, {
          headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` }
        });
        const quote1 = await res1.json();
        if (!quote1.toTokenAmount) continue;
        const amountToken = quote1.toTokenAmount;

        // Simula TOKEN -> USDT
        const url2 = `https://api.1inch.dev/swap/v5.2/${CHAIN_ID}/quote?fromTokenAddress=${token.address}&toTokenAddress=${USDT}&amount=${amountToken}`;
        const res2 = await fetch(url2, {
          headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` }
        });
        const quote2 = await res2.json();
        if (!quote2.toTokenAmount) continue;
        const usdtDeVolta = Number(quote2.toTokenAmount) / 1e18;

        const lucro = (usdtDeVolta - valorUSDT) / valorUSDT;
        resultadoSimulacoes.push({ token: token.symbol, usdtDeVolta, lucro: (lucro*100).toFixed(3) + "%" });

        if (lucro > melhorLucro && lucro > MIN_PROFIT) {
          melhorLucro = lucro;
          melhor = { ...token, usdtDeVolta, lucro, amountToken, quote1, quote2 };
        }
      } catch {}
    }

    setBestArb(melhor);
    if (melhor) setStatus(`Melhor arbitragem: USDT -> ${melhor.symbol} -> USDT, lucro líquido ${(melhor.lucro*100).toFixed(2)}%`);
    else setStatus("Nenhuma arbitragem rentável encontrada.");

    // Para debug:
    // console.table(resultadoSimulacoes);
  }

  // 4. Executar ciclo de arbitragem e dividir lucro (2 swaps + transferência)
  async function executarArbitragem() {
    if (!bestArb) return;
    setStatus("Executando arbitragem...");
    let valorUSDT = parseFloat(amount);

    // a) Swap USDT -> TOKEN
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    const amountIn = (valorUSDT * 1e18).toFixed(0);

    const swapUrl1 = `https://api.1inch.dev/swap/v5.2/${CHAIN_ID}/swap?fromTokenAddress=${USDT}&toTokenAddress=${bestArb.address}&amount=${amountIn}&fromAddress=${userAddress}&slippage=${SLIPPAGE}`;
    const swapResp1 = await fetch(swapUrl1, {
      headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` }
    });
    const swapData1 = await swapResp1.json();

    // Aprovação USDT
    const abi = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 value) returns (bool)"
    ];
    const usdt = new ethers.Contract(USDT, abi, signer);
    const allowance = await usdt.allowance(userAddress, swapData1.tx.to);
    if (ethers.BigNumber.from(allowance).lt(ethers.BigNumber.from(amountIn))) {
      setStatus("Aprovando USDT...");
      const txApprove = await usdt.approve(swapData1.tx.to, amountIn);
      await txApprove.wait();
    }
    setStatus("Executando swap 1...");
    await signer.sendTransaction({
      from: swapData1.tx.from,
      to: swapData1.tx.to,
      data: swapData1.tx.data,
      value: swapData1.tx.value || "0x0"
    });

    // b) Swap TOKEN -> USDT
    const swapUrl2 = `https://api.1inch.dev/swap/v5.2/${CHAIN_ID}/swap?fromTokenAddress=${bestArb.address}&toTokenAddress=${USDT}&amount=${bestArb.amountToken}&fromAddress=${userAddress}&slippage=${SLIPPAGE}`;
    const swapResp2 = await fetch(swapUrl2, {
      headers: { Authorization: `Bearer ${ONEINCH_API_KEY}` }
    });
    const swapData2 = await swapResp2.json();

    // Aprovação TOKEN
    const tokenAbi = [
      "function allowance(address owner, address spender) view returns (uint256)",
      "function approve(address spender, uint256 value) returns (bool)"
    ];
    const tokenContract = new ethers.Contract(bestArb.address, tokenAbi, signer);
    const allowanceToken = await tokenContract.allowance(userAddress, swapData2.tx.to);
    if (ethers.BigNumber.from(allowanceToken).lt(ethers.BigNumber.from(bestArb.amountToken))) {
      setStatus("Aprovando token...");
      const txApproveToken = await tokenContract.approve(swapData2.tx.to, bestArb.amountToken);
      await txApproveToken.wait();
    }
    setStatus("Executando swap 2...");
    await signer.sendTransaction({
      from: swapData2.tx.from,
      to: swapData2.tx.to,
      data: swapData2.tx.data,
      value: swapData2.tx.value || "0x0"
    });

    // c) Calcular lucro, transferir 50% para a carteira do sistema
    const usdtDeVolta = bestArb.usdtDeVolta;
    const lucro = usdtDeVolta - valorUSDT;
    if (lucro > 0) {
      const metade = (lucro / 2).toFixed(6);
      setStatus("Distribuindo lucro...");
      // Envia metade do lucro em USDT para o sistema
      const transferAbi = [
        "function transfer(address to, uint256 value) returns (bool)"
      ];
      const usdtContract = new ethers.Contract(USDT, transferAbi, signer);
      const decimals = 18;
      const tx = await usdtContract.transfer(SYSTEM_WALLET, ethers.utils.parseUnits(metade, decimals));
      await tx.wait();
    }

    // d) Registrar extrato
    setHistory(hist => [
      {
        data: new Date().toLocaleString(),
        valor: amount,
        token: bestArb.symbol,
        lucro: (bestArb.lucro*100).toFixed(2) + "%",
        tx: "-", // Você pode registrar o hash das transações aqui se quiser!
      },
      ...hist
    ]);
    setStatus("Arbitragem concluída e lucro dividido!");
  }

  // Exportar extrato CSV
  function exportCSV() {
    const csv = Papa.unparse(history);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", "extrato-arbitragem.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div style={{ background: "#191b23", color: "#eee", minHeight: "100vh", padding: 24, fontFamily: "Arial" }}>
      <h2 style={{ color: "#37f6b0" }}>🦄 Arbitragem DEX BNB Chain — Painel Institucional</h2>
      <button onClick={connectWallet} style={{ padding: 8, fontWeight: "bold" }}>
        Conectar MetaMask
      </button>
      {userAddress && (
        <div style={{ marginTop: 10 }}>
          <b>Carteira:</b> {userAddress}<br />
          <b>Saldo USDT:</b> {balance}
        </div>
      )}
      <hr style={{ margin: "16px 0", border: "1px solid #333" }} />
      <button onClick={fetchGoodTokens} style={{ marginRight: 8 }}>Filtrar tokens sólidos</button>
      <button onClick={buscarArbitragem} disabled={goodTokens.length === 0}>Buscar Arbitragem</button>
      <div style={{ margin: "12px 0", color: "#f6e237" }}>{status}</div>
      <label>
        Valor USDT:{" "}
        <input value={amount} onChange={e => setAmount(e.target.value)} style={{ width: 100, marginRight: 8 }} />
      </label>
      {bestArb && (
        <div style={{ background: "#25273b", margin: "16px 0", padding: 16, borderRadius: 10 }}>
          <b>Melhor arbitragem:</b> USDT → {bestArb.symbol} → USDT<br />
          Lucro líquido estimado: {(bestArb.lucro*100).toFixed(2)}%<br />
          <button onClick={executarArbitragem} style={{ marginTop: 10, background: "#37f6b0", color: "#191b23", fontWeight: "bold" }}>
            Executar Arbitragem
          </button>
        </div>
      )}
      <hr style={{ margin: "16px 0", border: "1px solid #333" }} />
      <h3>Extrato de Arbitragem</h3>
      <table style={{ width: "100%", background: "#25273b", color: "#fff", borderRadius: 10, marginBottom: 16 }}>
        <thead>
          <tr>
            <th>Data/Hora</th>
            <th>Valor USDT</th>
            <th>Token</th>
            <th>Lucro (%)</th>
            <th>Tx</th>
          </tr>
        </thead>
        <tbody>
          {history.map((swap, i) => (
            <tr key={i}>
              <td>{swap.data}</td>
              <td>{swap.valor}</td>
              <td>{swap.token}</td>
              <td>{swap.lucro}</td>
              <td>{swap.tx}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {history.length > 0 && (
        <button onClick={exportCSV} style={{ background: "#37f6b0", color: "#191b23", fontWeight: "bold", borderRadius: 5 }}>
          Exportar extrato CSV
        </button>
      )}
      <div style={{ marginTop: 40, color: "#5fdbfa", fontSize: 13 }}>
        Powered by 1inch API & CoinGecko • Arbitragem Institucional
      </div>
    </div>
  );
}

export default App;
