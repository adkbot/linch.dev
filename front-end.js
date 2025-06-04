import React, { useState } from "react";
import { ethers } from "ethers";
import Papa from "papaparse";

// ... (As mesmas configurações anteriores)

const ONEINCH_API_KEY = process.env.REACT_APP_1INCH_API_KEY;
const CHAIN_ID = 56;
const USDT = "0x55d398326f99059ff775485246999027b3197955";
const SYSTEM_WALLET = "0xB125CE4ecA20897b8D9A18A3F9b7455bFa84770E";
const SLIPPAGE = 1;
const MIN_PROFIT = 0.005;

function App() {
  // ... (todas as funções e lógica do painel continuam iguais!)

  // COPIE AQUI TODO O CÓDIGO ANTERIOR DAS FUNÇÕES...

  // Só substitua o bloco JSX final pelo abaixo (interface responsiva):
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(145deg, #1b1c22 60%, #292b37 100%)",
        color: "#eee",
        fontFamily: "Inter, Arial, sans-serif",
        padding: 0,
        margin: 0,
      }}
    >
      <div
        style={{
          maxWidth: 520,
          margin: "auto",
          padding: "2vw 4vw 4vw 4vw",
          background: "rgba(34,37,51,0.93)",
          borderRadius: 16,
          boxShadow: "0 8px 36px #0008",
          marginTop: 24,
          minHeight: "92vh",
        }}
      >
        <h2
          style={{
            color: "#37f6b0",
            fontSize: "clamp(1.1rem, 5vw, 2.2rem)",
            letterSpacing: ".05em",
            textAlign: "center",
            margin: 0,
            marginBottom: 14,
          }}
        >
          🦄 Arbitragem DEX BNB Chain <br />
          <span style={{ fontWeight: 400, fontSize: ".7em" }}>Painel Institucional</span>
        </h2>
        <button
          onClick={connectWallet}
          style={{
            padding: 12,
            width: "100%",
            background: "#232634",
            color: "#37f6b0",
            fontWeight: "bold",
            fontSize: "1.12em",
            border: "none",
            borderRadius: 8,
            margin: "7px 0",
          }}
        >
          Conectar MetaMask
        </button>
        {userAddress && (
          <div
            style={{
              marginTop: 8,
              background: "#1c1d25",
              padding: 10,
              borderRadius: 7,
              fontSize: "0.98em",
              overflowWrap: "break-word",
            }}
          >
            <b>Carteira:</b> <span style={{ wordBreak: "break-all" }}>{userAddress}</span>
            <br />
            <b>Saldo USDT:</b> {balance}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, margin: "16px 0", flexWrap: "wrap" }}>
          <button
            onClick={fetchGoodTokens}
            style={{
              flex: 1,
              minWidth: 140,
              background: "#25273b",
              color: "#9fffcf",
              border: "none",
              borderRadius: 7,
              padding: "10px 2vw",
              fontWeight: "bold",
              fontSize: ".97em",
            }}
          >
            Filtrar tokens sólidos
          </button>
          <button
            onClick={buscarArbitragem}
            disabled={goodTokens.length === 0}
            style={{
              flex: 1,
              minWidth: 140,
              background: goodTokens.length === 0 ? "#222c" : "#2e4458",
              color: "#c5e8fa",
              border: "none",
              borderRadius: 7,
              padding: "10px 2vw",
              fontWeight: "bold",
              fontSize: ".97em",
              opacity: goodTokens.length === 0 ? 0.7 : 1,
              cursor: goodTokens.length === 0 ? "not-allowed" : "pointer",
            }}
          >
            Buscar Arbitragem
          </button>
        </div>
        <div
          style={{
            margin: "12px 0 18px 0",
            color: "#f6e237",
            fontWeight: "bold",
            minHeight: 28,
            fontSize: "1.03em",
          }}
        >
          {status}
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <label style={{ fontSize: "1em", fontWeight: 500 }}>
            Valor USDT:{" "}
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: 90,
                fontSize: "1.1em",
                padding: 7,
                borderRadius: 6,
                border: "1px solid #333",
                marginLeft: 6,
                background: "#1a1c24",
                color: "#72f6cb",
              }}
              type="number"
              min={1}
            />
          </label>
        </div>
        {bestArb && (
          <div
            style={{
              background: "#23284a",
              margin: "20px 0 12px 0",
              padding: 16,
              borderRadius: 13,
              boxShadow: "0 1px 6px #0004",
              fontSize: "1.09em",
            }}
          >
            <b>Melhor arbitragem:</b> USDT → {bestArb.symbol} → USDT
            <br />
            Lucro líquido estimado:{" "}
            <span style={{ color: "#55ffae", fontWeight: "bold" }}>
              {(bestArb.lucro * 100).toFixed(2)}%
            </span>
            <br />
            <button
              onClick={executarArbitragem}
              style={{
                marginTop: 13,
                background: "#37f6b0",
                color: "#191b23",
                fontWeight: "bold",
                borderRadius: 8,
                fontSize: "1em",
                padding: "10px 18px",
                border: "none",
                cursor: "pointer",
              }}
            >
              Executar Arbitragem
            </button>
          </div>
        )}
        <hr style={{ margin: "16px 0", border: "1px solid #25273b" }} />
        <h3 style={{ margin: "14px 0 6px 0", fontSize: "1.1em", color: "#7fd8fa" }}>
          Extrato de Arbitragem
        </h3>
        <div
          style={{
            overflowX: "auto",
            background: "#171c29",
            borderRadius: 8,
            boxShadow: "0 1px 8px #0002",
            marginBottom: 18,
          }}
        >
          <table
            style={{
              width: "100%",
              minWidth: 420,
              borderSpacing: 0,
              fontSize: "0.97em",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <thead style={{ background: "#292b37" }}>
              <tr>
                <th style={{ padding: "7px 2px" }}>Data/Hora</th>
                <th style={{ padding: "7px 2px" }}>Valor USDT</th>
                <th style={{ padding: "7px 2px" }}>Token</th>
                <th style={{ padding: "7px 2px" }}>Lucro (%)</th>
                <th style={{ padding: "7px 2px" }}>Tx</th>
              </tr>
            </thead>
            <tbody>
              {history.map((swap, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #232323" }}>
                  <td style={{ textAlign: "center" }}>{swap.data}</td>
                  <td style={{ textAlign: "center" }}>{swap.valor}</td>
                  <td style={{ textAlign: "center" }}>{swap.token}</td>
                  <td style={{ textAlign: "center" }}>{swap.lucro}</td>
                  <td style={{ textAlign: "center" }}>{swap.tx}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {history.length > 0 && (
          <button
            onClick={exportCSV}
            style={{
              background: "#37f6b0",
              color: "#191b23",
              fontWeight: "bold",
              borderRadius: 8,
              fontSize: "1em",
              padding: "8px 24px",
              border: "none",
              cursor: "pointer",
              width: "100%",
            }}
          >
            Exportar extrato CSV
          </button>
        )}
        <div
          style={{
            marginTop: 40,
            color: "#5fdbfa",
            fontSize: 13,
            textAlign: "center",
            opacity: 0.77,
          }}
        >
          Powered by 1inch API & CoinGecko • Arbitragem Institucional
        </div>
      </div>
      {/* Mobile adapt: spacing at bottom */}
      <div style={{ height: "6vw" }}></div>
    </div>
  );
}

export default App;
