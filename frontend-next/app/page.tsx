"use client";
import React, { useState } from 'react';
import { ConnectButton, useActiveAccount } from 'thirdweb/react';

export default function Page() {
  const account = useActiveAccount();
  const activeAddress = account?.address || '';

  const [urlAuth, setUrlAuth] = useState('http://localhost:3001');
  const [urlSwap, setUrlSwap] = useState('http://localhost:3002');

  const [payload, setPayload] = useState<any>(null);
  const [signature, setSignature] = useState('');
  const [token, setToken] = useState('');
  const [sessionId, setSessionId] = useState('');

  const [fromChainId, setFromChainId] = useState(1);
  const [toChainId, setToChainId] = useState(137);
  const [fromToken, setFromToken] = useState('native');
  const [toToken, setToToken] = useState('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174');
  const [amountHuman, setAmountHuman] = useState('1.0');
  const [receiver, setReceiver] = useState('');
  const unit = 'token';

  const [quote, setQuote] = useState<any>(null);
  const [log, setLog] = useState<string>('');
  const appendLog = (msg: string) => setLog((prev) => prev + msg + '\n');

  const authLogin = async () => {
    if (!activeAddress) return alert('Conecte a wallet');
    const res = await fetch(urlAuth + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ address: activeAddress }) });
    const data = await res.json();
    setPayload(data.payload);
  };

  const signPayload = async () => {
    if (!payload) return alert('Faça /auth/login primeiro');
    const msg = `${payload.domain} wants you to sign in with your Ethereum account:\n${payload.address}\n\n${payload.statement}\n\nVersion: ${payload.version}\nNonce: ${payload.nonce}\nIssued At: ${payload.issued_at}\nExpiration Time: ${payload.expiration_time}\nNot Before: ${payload.invalid_before}`;
    if (!window.ethereum || !activeAddress) return alert('Wallet não conectada');
    const sig = await window.ethereum.request({ method: 'personal_sign', params: [msg, activeAddress] });
    setSignature(sig);
  };

  const authVerify = async () => {
    if (!signature) return alert('Assine antes');
    const res = await fetch(urlAuth + '/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, signature }) });
    const data = await res.json();
    setToken(data.token);
    setSessionId(data.sessionId);
  };

  const onGetQuote = async () => {
    if (!token) return alert('Faça o login (JWT)');
    const body = { fromChainId: Number(fromChainId), toChainId: Number(toChainId), fromToken, toToken, amount: amountHuman, unit };
    const res = await fetch(urlSwap + '/swap/quote', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json();
    setQuote(data.quote || null);
  };

  const onSwap = async () => {
    if (!token) return alert('Faça o login (JWT)');
    if (!activeAddress || !window.ethereum) return alert('Conecte a wallet');
    const finalReceiver = receiver && receiver.trim() !== '' ? receiver : activeAddress;
    const body = { fromChainId: Number(fromChainId), toChainId: Number(toChainId), fromToken, toToken, amount: amountHuman, unit, receiver: finalReceiver };
    const res = await fetch(urlSwap + '/swap/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const data = await res.json();
    const prepared = data.prepared || {};
    let txs: any[] = [];
    if (Array.isArray(prepared.transactions)) txs = prepared.transactions;
    if (!txs.length && Array.isArray(prepared.steps)) {
      for (const s of prepared.steps) if (Array.isArray(s.transactions)) txs.push(...s.transactions);
    }
    if (!txs.length) return appendLog('Nenhuma transação preparada retornada.');
    for (const t of txs) {
      const chainIdHex = '0x' + Number(t.chainId).toString(16);
      await (window as any).ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
      const valueHex = t.value !== undefined && t.value !== null ? ('0x' + BigInt(t.value).toString(16)) : '0x0';
      const txHash = await (window as any).ethereum.request({ method: 'eth_sendTransaction', params: [{ from: activeAddress, to: t.to, data: t.data, value: valueHex }] });
      appendLog(`Tx enviada (chain ${t.chainId}): ${txHash}`);
    }
  };

  return (
    <div className="min-h-screen bg-bg-dark text-white">
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-accent" />
          <div className="font-bold">PanoramaBlock Swap</div>
        </div>
        <ConnectButton />
      </header>

      <main className="flex justify-center p-6">
        <div className="w-full max-w-xl bg-panel border border-white/10 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold">Swap</div>
            <div className="text-xs opacity-70">Non-custodial • thirdweb</div>
          </div>

          <div className="mt-4 bg-[#0F1426] rounded-xl p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs opacity-70">From chain</div>
                <input className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2" value={fromChainId} onChange={(e)=>setFromChainId(Number(e.target.value))} />
              </div>
              <div>
                <div className="text-xs opacity-70">To chain</div>
                <input className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2" value={toChainId} onChange={(e)=>setToChainId(Number(e.target.value))} />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-xs opacity-70">From token</div>
              <input className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2" value={fromToken} onChange={(e)=>setFromToken(e.target.value)} placeholder="native ou 0x..." />
            </div>
            <div className="mt-3">
              <div className="text-xs opacity-70">To token</div>
              <input className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2" value={toToken} onChange={(e)=>setToToken(e.target.value)} placeholder="0x..." />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-xs opacity-70">Amount</div>
                <input className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2" value={amountHuman} onChange={(e)=>setAmountHuman(e.target.value)} placeholder="0.0" />
              </div>
              <div>
                <div className="text-xs opacity-70">Receiver (opcional)</div>
                <input className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2" value={receiver} onChange={(e)=>setReceiver(e.target.value)} placeholder="defaults to sender" />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={onGetQuote} className="flex-1 bg-[#1F2542] border border-white/10 rounded-lg px-3 py-2">Get Quote</button>
              <button onClick={onSwap} className="flex-1 bg-accent rounded-lg px-3 py-2 text-white">Swap</button>
            </div>
          </div>

          {quote && (
            <div className="mt-4 bg-[#0F1426] rounded-xl p-3 space-y-1 text-sm">
              <div className="font-bold">Quote</div>
              <div>Amount (WEI): {quote.amount}</div>
              {quote.amountHuman && <div>Amount (token): {quote.amountHuman}</div>}
              {quote.amountUsd && <div>Amount (USD): ${quote.amountUsd}</div>}
              <div>Estimated receive (WEI): {quote.estimatedReceiveAmount}</div>
              {quote.estimatedReceiveAmountUsd && <div>Estimated receive (USD): ${quote.estimatedReceiveAmountUsd}</div>}
              <div>Estimated time: {quote.estimatedDuration}s</div>
              <div>Fees (WEI): bridge {quote.fees.bridgeFee} + gas {quote.fees.gasFee} = {quote.fees.totalFee}</div>
              {quote.fees.totalFeeUsd && <div>Fees (USD): ${quote.fees.totalFeeUsd}</div>}
            </div>
          )}

          <div className="mt-4 bg-[#0F1426] rounded-xl p-3">
            <div className="font-bold mb-2">Auth</div>
            <div className="flex gap-2 flex-wrap">
              <button onClick={authLogin} className="bg-[#1F2542] border border-white/10 rounded-lg px-3 py-2">/auth/login</button>
              <button onClick={signPayload} className="bg-[#1F2542] border border-white/10 rounded-lg px-3 py-2">Assinar payload</button>
              <button onClick={authVerify} className="bg-[#1F2542] border border-white/10 rounded-lg px-3 py-2">/auth/verify</button>
            </div>
            {token && <div className="mt-2 text-xs opacity-80">JWT ok</div>}
          </div>

          <div className="mt-4 bg-[#0F1426] rounded-xl p-3">
            <div className="font-bold mb-2">Logs</div>
            <pre className="whitespace-pre-wrap text-indigo-200 text-xs">{log}</pre>
          </div>
        </div>
      </main>
    </div>
  );
}


